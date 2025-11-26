
// app/api/db/route.ts
import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/server/file-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const db = await readDB()
  return NextResponse.json(db)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const current = await readDB()
  const next = { ...current, ...body }
  await writeDB(next)
  return NextResponse.json({ ok: true })
}
