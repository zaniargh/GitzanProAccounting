// lib/server/db-path.ts
import os from "os"
import path from "path"
import fs from "fs/promises"

export function getDBDir() {
  const home = os.homedir()
  const winBase = process.env.APPDATA || path.join(home, "AppData", "Roaming")
  const dir =
    process.platform === "win32"
      ? path.join(winBase, "Adrom", "FlourAccounting")
      : path.join(home, ".adrom", "flour-accounting")
  return dir
}

export async function ensureDir() {
  const dir = getDBDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function getDBPath() {
  const dir = await ensureDir()
  return path.join(dir, "app-data.json")
}