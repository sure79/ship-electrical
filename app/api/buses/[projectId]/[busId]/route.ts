export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import db, { initDb } from '@/lib/db'

type Ctx = { params: { projectId: string; busId: string } }

export async function PUT(req:Request, {params}:Ctx) {
  await initDb()
  const b = await req.json()
  await db.execute({
    sql:'UPDATE buses SET tag=?,name=?,type=?,voltage=?,parent_tag=? WHERE id=? AND project_id=?',
    args:[b.tag,b.name,b.type,b.voltage,b.parentTag||'',params.busId,params.projectId]
  })
  return NextResponse.json({success:true})
}

export async function DELETE(_:Request, {params}:Ctx) {
  await initDb()
  await db.execute({sql:'DELETE FROM buses WHERE id=? AND project_id=?',args:[params.busId,params.projectId]})
  return NextResponse.json({success:true})
}
