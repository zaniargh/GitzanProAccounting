"use client"
import { useState, useEffect, useRef } from "react"
import Settings from "@/components/settings/settings"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import { Sidebar } from "@/components/layout/sidebar"
import { CustomerGroups } from "@/components/customers/customer-groups"
import { CustomerList } from "@/components/customers/customer-list"
import { Currencies } from "@/components/settings/currencies"
import { BankAccounts } from "@/components/settings/bank-accounts"
import { ProductTypesManager } from "@/components/product-types/product-types-manager"
import { TransactionForm } from "@/components/transactions/transaction-form"
import { FinancialSummary } from "@/components/reports/financial-summary"
import { CustomerReport } from "@/components/reports/customer-report"
import { DateRangeReport } from "@/components/reports/date-range-report"
import { CashInventory } from "@/components/cash-inventory/cash-inventory"
import { TransactionList } from "@/components/transactions/transaction-list"
import { DocumentsList } from "@/components/documents/documents-list"
import { ForeignTransactions } from "@/components/foreign-transactions/foreign-transactions"
import { Card } from "@/components/ui/card"
import type { ProductType } from "@/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { useLang } from "@/components/language-provider"
import { formatNumber } from "@/lib/number-utils"

export default function HomePage() {
  const { data, saveData, isLoading } = useLocalStorage()
  const [productTypes, saveProductTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])
  const cleanupRanRef = useRef(false)

  useEffect(() => {
    try {
      // اگر در اسنپ‌شات اصلی لیست محصولات داریم و لیست محلی خالی/کم است، sync کن
      if (Array.isArray(data?.productTypes) && data.productTypes.length > 0) {
        if (!Array.isArray(productTypes) || productTypes.length < data.productTypes.length) {
          saveProductTypes(data.productTypes)
        }
      }
    } catch { }
  }, [data?.productTypes, productTypes, saveProductTypes])

  // پاک‌سازی مشتری‌ها و گروه‌های پیش‌فرض قدیمی (فقط یک‌بار روی داده‌های موجود)
  useEffect(() => {
    if (isLoading || !data || cleanupRanRef.current) return

    const defaultExpenseNames = new Set([
      "هزینه کرایه روسیه",
      "هزینه حواله",
      "گمرک منظریه",
      "کرایه روسیه",
      "کرایه استارا",
      "گمرک و ترخیص عراق",
      "هزینه جانبی",
    ])

    const filteredCustomers = data.customers.filter(
      (c) => !(c.phone === "هزینه" && defaultExpenseNames.has(c.name)),
    )

    // گروه‌های پیش‌فرض (مثل گروه «هزینه»)
    const filteredGroups = data.customerGroups.filter(
      (g) => !(g.name === "هزینه" || g.id.startsWith("expense-group")),
    )

    if (
      filteredCustomers.length !== data.customers.length ||
      filteredGroups.length !== data.customerGroups.length
    ) {
      cleanupRanRef.current = true
      void saveData({
        ...data,
        customers: filteredCustomers,
        customerGroups: filteredGroups,
      })
    }
  }, [data, isLoading, saveData])

  // ایجاد حساب‌های پیش‌فرض دائمی (صندوق من و انبار)
  useEffect(() => {
    if (isLoading || !data) return

    let needsUpdate = false
    let updatedCustomers = [...data.customers]
    let updatedGroups = [...data.customerGroups]

    // ایجاد گروه Main محافظت شده
    const mainGroupExists = data.customerGroups.some(g => g.id === "main-group")
    let mainGroupId = "main-group"

    if (!mainGroupExists) {
      const newGroup = {
        id: "main-group",
        name: "Main",
        description: "Main and default group",
        createdAt: new Date().toISOString(),
        isProtected: true,
      }
      updatedGroups.push(newGroup)
      needsUpdate = true
    }

    // ایجاد یا به‌روزرسانی حساب صندوق من
    const cashSafeIndex = updatedCustomers.findIndex(c => c.id === "default-cash-safe")
    if (cashSafeIndex === -1) {
      // ایجاد حساب جدید
      updatedCustomers.push({
        id: "default-cash-safe",
        name: "Cash Box",
        phone: "-",
        groupId: mainGroupId,
        createdAt: new Date().toISOString(),
        cashDebt: 0,
        productDebts: {},
        isProtected: true,
      })
      needsUpdate = true
    } else {
      // به‌روزرسانی حساب موجود: اطمینان از نام صحیح، اختصاص به گروه Main و فعال بودن حفاظت
      const cashSafe = updatedCustomers[cashSafeIndex]
      if (cashSafe.groupId !== mainGroupId || !cashSafe.isProtected || cashSafe.name !== "Cash Box") {
        updatedCustomers[cashSafeIndex] = {
          ...cashSafe,
          name: "Cash Box",
          groupId: mainGroupId,
          isProtected: true,
        }
        needsUpdate = true
      }
    }

    // ایجاد یا به‌روزرسانی حساب انبار
    const warehouseIndex = updatedCustomers.findIndex(c => c.id === "default-warehouse")
    if (warehouseIndex === -1) {
      // ایجاد حساب جدید
      updatedCustomers.push({
        id: "default-warehouse",
        name: "Inventory",
        phone: "-",
        groupId: mainGroupId,
        createdAt: new Date().toISOString(),
        cashDebt: 0,
        productDebts: {},
        isProtected: true,
      })
      needsUpdate = true
    } else {
      // به‌روزرسانی حساب موجود: اطمینان از اختصاص به گروه Main و فعال بودن حفاظت
      const warehouse = updatedCustomers[warehouseIndex]
      if (warehouse.groupId !== mainGroupId || !warehouse.isProtected) {
        updatedCustomers[warehouseIndex] = {
          ...warehouse,
          groupId: mainGroupId,
          isProtected: true,
        }
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      void saveData({
        ...data,
        customers: updatedCustomers,
        customerGroups: updatedGroups,
      })
    }
  }, [data, isLoading, saveData])

  const [activeSection, setActiveSection] = useState("dashboard")
  const { t, lang } = useLang()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    )
  }


  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        // Calculate financial metrics (only USD)
        const cashBalanceUSD = data.customers.reduce((sum, c) => sum + (c.cashDebt || 0), 0)

        // Receivables and Payables (USD)
        const receivableUSD = data.customers.reduce((sum, c) => c.cashDebt > 0 ? sum + c.cashDebt : sum, 0)
        const payableUSD = data.customers.reduce((sum, c) => c.cashDebt < 0 ? sum + Math.abs(c.cashDebt) : sum, 0)

        // Product inventory by type
        const productInventory: { [key: string]: { name: string, total: number } } = {}
        data.productTypes?.forEach((pt: ProductType) => {
          productInventory[pt.id] = { name: pt.name, total: 0 }
        })

        data.transactions.forEach(t => {
          if (t.productTypeId && productInventory[t.productTypeId]) {
            const weight = t.weight || 0
            if (t.type === 'product_purchase' || t.type === 'product_in') {
              productInventory[t.productTypeId].total += weight
            } else if (t.type === 'product_sale' || t.type === 'product_out') {
              productInventory[t.productTypeId].total -= weight
            }
          }
        })

        const totalProductInventory = Object.values(productInventory).reduce((sum, f) => sum + f.total, 0)

        // Top debtors and creditors
        const customersWithDebt = data.customers
          .filter(c => !c.isProtected) // Exclude expense accounts
          .map(c => ({
            ...c,
            totalDebt: (c.cashDebt || 0),
          }))
          .sort((a, b) => Math.abs(b.totalDebt) - Math.abs(a.totalDebt))

        const topDebtors = customersWithDebt.filter(c => c.totalDebt > 0).slice(0, 5)
        const topCreditors = customersWithDebt.filter(c => c.totalDebt < 0).slice(0, 5)

        // Recent transactions
        const recentTransactions = [...data.transactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)

        return (
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold">{t("dashboard")}</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Card className="p-3 md:p-4 hover:shadow-lg transition-shadow">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{t("totalCashBalanceUSD")}</h3>
                <p className={`text-2xl md:text-3xl font-bold ${cashBalanceUSD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${formatNumber(Math.abs(cashBalanceUSD))}
                </p>
              </Card>
              <Card className="p-4 md:p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{t("totalProductInventory")}</h3>
                <p className="text-2xl md:text-3xl font-bold text-primary">{formatNumber(totalProductInventory)}</p>
              </Card>
              <Card className="p-4 md:p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{t("activeCustomers")}</h3>
                <p className="text-2xl md:text-3xl font-bold text-primary">{data.customers.filter(c => !c.isProtected).length}</p>
              </Card>
            </div>

            {/* Receivables & Payables (USD only) */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 md:gap-6">
              <Card className="p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-4 text-green-600">{t("accountsReceivable")}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("cashUSD")}</span>
                    <span className="text-xl font-bold text-green-600">${formatNumber(receivableUSD)}</span>
                  </div>
                </div>
              </Card>
              <Card className="p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-4 text-red-600">{t("accountsPayable")}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("cashUSD")}</span>
                    <span className="text-xl font-bold text-red-600">${formatNumber(payableUSD)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Flour Inventory */}
            <Card className="p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-4">{t("productInventoryByType")}</h3>
              <div className="space-y-3">
                {Object.entries(productInventory).map(([id, { name, total }]) => (
                  <div key={id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{formatNumber(total)} {t("tons")}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${totalProductInventory > 0 ? (total / totalProductInventory) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Debtors & Creditors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card className="p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-4">{t("topDebtors")}</h3>
                <div className="space-y-2">
                  {topDebtors.length > 0 ? topDebtors.map(c => (
                    <div key={c.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-red-600 font-semibold shrink-0">${formatNumber(c.cashDebt)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-sm">No debtors</p>}
                </div>
              </Card>
              <Card className="p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-4">{t("topCreditors")}</h3>
                <div className="space-y-2">
                  {topCreditors.length > 0 ? topCreditors.map(c => (
                    <div key={c.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-green-600 font-semibold shrink-0">${formatNumber(Math.abs(c.cashDebt))}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-sm">No creditors</p>}
                </div>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card className="p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-4">{t("recentTransactions")}</h3>
              <div className="space-y-2">
                {recentTransactions.map(t => {
                  const customer = data.customers.find(c => c.id === t.customerId)
                  return (
                    <div key={t.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{customer?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">
                          {formatNumber(t.amount || 0)} {data.currencies?.find(c => c.id === t.currencyId)?.symbol || "$"}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{t.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )

      case "customer-groups":
        return <CustomerGroups data={data} onDataChange={saveData} />
      case "customers":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t("customers")}</h1>
            <Tabs defaultValue="customer-list" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="customer-list">{t("customerList")}</TabsTrigger>
                <TabsTrigger value="customer-groups">{t("customerGroups")}</TabsTrigger>
              </TabsList>
              <TabsContent value="customer-list">
                <CustomerList data={data} onDataChange={saveData} />
              </TabsContent>
              <TabsContent value="customer-groups">
                <CustomerGroups data={data} onDataChange={saveData} />
              </TabsContent>
            </Tabs>
          </div>
        )
      case "bank-accounts":
        return <BankAccounts data={data} onDataChange={saveData} />
      case "product-types":
        return <ProductTypesManager productTypes={productTypes} transactions={data.transactions} onProductTypesChange={saveProductTypes} />
      case "transactions":
        return <TransactionForm data={data} onDataChange={saveData} productTypes={productTypes} />
      case "cash-inventory":
        return <CashInventory data={data} productTypes={productTypes} />
      case "documents-list":
        return <DocumentsList data={data} onDataChange={saveData} />
      case "foreign-transactions":
        return <ForeignTransactions data={data} onDataChange={saveData} />
      case "reports":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t("reports")}</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FinancialSummary data={data} />
              <CustomerReport data={data} />
            </div>
            <DateRangeReport data={data} />
          </div>
        )
      case "currencies":
        return <Currencies data={data} onDataChange={saveData} />
      case "settings":
        return <Settings data={data} onDataChange={saveData} />
      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t("sectionNotAvailable")}</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background" dir={lang === "fa" ? "rtl" : "ltr"}>
      <div className="flex min-h-screen">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="flex-1 px-1 py-1 md:px-2 md:py-2 lg:px-3 lg:py-2 transition-all duration-300 overflow-hidden">
          <div className="w-full mx-auto space-y-2">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  )
}
