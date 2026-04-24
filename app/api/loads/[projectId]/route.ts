export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import db, { initDb } from '@/lib/db'

type Ctx = { params: { projectId: string } }

function mapLoad(l: Record<string,unknown>) {
  return {
    id:l.id, projectId:l.project_id, circuitNo:l.circuit_no, name:l.name,
    fromBus:l.from_bus, toTag:l.to_tag, kw:Number(l.kw), pf:Number(l.pf),
    efficiency:Number(l.efficiency), priority:String(l.priority||'IMPORTANT'), startType:l.start_type, demandFactor:Number(l.demand_factor),
    dfSea: l.df_sea!==undefined ? Number(l.df_sea) : Number(l.demand_factor),
    dfWork:l.df_work!==undefined ? Number(l.df_work) : 0,
    dfEmg: l.df_emg!==undefined ? Number(l.df_emg) : 0,
    // 4-scenario: NULL이면 미입력 표시, 계산 시 해당 모드는 0으로 처리
    dfArrival: l.df_arrival==null ? null : Number(l.df_arrival),
    dfHarbor:  l.df_harbor ==null ? null : Number(l.df_harbor),
    phase:l.phase, isEmergency:Boolean(l.is_emergency), isBattery:Boolean(l.is_battery),
    cableLength:Number(l.cable_length)||0,
    location:l.location, notes:l.notes, sortOrder:Number(l.sort_order)
  }
}

export async function GET(_:Request, {params}:Ctx) {
  await initDb()
  const res = await db.execute({
    sql:'SELECT * FROM loads WHERE project_id=? ORDER BY sort_order,created_at',
    args:[params.projectId]
  })
  return NextResponse.json({ loads: res.rows.map(l=>mapLoad(l as Record<string,unknown>)) })
}

export async function POST(req:Request, {params}:Ctx) {
  await initDb()
  const b = await req.json()
  const {searchParams} = new URL(req.url)
  const action = searchParams.get('action')

  const insertLoad = async(ld:Record<string,unknown>, ord:number) => {
    const id = uuid()
    const df = Number(ld.demandFactor)||Number(ld.demand_factor)||0.8
    // dfArrival / dfHarbor: null 또는 숫자 전달 가능 (미입력 구분)
    const dfArrival = ld.dfArrival==null || ld.dfArrival==='' ? null : Number(ld.dfArrival)
    const dfHarbor  = ld.dfHarbor ==null || ld.dfHarbor ==='' ? null : Number(ld.dfHarbor)
    await db.execute({
      sql:`INSERT INTO loads
           (id,project_id,circuit_no,name,from_bus,to_tag,
            kw,pf,efficiency,priority,start_type,demand_factor,df_sea,df_work,df_emg,
            df_arrival,df_harbor,
            phase,is_emergency,is_battery,cable_length,location,notes,sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args:[
        id,params.projectId,String(ld.circuitNo||''),String(ld.name||''),String(ld.fromBus||'MSB'),String(ld.toTag||''),
        Number(ld.kw)||0,Number(ld.pf)||0.85,Number(ld.efficiency)||0.88,String(ld.priority||'IMPORTANT'),
        String(ld.startType||'DOL'),df,
        ld.dfSea!==undefined?Number(ld.dfSea):df,
        ld.dfWork!==undefined?Number(ld.dfWork):0,
        ld.dfEmg!==undefined?Number(ld.dfEmg):0,
        dfArrival, dfHarbor,
        String(ld.phase||'3P'),
        ld.isEmergency?1:0, ld.isBattery?1:0,
        Number(ld.cableLength)||0,
        String(ld.location||''),String(ld.notes||''),ord
      ]
    })
    return id
  }

  if(action==='csv-import' && Array.isArray(b.loads)) {
    const ids:string[] = []
    for(let i=0;i<b.loads.length;i++) ids.push(await insertLoad(b.loads[i],i))
    return NextResponse.json({ids,success:true},{status:201})
  }

  const cnt = await db.execute({sql:'SELECT COUNT(*) as c FROM loads WHERE project_id=?',args:[params.projectId]})
  const ord = Number(cnt.rows[0]?.c??0)
  const id  = await insertLoad(b, ord)
  return NextResponse.json({id,success:true},{status:201})
}
