
// lib/server/file-db.ts
import fs from "fs/promises"
import { getDBPath } from "./db-path"

export type DBShape = {
  customers: any[]
  customerGroups: any[]
  transactions: any[]
  documents: any[]
  flourTypes: any[]
  bulkTransactions: any[]
  bulkTransactionsTehran: any[]
  snapshots?: any
  backupInfo?: any
}

const DEFAULT_DB: DBShape = {
  customers: [],
  customerGroups: [],
  transactions: [],
  documents: [],
  flourTypes: [],
  bulkTransactions: [],
  bulkTransactionsTehran: [],
  snapshots: undefined,
  backupInfo: undefined,
}

export async function readDB(): Promise<DBShape> {
  const p = await getDBPath()
  try {
    const raw = await fs.readFile(p, "utf8")
    const data = JSON.parse(raw)
    return { ...DEFAULT_DB, ...data }
  } catch {
    return { ...DEFAULT_DB }
  }
}

export async function writeDB(db: DBShape): Promise<void> {
  const p = await getDBPath()
  const tmp = p + ".tmp"

  try {
    // Write to temporary file
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")

    // On Windows, we need to delete the target file first if it exists
    try {
      await fs.unlink(p)
    } catch (err: any) {
      // Ignore if file doesn't exist
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

    // Rename temp to final
    await fs.rename(tmp, p)
  } catch (error) {
    // Clean up temp file if something goes wrong
    try {
      await fs.unlink(tmp)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}
