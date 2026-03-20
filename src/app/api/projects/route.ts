import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { desc } from "drizzle-orm";

// GET /api/projects — 프로젝트 목록 (최근 20개)
export async function GET() {
  try {
    const list = await db
      .select({
        id: projects.id,
        name: projects.name,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(20);
    return NextResponse.json(list);
  } catch (error) {
    console.error("DB 오류:", error);
    return NextResponse.json([], { status: 200 }); // DB 미설정 시 빈 목록 반환
  }
}

// POST /api/projects — 새 프로젝트 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, data } = body;
    const now = new Date().toISOString();
    await db.insert(projects).values({
      id,
      name,
      data,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("저장 오류:", error);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
