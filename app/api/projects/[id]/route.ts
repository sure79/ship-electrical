export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import db, { initDb } from '@/lib/db'

type Ctx = { params: { id: string } }

function mapProject(p: Record<string,unknown>) {
  // 기존 powerType → hasDg 변환 (마이그레이션 호환)
  const pt = String(p.power_type||'DG')
  const legacyHasDg = !['BATTERY','FUELCELL','SOLAR','SHORE'].includes(pt)
  return {
    id:p.id, vesselName:p.vessel_name, hullNo:p.hull_no, projectNo:p.project_no,
    classCode:p.class_code, acVoltage:Number(p.ac_voltage), frequency:Number(p.frequency),
    hasDg:   p.has_dg!==undefined ? Boolean(p.has_dg) : legacyHasDg,
    hasEg:   Boolean(p.has_eg),
    hasEss:  Boolean(p.has_ess),
    hasFc:   Boolean(p.has_fc),
    hasPv:   Boolean(p.has_pv),
    hasShore:Boolean(p.has_shore),
    hasDc:   Boolean(p.has_dc),
    dgCount: Number(p.dg_count), dgPf:Number(p.dg_pf), designMargin:Number(p.design_margin),
    dgXd:    Number(p.dg_xd)||0.15,
    essBackupH:Number(p.ess_backup_h), essMargin:Number(p.ess_margin),
    essPeakThreshPct:Number(p.ess_peak_thresh_pct)||75,
    essPeakDurMin:Number(p.ess_peak_dur_min)||15,
    essSpinReserve:Boolean(p.ess_spin_reserve),
    dcVoltage:Number(p.dc_voltage), motorCount:Number(p.motor_count),
    motorKw:Number(p.motor_kw), isoKva:Number(p.iso_kva),
    propPf:Number(p.prop_pf)||0.95,
    operationHours:Number(p.operation_hours)||8,
    chargeHours:Number(p.charge_hours)||6,
    fcStackKw:Number(p.fc_stack_kw)||0,
    pvKwp:Number(p.pv_kwp)||0, pvSunHours:Number(p.pv_sun_hours)||4,
    // ELA 확장
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
    createdAt:p.created_at, updatedAt:p.updated_at,
  }
}

function mapLoad(l: Record<string,unknown>) {
  return {
    id:l.id, projectId:l.project_id, circuitNo:l.circuit_no, name:l.name,
    fromBus:l.from_bus, toTag:l.to_tag, kw:Number(l.kw), pf:Number(l.pf),
    efficiency:Number(l.efficiency), priority:String(l.priority||'IMPORTANT'), startType:l.start_type, demandFactor:Number(l.demand_factor),
    dfSea: l.df_sea!==undefined ? Number(l.df_sea) : Number(l.demand_factor),
    dfArrival: l.df_arrival==null ? null : Number(l.df_arrival),
    dfWork:l.df_work!==undefined ? Number(l.df_work) : 0,
    dfHarbor: l.df_harbor==null ? null : Number(l.df_harbor),
    dfEmg: l.df_emg!==undefined ? Number(l.df_emg) : 0,
    phase:l.phase, isEmergency:Boolean(l.is_emergency), isBattery:Boolean(l.is_battery),
    cableLength:Number(l.cable_length)||0,
    location:l.location, notes:l.notes, sortOrder:Number(l.sort_order),
    // ELA 확장
    loadKind: String(l.load_kind || 'continuous'),
    quantity: Number(l.quantity) || 1,
    startingMultiplier: Number(l.starting_multiplier) || 1,
    isSheddable: Boolean(l.is_sheddable),
    shedPriority: Number(l.shed_priority) || 0,
  }
}

export async function GET(_:Request, {params}:Ctx) {
  await initDb()
  const {id} = params
  const [proj,buses,loads,calcRes] = await Promise.all([
    db.execute({sql:'SELECT * FROM projects WHERE id=?',args:[id]}),
    db.execute({sql:'SELECT * FROM buses WHERE project_id=? ORDER BY sort_order',args:[id]}),
    db.execute({sql:'SELECT * FROM loads WHERE project_id=? ORDER BY sort_order',args:[id]}),
    db.execute({sql:'SELECT result_json,sld_xml,calculated_at FROM calc_results WHERE project_id=? ORDER BY calculated_at DESC LIMIT 1',args:[id]}),
  ])
  if(!proj.rows[0]) return NextResponse.json({error:'Not found'},{status:404})

  return NextResponse.json({
    project: mapProject(proj.rows[0] as Record<string,unknown>),
    buses: buses.rows.map(b=>({
      id:b.id, projectId:b.project_id, tag:b.tag, name:b.name,
      type:b.type, voltage:Number(b.voltage), parentTag:b.parent_tag, sortOrder:Number(b.sort_order)
    })),
    loads: loads.rows.map(l=>mapLoad(l as Record<string,unknown>)),
    calcResult: calcRes.rows[0] ? JSON.parse(String(calcRes.rows[0].result_json)) : null,
    sldXml: calcRes.rows[0]?.sld_xml ?? null,
    calculatedAt: calcRes.rows[0]?.calculated_at ?? null,
  })
}

export async function PUT(req:Request, {params}:Ctx) {
  await initDb()
  const b = await req.json()
  await db.execute({
    sql:`UPDATE projects SET
         vessel_name=?,hull_no=?,project_no=?,class_code=?,
         ac_voltage=?,frequency=?,
         has_dg=?,has_eg=?,has_ess=?,has_fc=?,has_pv=?,has_shore=?,has_dc=?,
         dg_count=?,dg_pf=?,design_margin=?,dg_xd=?,
         ess_backup_h=?,ess_margin=?,ess_peak_thresh_pct=?,ess_peak_dur_min=?,ess_spin_reserve=?,
         dc_voltage=?,motor_count=?,motor_kw=?,iso_kva=?,prop_pf=?,
         operation_hours=?,charge_hours=?,fc_stack_kw=?,
         pv_kwp=?,pv_sun_hours=?,
         dg_kva_rated=?,eg_kva_rated=?,eg_pf=?,
         run_count_sea=?,run_count_arrival=?,run_count_cargo=?,run_count_harbor=?,
         div_factor_sea=?,div_factor_arrival=?,div_factor_cargo=?,div_factor_harbor=?,
         updated_at=datetime('now') WHERE id=?`,
    args:[
      b.vesselName,b.hullNo,b.projectNo,b.classCode,
      b.acVoltage,b.frequency,
      b.hasDg?1:0,b.hasEg?1:0,b.hasEss?1:0,b.hasFc?1:0,b.hasPv?1:0,b.hasShore?1:0,b.hasDc?1:0,
      b.dgCount,b.dgPf,b.designMargin,b.dgXd||0.15,
      b.essBackupH,b.essMargin,b.essPeakThreshPct||75,b.essPeakDurMin||15,b.essSpinReserve?1:0,
      b.dcVoltage,b.motorCount,b.motorKw,b.isoKva,b.propPf||0.95,
      b.operationHours||8,b.chargeHours||6,b.fcStackKw||0,
      b.pvKwp||0,b.pvSunHours||4,
      Number(b.dgKvaRated)||0, Number(b.egKvaRated)||0, Number(b.egPf)||0.8,
      Number(b.runCountSea)||1, Number(b.runCountArrival)||2, Number(b.runCountCargo)||2, Number(b.runCountHarbor)||1,
      Number(b.divFactorSea)||1.8, Number(b.divFactorArrival)||1.8, Number(b.divFactorCargo)||1.8, Number(b.divFactorHarbor)||1.8,
      params.id
    ]
  })
  return NextResponse.json({success:true})
}

export async function DELETE(_:Request, {params}:Ctx) {
  await initDb()
  await db.execute({sql:'DELETE FROM projects WHERE id=?',args:[params.id]})
  return NextResponse.json({success:true})
}
