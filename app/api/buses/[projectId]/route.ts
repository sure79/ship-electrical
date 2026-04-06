export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import db, { initDb } from '@/lib/db'

type Ctx = { params: { projectId: string } }

export async function GET(_:Request, {params}:Ctx) {
  await initDb()
  const res = await db.execute({
    sql:'SELECT * FROM buses WHERE project_id=? ORDER BY sort_order',
    args:[params.projectId]
  })
  return NextResponse.json({ buses: res.rows })
}

export async function POST(req:Request, {params}:Ctx) {
  await initDb()
  const b = await req.json()
  const id = uuid()
  const cnt = await db.execute({sql:'SELECT COUNT(*) as c FROM buses WHERE project_id=?',args:[params.projectId]})
  const ord = Number(cnt.rows[0]?.c ?? 0)
  await db.execute({
    sql:`INSERT INTO buses (id,project_id,tag,name,type,voltage,parent_tag,sort_order)
         VALUES (?,?,?,?,?,?,?,?)`,
    args:[id,params.projectId,b.tag,b.name,b.type,b.voltage||220,b.parentTag||'',ord]
  })
  return NextResponse.json({id,success:true},{status:201})
}
