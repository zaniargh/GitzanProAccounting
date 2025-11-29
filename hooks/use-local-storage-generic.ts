"use client"

import { useEffect, useState } from "react"

/**
 * Drop-in replacement that first tries to read/write a local disk file (via Next.js API),
 * and falls back to browser localStorage.
 */
export function useLocalStorageGeneric<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Try server file first
      try {
        const res = await fetch(`/api/kv/${encodeURIComponent(key)}`, { cache: "no-store" })
        if (res.ok) {
          const { value } = await res.json()
          if (!cancelled && value !== null && value !== undefined) {
            setStoredValue(value as T)
            return
          }
        }
      } catch { /* ignore */ }

      // Fallback to browser storage
      try {
        const item = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
        if (item) {
          setStoredValue(JSON.parse(item))
          return
        }
      } catch { /* ignore */ }

      // if nothing found, keep initialValue
      if (!cancelled) setStoredValue(initialValue)
    }
    load()
    return () => { cancelled = true }
  }, [key])

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      // Save to browser as fallback
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
      // Save to file db
      fetch(`/api/kv/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: valueToStore }),
      }).catch(() => { })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`خطا در ذخیره ${key}:`, error)
      }
    }
  }

  return [storedValue, setValue] as const
}