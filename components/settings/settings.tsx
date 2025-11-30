"use client"
import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import type { AppData, ProductType, BulkTransaction } from "@/types"

import { useLang } from "@/components/language-provider"

// -------------------- Types & Props --------------------
type SettingsProps = { data: AppData; onDataChange: (d: AppData) => void }

// -------------------- Helpers --------------------
function safeParse<T = any>(key: string): T | null {
    try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

// -------------------- Component --------------------
export default function Settings({ data, onDataChange }: SettingsProps) {
    const { lang } = useLang()
    const fileRef = useRef<HTMLInputElement | null>(null)
    const [isBackingUp, setIsBackingUp] = useState(false)

    // LocalStorage mirrors (used for stats/fallbacks)
    const [lsProductTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])
    const [lsBulk] = useLocalStorageGeneric<BulkTransaction[]>("bulkTransactions", [])
    const [lsBulkTehran] = useLocalStorageGeneric<any[]>("bulkTransactionsTehran", [])

    // -------------------- Stats (UI cards) --------------------
    const stats = useMemo(() => {
        const transactions = data.transactions || []
        const customers = data.customers || []

        let dollarReceivable = 0 // طلب نقدی دلاری (اعداد مثبت)
        let dollarPayable = 0 // بدهی نقدی دلاری (اعداد منفی)

        const allCustomers = [...customers]

        // محاسبه بدهی هر مشتری (شامل حساب‌های هزینه)
        allCustomers.forEach((customer) => {
            let cashDebt = 0

            transactions.forEach((transaction) => {
                if (transaction.customerId === customer.id) {
                    const amount = transaction.amount || 0

                    // محاسبه بدهی دلاری
                    if (
                        transaction.type === "product_purchase" ||
                        transaction.type === "cash_out" ||
                        transaction.type === "expense"
                    ) {
                        cashDebt += amount
                    } else if (transaction.type === "product_sale" || transaction.type === "cash_in") {
                        cashDebt -= amount
                    }


                }
            })

            if (cashDebt > 0) dollarReceivable += cashDebt
            else if (cashDebt < 0) dollarPayable += Math.abs(cashDebt)
        })

        return {
            customers: customers.length,
            customerGroups: data.customerGroups?.length || 0,
            transactions: transactions.length,
            productTypes: (lsProductTypes?.length ?? 0) || data.productTypes?.length || 0,
            bulkTransactions: (lsBulk?.length ?? 0) || data.bulkTransactions?.length || 0,
            dollarReceivable,
            dollarPayable,
        }
    }, [data, lsProductTypes, lsBulk])

    // -------------------- Backup --------------------
    const handleBackup = () => {
        setIsBackingUp(true)
        try {
            const app = (safeParse<AppData>("flour-accounting-data") as Partial<AppData>) || {}

            // همیشه اولویت با localStorage جاری است؛ اگر نبود از app استفاده می‌کنیم
            const lsPT = safeParse<ProductType[]>("productTypes") || []
            const lsBulkLocal = safeParse<BulkTransaction[]>("bulkTransactions") || []
            const lsBulkTehranLocal = safeParse<any[]>("bulkTransactionsTehran") || []
            const lsDocs = safeParse<any[]>("documents") || []

            const customers = Array.isArray(app.customers) ? app.customers : data.customers || []
            const transactions = Array.isArray(app.transactions) ? app.transactions : data.transactions || []

            // --- بدهی مشتریان بر اساس تراکنش‌ها ---
            const customersWithDebts = customers.map((customer) => {
                let cashDebt = 0
                let productDebt = 0

                // محاسبه بدهی‌ها فقط از subdocuments
                transactions.forEach((t) => {
                    // Skip main documents
                    if (t.isMainDocument) return

                    if (t.customerId === customer.id) {
                        const amount = t.amount || 0
                        const w = t.weight || 0

                        if (t.type === "product_purchase" || t.type === "cash_out" || t.type === "expense" || t.type === "cash_in") cashDebt += amount
                        else if (t.type === "product_sale") cashDebt -= amount

                        if (t.type === "product_in") productDebt += w
                        else if (t.type === "product_out") productDebt -= w
                    }
                })

                return { ...customer, cashDebt, productDebt }
            })

            // --- Snapshots for full-fidelity backups ---
            function computeSnapshots(appData: AppData) {
                const tx = appData.transactions || []
                const productTypes = appData.productTypes || []

                // Cash Inventory Snapshot (دلار)
                let totalCashCredit = 0
                let totalCashDebt = 0
                    ; (appData.customers || []).forEach((c) => {
                        const cTx = tx.filter((t) => t.customerId === c.id)
                        let cashBalance = 0
                        cTx.forEach((t) => {
                            switch (t.type) {
                                case "product_purchase":
                                    cashBalance -= t.amount || 0
                                    break
                                case "product_sale":
                                    cashBalance += t.amount || 0
                                    break
                                case "cash_in":
                                    cashBalance -= t.amount || 0
                                    break
                                case "cash_out":
                                    cashBalance += t.amount || 0
                                    break
                                case "expense":
                                    cashBalance -= t.amount || 0
                                    break
                                default:
                                    break
                            }
                        })
                        if (cashBalance > 0) totalCashCredit += cashBalance
                        else if (cashBalance < 0) totalCashDebt += Math.abs(cashBalance)
                    })
                const cashInventory = { totalCashCredit, totalCashDebt }

                // Product Inventory Snapshot (طلب/بدهی محصول)
                const productInventory: Record<string, { credit: number; debt: number }> = {}
                productTypes.forEach((pt) => {
                    productInventory[pt.id] = { credit: 0, debt: 0 }
                })
                tx.forEach((t) => {
                    if (!t.productTypeId || !productInventory[t.productTypeId]) return
                    const w = t.weight || 0
                    switch (t.type) {
                        case "product_purchase":
                            productInventory[t.productTypeId].credit += w
                            break
                        case "product_in":
                            productInventory[t.productTypeId].credit -= w
                            break
                        case "product_sale":
                            productInventory[t.productTypeId].debt += w
                            break
                        case "product_out":
                            productInventory[t.productTypeId].debt -= w
                            break
                    }
                })

                // Warehouse Snapshot (موجودی مخزن)
                const warehouseInventory: Record<string, number> = {}
                productTypes.forEach((pt) => {
                    warehouseInventory[pt.id] = 0
                })
                tx.forEach((t) => {
                    if (!t.productTypeId || warehouseInventory[t.productTypeId] === undefined) return
                    const w = t.weight || 0
                    switch (t.type) {
                        case "product_purchase":
                        case "product_in":
                            warehouseInventory[t.productTypeId] += w
                            break
                        case "product_sale":
                        case "product_out":
                            warehouseInventory[t.productTypeId] -= w
                            break
                    }
                })

                return { cashInventory, productInventory, warehouseInventory }
            }

            // --- Build backupData with LS-first policy ---
            const backupData = {
                customers: customersWithDebts,
                customerGroups: Array.isArray(app.customerGroups) ? app.customerGroups : data.customerGroups || [],
                transactions: transactions,
                documents: Array.isArray(app.documents) ? app.documents : lsDocs,
                productTypes: Array.isArray(lsPT) && lsPT.length ? lsPT : Array.isArray(app.productTypes) ? app.productTypes : [],
                bulkTransactions:
                    Array.isArray(lsBulkLocal) && lsBulkLocal.length
                        ? lsBulkLocal
                        : Array.isArray(app.bulkTransactions)
                            ? app.bulkTransactions
                            : [],
                bulkTransactionsTehran:
                    Array.isArray(lsBulkTehranLocal) && lsBulkTehranLocal.length
                        ? lsBulkTehranLocal
                        : Array.isArray(app.bulkTransactionsTehran)
                            ? app.bulkTransactionsTehran
                            : [],
                currencies: Array.isArray(app.currencies) ? app.currencies : data.currencies || [],
                bankAccounts: Array.isArray(app.bankAccounts) ? app.bankAccounts : data.bankAccounts || [],
            } as AppData & { backupInfo?: any; snapshots?: any }

            backupData.snapshots = computeSnapshots(backupData)
            backupData.backupInfo = {
                createdAt: new Date().toISOString(),
                origin: typeof location !== "undefined" ? location.origin : "",
                version: "1.3",
                totalRecords: {
                    customers: backupData.customers?.length || 0,
                    transactions: backupData.transactions?.length || 0,
                    bulkTransactions: (backupData as any).bulkTransactions?.length || 0,
                    bulkTransactionsTehran: (backupData as any).bulkTransactionsTehran?.length || 0,
                    productTypes: backupData.productTypes?.length || 0,
                },
            }

            // --- Stable download (avoid Unconfirmed *.crdownload) ---
            const filename = `flour-accounting-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 10000)

            alert(
                `بک‌اپ کامل ایجاد شد!
${backupData.backupInfo.totalRecords.customers} مشتری
${backupData.backupInfo.totalRecords.transactions} سند
${backupData.backupInfo.totalRecords.bulkTransactions} معامله 100 تنی
${backupData.backupInfo.totalRecords.productTypes} نوع آرد`,
            )
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error("خطا در ایجاد بک‌آپ:", e)
            }
            alert("خطا در ایجاد بک‌آپ")
        } finally {
            setIsBackingUp(false)
        }
    }

    // -------------------- Sync Now (LS-first) --------------------
    const handleSyncNow = async () => {
        try {
            const app = (safeParse<AppData>("flour-accounting-data") as Partial<AppData>) || {}
            const lsPT = safeParse<ProductType[]>("productTypes") || []
            const lsBulkLocal = safeParse<BulkTransaction[]>("bulkTransactions") || []
            const lsBulkTehranLocal = safeParse<any[]>("bulkTransactionsTehran") || []
            const lsDocs = safeParse<any[]>("documents") || []

            const payload: Partial<AppData> & { backupInfo?: any } = {
                customers: Array.isArray(app.customers) ? app.customers : data.customers || [],
                customerGroups: Array.isArray(app.customerGroups) ? app.customerGroups : data.customerGroups || [],
                transactions: Array.isArray(app.transactions) ? app.transactions : data.transactions || [],
                documents: Array.isArray(app.documents) ? app.documents : lsDocs,
                productTypes: Array.isArray(lsPT) && lsPT.length ? lsPT : Array.isArray(app.productTypes) ? app.productTypes : [],
                bulkTransactions:
                    Array.isArray(lsBulkLocal) && lsBulkLocal.length
                        ? lsBulkLocal
                        : Array.isArray(app.bulkTransactions)
                            ? app.bulkTransactions
                            : [],
                bulkTransactionsTehran:
                    Array.isArray(lsBulkTehranLocal) && lsBulkTehranLocal.length
                        ? lsBulkTehranLocal
                        : Array.isArray(app.bulkTransactionsTehran)
                            ? app.bulkTransactionsTehran
                            : [],
                backupInfo: {
                    syncedAt: new Date().toISOString(),
                    origin: typeof location !== "undefined" ? location.origin : "",
                    via: "Settings.handleSyncNow",
                },
            }

            const res = await fetch("/api/db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error("Sync failed")

            alert("همگام‌سازی با AppData با موفقیت انجام شد ✅")
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error("sync error:", e)
            }
            alert("خطا در همگام‌سازی با AppData")
        }
    }

    // -------------------- Restore (Purge → Write → Render → Overwrite AppData) --------------------
    const handleRestore = async (file: File) => {
        try {
            const text = await file.text()
            const restored = JSON.parse(text) as any

            // بررسی صحت فایل بک‌آپ
            if (!restored.customers && !restored.transactions) {
                throw new Error("فایل بک‌آپ نامعتبر است")
            }

            const restoredData: AppData = {
                customers: Array.isArray(restored.customers) ? restored.customers : [],
                customerGroups: Array.isArray(restored.customerGroups) ? restored.customerGroups : [],
                transactions: Array.isArray(restored.transactions) ? restored.transactions : [],
                documents: Array.isArray(restored.documents) ? restored.documents : [],
                productTypes: Array.isArray(restored.productTypes) ? restored.productTypes : [],
                bulkTransactions: Array.isArray(restored.bulkTransactions) ? restored.bulkTransactions : [],
                bulkTransactionsTehran: Array.isArray(restored.bulkTransactionsTehran) ? restored.bulkTransactionsTehran : [],
                currencies: Array.isArray(restored.currencies) ? restored.currencies : [],
                bankAccounts: Array.isArray(restored.bankAccounts) ? restored.bankAccounts : [],
            }

            // --- 1) Purge any previous data to avoid merge/ghost records ---
            const KEYS_TO_CLEAR = [
                "productTypes",
                "bulkTransactions",
                "bulkTransactionsTehran",
                "documents",
                "flour-accounting-data",
                // در صورت استفاده‌ی قدیمی از این کلیدها
                "customers",
                "transactions",
                "customerGroups",
            ]
            KEYS_TO_CLEAR.forEach((k) => {
                try {
                    if (typeof window !== "undefined" && window.localStorage) {
                        localStorage.removeItem(k)
                    }
                } catch { }
            })

            // --- 2) Write fresh values to localStorage (LS-first contract) ---
            const setLocalStorageItem = (key: string, value: any) => {
                try {
                    if (typeof window !== "undefined" && window.localStorage) {
                        localStorage.setItem(key, JSON.stringify(value))
                    }
                } catch (e) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(`نتوانست ${key} را در localStorage ذخیره کند:`, e)
                    }
                }
            }

            setLocalStorageItem("productTypes", restoredData.productTypes)
            setLocalStorageItem("bulkTransactions", restoredData.bulkTransactions)
            setLocalStorageItem("bulkTransactionsTehran", restoredData.bulkTransactionsTehran)
            setLocalStorageItem("documents", restoredData.documents)

            // مهم: اسنپ‌شات اصلی که بسیاری از مسیرها از آن می‌خوانند
            setLocalStorageItem("flour-accounting-data", restoredData)
            // سیگنال نرم به اپ برای sync فوری UI بدون نیاز به رفرش دستی
            try { window.dispatchEvent(new StorageEvent("storage", { key: "flour-accounting-data" })) } catch { }
            try { window.dispatchEvent(new StorageEvent("storage", { key: "productTypes" })) } catch { }


            // --- 3) Finally update React state (render from clean data) ---
            onDataChange(restoredData as AppData)

            // --- 4) Overwrite AppData file in Roaming via API (Electron/Desktop) ---
            try {
                await fetch("/api/db", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...restoredData,
                        backupInfo: {
                            syncedAt: new Date().toISOString(),
                            via: "Settings.handleRestore(overwrite AppData)",
                        },
                    }),
                })
                if (process.env.NODE_ENV === 'development') {
                    console.log("AppData overwritten with restoredData ✅")
                }
            } catch (e) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn("Failed to overwrite AppData after restore:", e)
                }
            }

            const totalRecords = restored.backupInfo?.totalRecords
            const message = totalRecords
                ? `بازیابی موفق!
${totalRecords.customers || 0} مشتری
${totalRecords.transactions || 0} سند
${totalRecords.bulkTransactions || 0} معامله 100 تنی
${totalRecords.productTypes || 0} نوع آرد`
                : "بازیابی با موفقیت انجام شد!"

            alert(message)
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error("خطا در بازیابی:", e)
            }
            alert("خطا در بازیابی فایل. لطفاً فایل معتبر انتخاب کنید.")
        }
    }

    const handleRepairData = () => {
        if (!confirm(lang === "fa" ? "آیا مطمئن هستید؟ این عملیات داده‌های خراب (زیرسندهای بدون سند اصلی) را حذف می‌کند." : "Are you sure? This will remove orphaned subdocuments.")) return

        const allIds = new Set(data.transactions.map(t => t.id))
        const cleanTransactions = data.transactions.filter(t => {
            // Keep main documents
            if (t.isMainDocument) return true
            // Keep standalone documents (no parent)
            if (!t.parentDocumentId) return true
            // Keep subdocuments ONLY if parent exists
            return allIds.has(t.parentDocumentId)
        })

        const removedCount = data.transactions.length - cleanTransactions.length

        if (removedCount > 0) {
            const newData = { ...data, transactions: cleanTransactions }
            onDataChange(newData)

            // Force save to localStorage
            if (typeof window !== "undefined" && window.localStorage) {
                localStorage.setItem("flour-accounting-data", JSON.stringify(newData))
            }

            alert(lang === "fa" ? `${removedCount} رکورد خراب حذف شد.` : `${removedCount} corrupted records removed.`)
            window.location.reload()
        } else {
            alert(lang === "fa" ? "داده‌ها سالم هستند." : "Data is clean.")
        }
    }

    // -------------------- Purge helpers (optional quick tool) --------------------
    const purgeLocalAndResetAppData = async () => {
        const KEYS = [
            "productTypes",
            "bulkTransactions",
            "bulkTransactionsTehran",
            "documents",
            "flour-accounting-data",
            "customers",
            "transactions",
            "customerGroups",
        ]
        KEYS.forEach((k) => {
            try { localStorage.removeItem(k) } catch { }
        })
        try {
            // بازنویسی AppData با داده خالی
            const empty: AppData = {
                customers: [],
                customerGroups: [],
                transactions: [],
                documents: [],
                productTypes: [],
                bulkTransactions: [],
                bulkTransactionsTehran: [],
                currencies: [],
                bankAccounts: [],
            }
            await fetch("/api/db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...empty, backupInfo: { syncedAt: new Date().toISOString(), via: "Settings.purge" } }),
            })
        } catch { }
        alert("حافظهٔ محلی پاک شد و AppData ریست شد (درصورت پشتیبانی API).")
    }

    // -------------------- UI --------------------
    return (
        <div className="space-y-6" dir="rtl">
            <h1 className="text-2xl font-bold">تنظیمات سیستم و بک‌آپ</h1>
            <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" onClick={handleSyncNow}>
                    همگام‌سازی با AppData (Sync Now)
                </Button>
                <Button variant="destructive" onClick={purgeLocalAndResetAppData}>
                    🧹 پاکسازی حافظه محلی (و ریست AppData)
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">اسناد</div>
                    <div className="text-2xl font-bold">{stats.transactions}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">مشتریان</div>
                    <div className="text-2xl font-bold">{stats.customers}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">گروه‌ها</div>
                    <div className="text-2xl font-bold">{stats.customerGroups}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">معاملات 100 تنی</div>
                    <div className="text-2xl font-bold">{stats.bulkTransactions}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">انواع آرد</div>
                    <p className="text-2xl font-bold">{stats.productTypes}</p>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">موجودی صندوق</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4">
                        <div className="text-sm text-muted-foreground">طلب نقدی (دلار)</div>
                        <div className="text-lg font-bold text-green-600">{stats.dollarReceivable.toLocaleString()}</div>
                    </Card>
                    <Card className="p-4">
                        <div className="text-sm text-muted-foreground">بدهی نقدی (دلار)</div>
                        <div className="text-lg font-bold text-red-600">{stats.dollarPayable.toLocaleString()}</div>
                    </Card>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button onClick={handleBackup} disabled={isBackingUp} className="bg-green-600 hover:bg-green-700 disabled:opacity-60">
                    💾 ایجاد بک‌آپ کامل
                </Button>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleRestore(f)
                        e.currentTarget.value = ""
                    }}
                />
                <Button
                    variant="secondary"
                    onClick={() => fileRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    📁 بازیابی از فایل
                </Button>
                <Button onClick={handleRepairData} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                    🔧 تعمیر داده‌ها
                </Button>
            </div>

            <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                <strong>راهنمای بک‌آپ:</strong>
                <ul className="mt-2 space-y-1">
                    <li>• تمام اسناد، معاملات 100 تنی، مشتریان و انواع آرد ذخیره می‌شود</li>
                    <li>• بدهی‌های دلاری مشتریان محاسبه و ذخیره می‌شود</li>
                    <li>• موجودی صندوق (دلار) در بک‌آپ لحاظ می‌شود</li>
                    <li>• فایل بک‌آپ در تمام مرورگرها قابل بازیابی است</li>
                </ul>
            </div>
        </div>
    )
}

export { Settings as SettingsCoreParts }
