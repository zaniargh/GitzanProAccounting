"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import type { Transaction, Customer, ProductType } from "@/types"

// مشتری‌هایی که باید از محاسبات نقدی حذف شوند
const EXCLUDED_CUSTOMER_NAMES = ["سود آوات و آکو", "سود حیدری", "زیاده"] as const

function resolveCustomerName(customers: Customer[] = [], customerId?: string, fallbackName?: string) {
    if (fallbackName) return fallbackName
    if (!customerId) return undefined
    const found = customers.find((c) => c.id === customerId)
    return found?.name
}

import type { AppData } from "@/types"

interface CashInventoryProps {
    data: AppData
}

export function CashInventory({ data }: CashInventoryProps) {
    const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])

    // محاسبه موجودی نقدی (با حذف سه مشتری خاص)
    const calculateCashInventory = () => {
        let totalCashCredit = 0 // مجموع طلب نقدی من
        let totalCashDebt = 0 // مجموع بدهی نقدی من

        const customers = data.customers ?? []
        const transactions = data.transactions ?? []
        const includedCustomers = customers.filter(
            (c) => !EXCLUDED_CUSTOMER_NAMES.includes(c.name as any)
        )

        includedCustomers.forEach((customer: Customer) => {
            const customerTransactions = transactions.filter(
                (t: Transaction) => t.customerId === customer.id
            )
            let cashBalance = 0

            customerTransactions.forEach((transaction: Transaction) => {
                const amt = Number(transaction.amount ?? 0)
                if (!amt) return

                switch (transaction.type) {
                    case "product_purchase": // خرید محصول - من بدهکار پول میشوم
                        cashBalance -= transaction.amount || 0
                        break
                    case "product_sale": // فروش محصول - مشتری بدهکار پول میشود
                        cashBalance += transaction.amount || 0
                        break
                    case "cash_in": // ورود وجه - طلب من کم میشود
                        cashBalance -= amt
                        break
                    case "cash_out": // خروج وجه - بدهی من کم میشود
                        cashBalance += amt
                        break
                    case "expense": // هزینه‌ها - من بدهکار می‌شوم
                        cashBalance -= amt
                        break
                }
            })

            if (cashBalance > 0) {
                totalCashCredit += cashBalance
            } else if (cashBalance < 0) {
                totalCashDebt += Math.abs(cashBalance)
            }
        })

        return { totalCashCredit, totalCashDebt }
    }

    // محاسبه سود عام (جمع سود سه مشتری استثنایی)
    // جایگزینِ calculateGeneralProfit قبلی
    const calculateGeneralProfit = () => {
        const customers = data.customers ?? []
        const transactions = data.transactions ?? []

        // نرمال‌سازی اسامی برای جلوگیری از مشکل ی/ک/فاصله/نیم‌فاصله
        const normalize = (s?: string) =>
            (s ?? "")
                .replace(/\s+/g, " ")
                .replace(/‌/g, " ")  // نیم‌فاصله
                .replace(/ي/g, "ی")  // ی عربی → ی
                .replace(/ك/g, "ک")  // ک عربی → ک
                .trim()

        const TARGETS = new Set(["سود آوات و آکو", "سود حیدری", "زیاده"].map(normalize))

        const nameById = new Map(customers.map(c => [c.id, normalize(c.name)]))

        // تراز نقدی فقط برای این سه مشتری
        const balanceByKey = new Map<string, number>()

        for (const t of transactions) {
            const name =
                normalize(
                    t.customerName ||
                    nameById.get(t.customerId ?? "") ||
                    ""
                )

            if (!TARGETS.has(name)) continue

            const key = t.customerId || name // کلید تجمیع
            const prev = balanceByKey.get(key) ?? 0
            const amt = Number(t.amount ?? 0)
            if (!amt) { balanceByKey.set(key, prev); continue }

            let delta = 0
            switch (t.type) {
                case "product_purchase":  // خرید محصول → من بدهکار می‌شوم
                    delta = -(t.amount || 0)
                    break
                case "product_sale":      // فروش محصول → طلب من بیشتر می‌شود
                    delta = +(t.amount || 0)
                    break
                case "cash_in":         // ورود وجه از مشتری → طلب من کم می‌شود
                    delta = -amt
                    break
                case "cash_out":        // خروج وجه از من → بدهی من کم می‌شود
                    delta = +amt
                    break
                case "expense":         // هزینه → بدهکار
                    delta = -amt
                    break
                default:
                    delta = 0
            }

            balanceByKey.set(key, prev + delta)
        }

        // جمع خالص سه حساب
        const sum = Array.from(balanceByKey.values()).reduce((acc, v) => acc + v, 0)
        return sum
    }


    // محاسبه موجودی محصول
    const calculateProductInventory = () => {
        const productInventory: { [productTypeId: string]: { credit: number; debt: number } } = {}

        productTypes.forEach((productType: ProductType) => {
            productInventory[productType.id] = { credit: 0, debt: 0 }
        })

        data.transactions.forEach((transaction: Transaction) => {
            if (transaction.productTypeId && productInventory[transaction.productTypeId]) {
                switch (transaction.type) {
                    case "product_purchase":
                        productInventory[transaction.productTypeId].credit += transaction.weight || 0
                        break
                    case "product_in":
                        productInventory[transaction.productTypeId].credit -= transaction.weight || 0
                        break
                    case "product_sale":
                        productInventory[transaction.productTypeId].debt += transaction.weight || 0
                        break
                    case "product_out":
                        productInventory[transaction.productTypeId].debt -= transaction.weight || 0
                        break
                }
            }
        })

        return productInventory
    }

    // محاسبه موجودی مخزن
    const calculateWarehouseInventory = () => {
        const warehouseInventory: { [productTypeId: string]: number } = {}

        productTypes.forEach((productType: ProductType) => {
            warehouseInventory[productType.id] = 0
        })

        data.transactions.forEach((transaction: Transaction) => {
            if (transaction.productTypeId && warehouseInventory[transaction.productTypeId] !== undefined) {
                switch (transaction.type) {
                    case "product_purchase":
                    case "product_in":
                        warehouseInventory[transaction.productTypeId] += transaction.weight || 0
                        break
                    case "product_sale":
                    case "product_out":
                        warehouseInventory[transaction.productTypeId] -= transaction.weight || 0
                        break
                }
            }
        })

        return warehouseInventory
    }

    const { totalCashCredit, totalCashDebt } = calculateCashInventory()
    const generalProfit = calculateGeneralProfit()
    const productInventory = calculateProductInventory()
    const warehouseInventory = calculateWarehouseInventory()
    const netUsd = Number(totalCashDebt || 0) - Number(totalCashCredit || 0)

    const getProductTypeName = (productTypeId: string) => {
        const productType = productTypes.find((ft) => ft.id === productTypeId)
        return productType ? productType.name : "نامشخص"
    }

    return (
        <div className="space-y-6">
            {/* کارت‌های موجودی نقدی */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-green-200 bg-green-50">
                    <CardHeader>
                        <CardTitle className="text-green-700">طلب نقدی (دلار)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-700">
                            {totalCashCredit.toLocaleString("en-US")}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-700">بدهی نقدی (دلار)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-700">
                            {totalCashDebt.toLocaleString("en-US")}
                        </div>
                    </CardContent>
                </Card>

                {/* کارت جدید: سود عام */}
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="text-blue-700">سود عام</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-700">
                            {generalProfit.toLocaleString("en-US")}
                        </div>
                        <div className="mt-2 text-sm text-blue-800/80">
                            سود آوات و آکو + سود حیدری + زیاده
                        </div>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-6">
                    {/* ته حساب دلاری = بدهی دلاری - طلب دلاری */}
                    <Card className={netUsd > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                        <CardHeader>
                            <CardTitle className={netUsd > 0 ? "text-red-700" : "text-green-700"}>
                                ته حساب دلاری
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-3xl font-bold ${netUsd > 0 ? "text-red-700" : "text-green-700"}`}>
                                {netUsd.toLocaleString("en-US")}
                            </div>
                            <div className="mt-2 text-sm opacity-80">
                                {netUsd > 0 ? "به ضرر ما (بدهی خالص)" : netUsd < 0 ? "به نفع ما (طلب خالص)" : "خنثی"}
                            </div>
                        </CardContent>
                    </Card>


                </div>
            </div>

            {/* کارت‌های موجودی محصول */}
            <Card>
                <CardHeader>
                    <CardTitle>موجودی محصول (تن)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(productInventory).map(([productTypeId, { credit, debt }]) => {
                            const productTypeName = getProductTypeName(productTypeId)
                            const net = (credit || 0) - (debt || 0)
                            return (
                                <div key={productTypeId} className="p-4 rounded-xl border">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">{productTypeName}</span>
                                        <span className={`font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>{net.toLocaleString("fa-IR")} تن</span>
                                    </div>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span className="text-green-600">طلب محصول:</span>
                                            <span className="text-green-600 font-bold">{(credit || 0).toLocaleString("fa-IR")} تن</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-red-600">بدهی محصول:</span>
                                            <span className="text-red-600 font-bold">{(debt || 0).toLocaleString("fa-IR")} تن</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* کارت‌های مخزن */}
            <Card>
                <CardHeader>
                    <CardTitle>موجودی مخزن (Warehouse)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(warehouseInventory).map(([productTypeId, warehouseAmount]) => {
                            const productTypeName = getProductTypeName(productTypeId)
                            return (
                                <div key={productTypeId} className="p-4 rounded-xl border">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">{productTypeName}</span>
                                        <span className="font-bold">{warehouseAmount.toLocaleString("fa-IR")} تن</span>
                                    </div>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                        <div className="flex justify-between border-t pt-2">
                                            <span className="text-blue-600">مخزن:</span>
                                            <span className="text-blue-600 font-bold">{warehouseAmount.toLocaleString("fa-IR")} تن</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
