export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import db, { initDb } from '@/lib/db'

type Ctx = { params: { projectId: string; loadId: string } }

export async function PUT(req:Request, {params}:Ctx) {
  await initDb()
  const b = await req.json()
  const df = Number(b.demandFactor)||0.8
  await db.execute({
    sql:`UPDATE loads SET
         circuit_no=?,name=?,from_bus=?,to_tag=?,
         kw=?,pf=?,efficiency=?,priority=?,start_type=?,
         demand_factor=?,df_sea=?,df_work=?,df_emg=?,
         phase=?,is_emergency=?,is_battery=?,cable_length=?,
         location=?,notes=?,updated_at=datetime('now')
         WHERE id=? AND project_id=?`,
    args:[
      b.circuitNo,b.name,b.fromBus,b.toTag,
      Number(b.kw),Number(b.pf),Number(b.efficiency),b.priority||'IMPORTANT',b.startType,
      df,
      b.dfSea!==undefined?Number(b.dfSea):df,
      b.dfWork!==undefined?Number(b.dfWork):df*0.6,
      b.dfEmg!==undefined?Number(b.dfEmg):(b.isEmergency?df:0),
      b.phase,b.isEmergency?1:0,b.isBattery?1:0,
      Number(b.cableLength)||0,
      b.location,b.notes,
      params.loadId,params.projectId
    ]
  })
  return NextResponse.json({success:true})
}

export async function DELETE(_:Request, {params}:Ctx) {
  await initDb()
  await db.execute({sql:'DELETE FROM loads WHERE id=? AND project_id=?',args:[params.loadId,params.projectId]})
  return NextResponse.json({success:true})
}
