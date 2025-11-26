
// app/api/kv/[key]/route.ts
import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/server/file-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: { key: string } }

export async function GET(_req: Request, ctx: Ctx) {
  const db = await readDB()
  const val = (db as any)[ctx.params.key] ?? null
  return NextResponse.json({ key: ctx.params.key, value: val })
}

export async function POST(req: Request, ctx: Ctx) {
  const { value } = await req.json().catch(() => ({ value: null }))
  const db = await readDB()
  const next = { ...db, [ctx.params.key]: value }
  await writeDB(next)
  return NextResponse.json({ ok: true })
}
