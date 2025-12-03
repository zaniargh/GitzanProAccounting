"use client"

import { useEffect, useState } from "react"
import type { AppData } from "@/types"

export const STORAGE_KEY = "flour-accounting-data"

export const defaultData: AppData = {
  customers: [],
  customerGroups: [],
  transactions: [],
  productTypes: [],
  currencies: [],
  bankAccounts: [],
  bulkTransactions: [],
  documents: [],
  foreignTransactions: [],
  settings: {},
  lastUpdated: 0,
} as unknown as AppData

export function useLocalStorage() {
  const [data, setData] = useState<AppData>(defaultData)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      let fileData: AppData | null = null
      let localData: AppData | null = null

      // 1. Fetch from File DB
      try {
        const res = await fetch("/api/db", { cache: "no-store" })
        if (res.ok) {
          const db = await res.json()
          fileData = db?.app ?? null
        }
      } catch (e) {
        console.error("Failed to load from file DB", e)
      }

      // 2. Fetch from LocalStorage
      try {
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          if (raw) localData = JSON.parse(raw)
        }
      } catch (e) {
        console.error("Failed to load from localStorage", e)
      }

      if (cancelled) return

      // 3. Compare and Decide
      const fileTime = fileData?.lastUpdated || 0
      const localTime = localData?.lastUpdated || 0

      let finalData = defaultData

      if (fileData && (!localData || fileTime >= localTime)) {
        // File is newer or equal, or local is missing
        finalData = fileData
        // Sync to local
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(finalData))
        }
      } else if (localData && (!fileData || localTime > fileTime)) {
        // Local is newer
        finalData = localData
        // Sync to file (background)
        fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app: finalData }),
        }).catch(e => console.error("Background sync to file failed", e))
      } else if (localData) {
        // Fallback if fileData is null but localData exists (and logic above didn't catch it?)
        // Actually the second condition covers this: if (!fileData) localTime > fileTime (0) is true usually.
        // But if localTime is 0 and fileTime is 0, we might fall here?
        // Let's stick to the logic above.
        // If both are null, we use defaultData.
      }

      setData(finalData)
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const saveData = async (next: AppData) => {
    // Update timestamp
    const dataWithTimestamp = { ...next, lastUpdated: Date.now() }

    setData(dataWithTimestamp)

    // Save to LocalStorage
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithTimestamp))
      }
    } catch (e) {
      console.warn("localStorage save error:", e)
    }

    // Save to File DB
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: dataWithTimestamp }),
      })
    } catch (e) {
      console.error("file DB save error:", e)
    }
  }

  return { data, saveData, isLoading }
}