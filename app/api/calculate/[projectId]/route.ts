export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import db, { initDb } from '@/lib/db'
import { runCalculation } from '@/lib/calculations'
import { generateSLD } from '@/lib/sld-generator'
import type { Project, Load, Bus } from '@/lib/types'

type Ctx = { params: { projectId: string } }

function mapProject(p: Record<string, unknown>): Project {
  const pt = String(p.power_type || 'DG')
  const legacyHasDg = !['BATTERY','FUELCELL','SOLAR','SHORE'].includes(pt)
  return {
    id: String(p.id),
    vesselName: String(p.vessel_name),
    hullNo: String(p.hull_no),
    projectNo: String(p.project_no),
    classCode: String(p.class_code),
    acVoltage: Number(p.ac_voltage),
    frequency: Number(p.frequency),
    hasDg:    p.has_dg !== undefined ? Boolean(p.has_dg) : legacyHasDg,
    hasEg:    Boolean(p.has_eg),
    hasEss:   Boolean(p.has_ess),
    hasFc:    Boolean(p.has_fc),
    hasPv:    Boolean(p.has_pv),
    hasShore: Boolean(p.has_shore),
    hasDc:    Boolean(p.has_dc),
    dgCount:  Number(p.dg_count),
    dgPf:     Number(p.dg_pf),
    designMargin: Number(p.design_margin),
    dgXd:     Number(p.dg_xd) || 0.15,
    essBackupH: Number(p.ess_backup_h),
    essMargin:  Number(p.ess_margin),
    dcVoltage:  Number(p.dc_voltage),
    motorCount: Number(p.motor_count),
    motorKw:    Number(p.motor_kw),
    isoKva:     Number(p.iso_kva),
    propPf:     Number(p.prop_pf) || 0.95,
    operationHours: Number(p.operation_hours) || 8,
    chargeHours:    Number(p.charge_hours) || 6,
    fcStackKw:  Number(p.fc_stack_kw) || 0,
    pvKwp:      Number(p.pv_kwp) || 0,
    pvSunHours: Number(p.pv_sun_hours) || 4,
    essPeakThreshPct: Number(p.ess_peak_thresh_pct) || 75,
    essPeakDurMin:    Number(p.ess_peak_dur_min) || 15,
    essSpinReserve:   Boolean(p.ess_spin_reserve),
    // ELA
    dgKvaRated: Number(p.dg_kva_rated) || 0,
    egKvaRated: Number(p.eg_kva_rated) || 0,
    egPf:       Number(p.eg_pf) || 0.8,
    runCountSea:      Number(p.run_count_sea)      || 1,
    runCountArrival:  Number(p.run_count_arrival)  || 2,
    runCountCargo:    Number(p.run_count_cargo)    || 2,
    runCountHarbor:   Number(p.run_count_harbor)   || 1,
    divFactorSea:     Number(p.div_factor_sea)     || 1.8,
    divFactorArrival: Number(p.div_factor_arrival) || 1.8,
    divFactorCargo:   Number(p.div_factor_cargo)   || 1.8,
    divFactorHarbor:  Number(p.div_factor_harbor)  || 1.8,
    createdAt: String(p.created_at),
    updatedAt: String(p.updated_at),
  }
}

function mapLoad(l: Record<string, unknown>): Load {
  const df = Number(l.demand_factor)
  return {
    id: String(l.id),
    projectId: String(l.project_id),
    circuitNo: String(l.circuit_no),
    name: String(l.name),
    fromBus: String(l.from_bus),
    toTag: String(l.to_tag),
    kw: Number(l.kw),
    pf: Number(l.pf),
    efficiency: Number(l.efficiency),
    priority: String(l.priority || 'IMPORTANT') as Load['priority'],
    startType: String(l.start_type) as Load['startType'],
    demandFactor: df,
    dfSea:  l.df_sea  !== undefined ? Number(l.df_sea)  : df,
    dfWork: l.df_work !== undefined ? Number(l.df_work) : 0,
    dfEmg:  l.df_emg  !== undefined ? Number(l.df_emg)  : 0,
    dfArrival: l.df_arrival == null ? null : Number(l.df_arrival),
    dfHarbor:  l.df_harbor  == null ? null : Number(l.df_harbor),
    // ELA
    loadKind: String(l.load_kind || 'continuous') as Load['loadKind'],
    quantity: Number(l.quantity) || 1,
    startingMultiplier: Number(l.starting_multiplier) || 1,
    isSheddable: Boolean(l.is_sheddable),
    shedPriority: Number(l.shed_priority) || 0,
    phase: String(l.phase) as Load['phase'],
    isEmergency: Boolean(l.is_emergency),
    isBattery:   Boolean(l.is_battery),
    cableLength: Number(l.cable_length) || 0,
    location: String(l.location || ''),
    notes:    String(l.notes || ''),
    sortOrder: Number(l.sort_order),
  }
}

export async function POST(_: Request, { params }: Ctx) {
  await initDb()
  const [pRes, lRes, bRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [params.projectId] }),
    db.execute({ sql: 'SELECT * FROM loads WHERE project_id=? ORDER BY sort_order', args: [params.projectId] }),
    db.execute({ sql: 'SELECT * FROM buses WHERE project_id=? ORDER BY sort_order', args: [params.projectId] }),
  ])
  if (!pRes.rows[0]) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const project = mapProject(pRes.rows[0] as Record<string, unknown>)
  const loads   = lRes.rows.map(l => mapLoad(l as Record<string, unknown>))
  const buses   = bRes.rows.map(b => ({
    id: String(b.id),
    projectId: String(b.project_id),
    tag: String(b.tag),
    name: String(b.name),
    type: String(b.type) as Bus['type'],
    voltage: Number(b.voltage),
    parentTag: String(b.parent_tag || ''),
    sortOrder: Number(b.sort_order),
  }))

  const result = runCalculation(project, loads, buses)
  const dt = new Date().toLocaleDateString('ko-KR')
  const sldXml = generateSLD(project, result, buses, dt)

  const id = uuid()
  await db.execute({ sql: 'DELETE FROM calc_results WHERE project_id=?', args: [params.projectId] })
  await db.execute({
    sql: 'INSERT INTO calc_results (id,project_id,result_json,sld_xml) VALUES (?,?,?,?)',
    args: [id, params.projectId, JSON.stringify(result), sldXml],
  })
  return NextResponse.json({ result, sldXml, success: true })
}

export async function GET(_: Request, { params }: Ctx) {
  await initDb()
  const res = await db.execute({
    sql: 'SELECT result_json,sld_xml,calculated_at FROM calc_results WHERE project_id=? ORDER BY calculated_at DESC LIMIT 1',
    args: [params.projectId],
  })
  if (!res.rows[0]) return NextResponse.json({ result: null, sldXml: null })
  return NextResponse.json({
    result: JSON.parse(String(res.rows[0].result_json)),
    sldXml: res.rows[0].sld_xml,
    calculatedAt: res.rows[0].calculated_at,
  })
}
