
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

  let lastError: any = null

  // Retry up to 3 times
  for (let i = 0; i < 3; i++) {
    try {
      // Write to temporary file
      await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")

      // Try to replace the file
      try {
        // On Windows, we often need to remove the destination first
        try {
          await fs.unlink(p)
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            // If we can't delete it, it might be locked.
            // We'll try to overwrite it with copyFile below if rename fails,
            // or just let the next steps handle it.
            throw err
          }
        }

        await fs.rename(tmp, p)
        return // Success
      } catch (renameError) {
        // If rename failed, try copy as fallback
        await fs.copyFile(tmp, p)
        await fs.unlink(tmp)
        return // Success
      }
    } catch (error) {
      lastError = error
      // Clean up temp file
      try {
        await fs.unlink(tmp)
      } catch { }

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  throw lastError || new Error("Failed to write database file after retries")
}
