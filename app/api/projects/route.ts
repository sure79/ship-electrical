export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import db, { initDb } from '@/lib/db'

export async function GET() {
  try {
  await initDb()
  const res = await db.execute('SELECT * FROM projects ORDER BY updated_at DESC')
  const projects = res.rows.map(r => {
    const pt = String(r.power_type || 'DG')
    const legacyHasDg = !['BATTERY','FUELCELL','SOLAR','SHORE'].includes(pt)
    return {
      id:r.id, vesselName:r.vessel_name, hullNo:r.hull_no, projectNo:r.project_no,
      classCode:r.class_code, acVoltage:r.ac_voltage, frequency:r.frequency,
      dgCount:r.dg_count,
      hasDg:    r.has_dg !== undefined ? Boolean(r.has_dg) : legacyHasDg,
      hasEg:    Boolean(r.has_eg),
      hasEss:   Boolean(r.has_ess),
      hasFc:    Boolean(r.has_fc),
      hasPv:    Boolean(r.has_pv),
      hasShore: Boolean(r.has_shore),
      hasDc:    Boolean(r.has_dc),
      createdAt:r.created_at, updatedAt:r.updated_at,
    }
  })
  return NextResponse.json({ projects })
  } catch(e: unknown) {
    const msg = e instanceof Error ? e.message + '\n' + e.stack : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  await initDb()
  const b = await req.json()
  const id = uuid()
  const hasDg = b.hasDg !== false
  const powerType =
    b.powerType ||
    (hasDg ? 'DG'
      : b.hasEss ? 'BATTERY'
      : b.hasFc ? 'FUELCELL'
      : b.hasPv ? 'SOLAR'
      : b.hasShore ? 'SHORE'
      : 'DG')
  await db.execute({
    sql: `INSERT INTO projects
          (id,vessel_name,hull_no,project_no,class_code,
           ac_voltage,frequency,power_type,has_dg,has_eg,has_ess,has_fc,has_pv,has_shore,has_dc,
           dg_count,dg_pf,design_margin,
           ess_backup_h,ess_margin,ess_peak_thresh_pct,ess_peak_dur_min,ess_spin_reserve,
           dc_voltage,motor_count,motor_kw,iso_kva,
           operation_hours,charge_hours,fc_stack_kw,pv_kwp,pv_sun_hours)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, b.vesselName||'신규 선박', b.hullNo||'', b.projectNo||'',
      b.classCode||'KR', b.acVoltage||220, b.frequency||60,
      powerType, hasDg?1:0, b.hasEg?1:0, b.hasEss?1:0, b.hasFc?1:0, b.hasPv?1:0, b.hasShore?1:0, b.hasDc?1:0,
      b.dgCount||1, b.dgPf||0.8, b.designMargin||0.25,
      b.essBackupH||0.5, b.essMargin||0.20, b.essPeakThreshPct||75, b.essPeakDurMin||15, b.essSpinReserve?1:0,
      b.dcVoltage||650, b.motorCount||2, b.motorKw||150, b.isoKva||200,
      b.operationHours||8, b.chargeHours||6, b.fcStackKw||0,
      b.pvKwp||0, b.pvSunHours||4,
    ]
  })
  // 기본 버스 자동 생성
  await db.execute({
    sql:`INSERT INTO buses (id,project_id,tag,name,type,voltage,parent_tag,sort_order)
         VALUES (?,?,?,?,?,?,?,?)`,
    args:[uuid(),id,'MSB','Main Switchboard','AC-BUS',b.acVoltage||220,'',0]
  })
  if(b.hasEg) {
    await db.execute({
      sql:`INSERT INTO buses (id,project_id,tag,name,type,voltage,parent_tag,sort_order)
           VALUES (?,?,?,?,?,?,?,?)`,
      args:[uuid(),id,'ESB','Emergency Switchboard','EMERGENCY',b.acVoltage||220,'',1]
    })
  }
  if(b.hasEss) {
    await db.execute({
      sql:`INSERT INTO buses (id,project_id,tag,name,type,voltage,parent_tag,sort_order)
           VALUES (?,?,?,?,?,?,?,?)`,
      args:[uuid(),id,'ESS','ESS DC Bus','DC-BUS',b.dcVoltage||650,'',2]
    })
  }
  return NextResponse.json({ id, success:true }, {status:201})
}
