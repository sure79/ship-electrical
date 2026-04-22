export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import db, { initDb } from '@/lib/db'
import { runCalculation } from '@/lib/calculations'
import type { Project, Load, Bus } from '@/lib/types'
import SldViewer from './SldViewer'
import Link from 'next/link'

async function load(projectId: string) {
  await initDb()
  const [pRes, lRes, bRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [projectId] }),
    db.execute({ sql: 'SELECT * FROM loads WHERE project_id=? ORDER BY sort_order', args: [projectId] }),
    db.execute({ sql: 'SELECT * FROM buses WHERE project_id=? ORDER BY sort_order', args: [projectId] }),
  ])
  if (!pRes.rows[0]) return null

  const p = pRes.rows[0] as Record<string, unknown>
  const pt = String(p.power_type || 'DG')
  const legacyHasDg = !['BATTERY', 'FUELCELL', 'SOLAR', 'SHORE'].includes(pt)
  const project: Project = {
    id: String(p.id),
    vesselName: String(p.vessel_name),
    hullNo: String(p.hull_no),
    projectNo: String(p.project_no),
    classCode: String(p.class_code),
    acVoltage: Number(p.ac_voltage),
    frequency: Number(p.frequency),
    hasDg: p.has_dg !== undefined ? Boolean(p.has_dg) : legacyHasDg,
    hasEg: Boolean(p.has_eg),
    hasEss: Boolean(p.has_ess),
    hasFc: Boolean(p.has_fc),
    hasPv: Boolean(p.has_pv),
    hasShore: Boolean(p.has_shore),
    hasDc: Boolean(p.has_dc),
    dgCount: Number(p.dg_count),
    dgPf: Number(p.dg_pf),
    designMargin: Number(p.design_margin),
    dgXd: Number(p.dg_xd) || 0.15,
    essBackupH: Number(p.ess_backup_h),
    essMargin: Number(p.ess_margin),
    dcVoltage: Number(p.dc_voltage),
    motorCount: Number(p.motor_count),
    motorKw: Number(p.motor_kw),
    isoKva: Number(p.iso_kva),
    propPf: Number(p.prop_pf) || 0.95,
    operationHours: Number(p.operation_hours) || 8,
    chargeHours: Number(p.charge_hours) || 6,
    fcStackKw: Number(p.fc_stack_kw) || 0,
    pvKwp: Number(p.pv_kwp) || 0,
    pvSunHours: Number(p.pv_sun_hours) || 4,
    essPeakThreshPct: Number(p.ess_peak_thresh_pct) || 75,
    essPeakDurMin: Number(p.ess_peak_dur_min) || 15,
    essSpinReserve: Boolean(p.ess_spin_reserve),
    createdAt: String(p.created_at),
    updatedAt: String(p.updated_at),
  }

  const loads: Load[] = lRes.rows.map(l0 => {
    const l = l0 as Record<string, unknown>
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
      dfSea: l.df_sea !== undefined ? Number(l.df_sea) : df,
      dfWork: l.df_work !== undefined ? Number(l.df_work) : df * 0.6,
      dfEmg: l.df_emg !== undefined ? Number(l.df_emg) : (Boolean(l.is_emergency) ? df : 0),
      dfArrival: l.df_arrival == null ? null : Number(l.df_arrival),
      dfHarbor:  l.df_harbor  == null ? null : Number(l.df_harbor),
      phase: String(l.phase) as Load['phase'],
      isEmergency: Boolean(l.is_emergency),
      isBattery: Boolean(l.is_battery),
      cableLength: Number(l.cable_length) || 0,
      location: String(l.location || ''),
      notes: String(l.notes || ''),
      sortOrder: Number(l.sort_order),
    }
  })

  const buses: Bus[] = bRes.rows.map(b0 => {
    const b = b0 as Record<string, unknown>
    return {
      id: String(b.id),
      projectId: String(b.project_id),
      tag: String(b.tag),
      name: String(b.name),
      type: String(b.type) as Bus['type'],
      voltage: Number(b.voltage),
      parentTag: String(b.parent_tag || ''),
      sortOrder: Number(b.sort_order),
    }
  })

  const result = runCalculation(project, loads, buses)
  const dt = new Date().toLocaleDateString('ko-KR')
  return { project, result, buses, dt }
}

export default async function SldPage({ params }: { params: { id: string } }) {
  const data = await load(params.id)

  if (!data) {
    return (
      <div style={{ padding: 40 }}>
        <h1>프로젝트를 찾을 수 없습니다.</h1>
        <Link href="/">← 대시보드로</Link>
      </div>
    )
  }

  return <SldViewer project={data.project} result={data.result} buses={data.buses} dt={data.dt} />
}
