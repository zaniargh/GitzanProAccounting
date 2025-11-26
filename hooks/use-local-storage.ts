"use client"

import { useEffect, useState } from "react"
import type { AppData } from "@/types"

export const STORAGE_KEY = "flour-accounting-data"

// NOTE: defaultData kept as-is from your project (trimmed for brevity here)
export const defaultData: AppData = {
  customers: [],
  customerGroups: [],
  transactions: [],
  flourTypes: [],
  currencies: [],
  bulkTransactions: [],
  documents: [],
  settings: {},
} as unknown as AppData

export function useLocalStorage() {
  const [data, setData] = useState<AppData>(defaultData)
  const [isLoading, setIsLoading] = useState(true)

  // 1) Try to load from local file DB via API; fallback to browser localStorage
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/db", { cache: "no-store" })
        if (res.ok) {
          const db = await res.json()
          const app: AppData | null = db?.app ?? null
          if (!cancelled && app) {
            setData(app)
            setIsLoading(false)
            return
          }
        }
      } catch {
        // ignore and fallback
      }
      // Fallback to browser localStorage
      try {
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          if (raw) setData(JSON.parse(raw))
        }
      } catch (e) {
        console.error("useLocalStorage fallback error:", e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // 2) Save both to file DB (server API) and localStorage (fallback)
  const saveData = async (next: AppData) => {
    setData(next)
    // Save to browser as secondary backup
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
    } catch (e) {
      console.warn("localStorage save error:", e)
    }
    // Save to file on disk through API
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: next }),
      })
    } catch (e) {
      console.error("file DB save error:", e)
    }
  }

  return { data, saveData, isLoading }
}