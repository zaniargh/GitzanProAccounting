
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

    // On Windows, rename can fail. Try multiple approaches
    let success = false
    let lastError: any = null

    // Approach 1: Try direct rename after deleting target
    try {
      try {
        await fs.unlink(p)
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err
        }
      }
      await fs.rename(tmp, p)
      success = true
    } catch (err: any) {
      lastError = err
      // Continue to next approach
    }

    // Approach 2: If rename failed, try copy + delete
    if (!success) {
      try {
        // Try to unlink again (maybe it was locked before)
        try {
          await fs.unlink(p)
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            // File exists but can't delete - try copying over it anyway
          }
        }

        // Copy temp file to target
        await fs.copyFile(tmp, p)

        // Delete temp file
        await fs.unlink(tmp)
        success = true
      } catch (err: any) {
        lastError = err
      }
    }

    if (!success) {
      throw lastError || new Error("Failed to write database file")
    }
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
