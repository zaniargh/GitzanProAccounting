"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Printer, Download, Edit, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { formatPersianDate, formatGregorianDate } from "@/lib/date-utils"
import type { Transaction, Customer, CustomerGroup, ProductType, Currency, BankAccount } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
const getAmountClass = (type: string) => {
  // نوع‌هایی که باید سبز باشند
  const green = new Set([
    "cash_out",      // خروج وجه (دلار)
    "product_out",     // خروج محصول
    "product_purchase", // خرید محصول
    "receivable"            // طلب
  ])

  // نوع‌هایی که باید قرمز باشند
  const red = new Set([
    "cash_in",    // ورود وجه (دلار)
    "product_in",   // ورود محصول
    "product_sale", // فروش محصول
    "expense",     // هزینه
    "payable"       // بدهی
  ])

  if (green.has(type)) return "text-green-600"
  if (red.has(type)) return "text-red-600"
  return "" // پیش‌فرض
}
type RunningBalance = {
  dollar: number
  productWeight: number // وزن خالص محصول
}

function deltaFromTransaction(tx: Transaction) {
  let dollar = 0
  let productWeight = 0
  const amt = Number(tx.amount || 0)
  const w = Number(tx.weight || 0)

  // پول نقد دلاری
  if (tx.type === "cash_in") dollar += amt
  if (tx.type === "cash_out") dollar -= amt

  // محصول/وزن
  if (tx.type === "product_in" || tx.type === "product_purchase") productWeight += w
  if (tx.type === "product_out" || tx.type === "product_sale") productWeight -= w

  return { dollar, productWeight }
}

/**
 * برای لیستِ «فیلترشده و مرتب‌شدهٔ فعلی»،
 * برای هر مشتری به‌صورت جداگانه running balance می‌سازد
 * و یک Map از tx.id → RunningBalanceAfterThisTx برمی‌گرداند.
 */
function buildRunningBalancesPerCustomer(transactions: Transaction[]) {
  const perCustomerAcc = new Map<string, RunningBalance>() // customerId → بالانس فعلی
  const result = new Map<string, RunningBalance>()         // tx.id → بالانس بعد از این سند

  for (const tx of transactions) {
    const cid = tx.customerId || "__NO_CUSTOMER__" // اگر سند مشتری ندارد، یک سبد جدا داشته باشد
    const prev = perCustomerAcc.get(cid) || { dollar: 0, productWeight: 0 }
    const d = deltaFromTransaction(tx)
    const next: RunningBalance = {
      dollar: prev.dollar + d.dollar,
      productWeight: prev.productWeight + d.productWeight,
    }
    perCustomerAcc.set(cid, next)
    if (tx.id) result.set(tx.id, next)
  }

  return result
}

interface DocumentsListProps {
  data: {
    transactions: Transaction[]
    customers: Customer[]
    customerGroups: CustomerGroup[]
    productTypes: ProductType[]
    currencies: Currency[]
    bankAccounts: BankAccount[]
  }
  onDataChange: (data: any) => void
  onEdit?: (transaction: Transaction) => void
}

export function DocumentsList({ data, onDataChange, onEdit }: DocumentsListProps) {
  const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [showLast25Only, setShowLast25Only] = useState(false)
  const [filterProductType, setFilterProductType] = useState("all")
  const [documentType, setDocumentType] = useState<"all" | "main" | "sub">("all") // فیلتر نوع سند
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]) // فیلتر ارزها - خالی یعنی همه

  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  // Badge برای نمایش بد/بس بر اساس علامت
  const debtBadge = (val: number) => {
    if (val > 0) {
      // مشتری بدهکارِ ماست → "بد" (سبز)
      return <span className="px-1 py-0 rounded-full bg-green-100 text-green-700 text-[9px]">بد</span>
    }
    if (val < 0) {
      // ما بدهکار مشتری‌ایم → "بس" (قرمز)
      return <span className="px-1 py-0 rounded-full bg-red-100 text-red-700 text-[9px]">بس</span>
    }
    // صفر
    return null
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="text-center print:text-xs cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </div>
    </TableHead>
  )

  const getCustomerName = (customerId: string) => {
    return data.customers.find((c) => c.id === customerId)?.name || "نامشخص"
  }
  const getUnitPrice = (t: Transaction) => {
    if (t.unitPrice != null) return t.unitPrice
    if (t.amount != null && t.weight) {
      const raw = t.amount / t.weight
      return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : undefined
    }
    return undefined
  }


  const getProductTypeName = (productTypeId?: string) => {
    if (!productTypeId) return "-"
    if (!productTypes || !Array.isArray(productTypes)) {
      return "نامشخص"
    }

    const found = productTypes.find((f) => f.id === productTypeId)
    return found?.name || "نامشخص"
  }

  const getTransactionTypeLabel = (type: string) => {
    const types = {
      product_purchase: "خرید محصول",
      product_sale: "فروش محصول",
      product_in: "ورود محصول",
      product_out: "خروج محصول",
      cash_in: "هه یه تی دولار",
      cash_out: "لایه تی دولار",
      expense: "هزینه",
      income: "درآمد",
      receivable: "طلب",
      payable: "بدهی",
    }
    return types[type as keyof typeof types] || type
  }

  const formatDate = (dateString: string) => {
    try {
      return formatPersianDate(dateString)
    } catch (error) {
      return dateString
    }
  }

  const formatDateGregorian = (dateString: string) => {
    try {
      return formatGregorianDate(dateString)
    } catch (error) {
      return dateString
    }
  }

  // محاسبه running balance برای **همه** اسناد (بدون فیلتر) تا ته حساب درست باشه
  const runningBalancesMap = useMemo(() => {
    const balanceMap = new Map<string, {
      cashBalances: { [currencyId: string]: number }  // تغییر: از cashBalance به cashBalances
      productBalances: { [key: string]: number }
    }>()
    const perCustomerBalance = new Map<string, {
      cashBalances: { [currencyId: string]: number }  // تغییر: از cashBalance به cashBalances
      productBalances: { [key: string]: number }
    }>()

    // پیدا کردن ارز پایه
    const baseCurrencyId = data.currencies?.find(c => c.isBase)?.id || data.currencies?.[0]?.id || "default"

    // مرتب‌سازی همه اسناد بر اساس تاریخ
    const allTransactionsSorted = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    allTransactionsSorted.forEach((transaction) => {
      const customerId = transaction.customerId || "__NO_CUSTOMER__"
      const currentBalance = perCustomerBalance.get(customerId) || { cashBalances: {}, productBalances: {} }

      // تشخیص ارز این تراکنش
      const currencyId = transaction.currencyId || baseCurrencyId
      const amount = transaction.amount || 0

      // گرفتن موجودی فعلی این ارز
      const currentCashBalance = currentBalance.cashBalances[currencyId] || 0

      switch (transaction.type) {
        case "product_purchase":
          currentBalance.cashBalances[currencyId] = currentCashBalance - amount
          if (transaction.productTypeId) {
            currentBalance.productBalances[transaction.productTypeId] =
              (currentBalance.productBalances[transaction.productTypeId] || 0) + (transaction.weight || 0)
          }
          break
        case "product_sale":
          currentBalance.cashBalances[currencyId] = currentCashBalance + amount
          if (transaction.productTypeId) {
            currentBalance.productBalances[transaction.productTypeId] =
              (currentBalance.productBalances[transaction.productTypeId] || 0) - (transaction.weight || 0)
          }
          break
        case "product_in":
          if (transaction.productTypeId) {
            currentBalance.productBalances[transaction.productTypeId] =
              (currentBalance.productBalances[transaction.productTypeId] || 0) + (transaction.weight || 0)
          }
          break
        case "product_out":
          if (transaction.productTypeId) {
            currentBalance.productBalances[transaction.productTypeId] =
              (currentBalance.productBalances[transaction.productTypeId] || 0) - (transaction.weight || 0)
          }
          break
        case "cash_out":
        case "expense":
        case "receivable":
        case "payable": // Payable is now signed (negative), so we just add it
          currentBalance.cashBalances[currencyId] = currentCashBalance + amount
          if (transaction.productTypeId) {
            currentBalance.productBalances[transaction.productTypeId] =
              (currentBalance.productBalances[transaction.productTypeId] || 0) + (transaction.weight || 0)
          }
          break
        case "cash_in":
        case "income":
          currentBalance.cashBalances[currencyId] = currentCashBalance + amount
          break
      }

      balanceMap.set(transaction.id, {
        cashBalances: { ...currentBalance.cashBalances },  // تغییر: کپی تمام ارزها
        productBalances: { ...currentBalance.productBalances }
      })

      perCustomerBalance.set(customerId, currentBalance)
    })

    return balanceMap
  }, [data.transactions, data.currencies])

  // فیلتر اسناد (بعد از محاسبه running balance)
  const filteredTransactions = useMemo(() => {
    let filtered = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // فیلتر نوع سند (اصلی/زیرسند/همه)
    if (documentType === "main") {
      filtered = filtered.filter((t) => t.isMainDocument === true)
    } else if (documentType === "sub") {
      filtered = filtered.filter((t) => t.parentDocumentId != null)
    }

    // اول فیلترهای دیگه رو اعمال می‌کنیم
    if (dateFrom) {
      filtered = filtered.filter((t) => t.date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((t) => t.date <= dateTo)
    }
    if (selectedCustomer) {
      filtered = filtered.filter((t) => t.customerId === selectedCustomer || t.accountId === selectedCustomer)
    }
    if (selectedGroup) {
      const groupCustomers = data.customers.filter((c) => c.groupId === selectedGroup)
      filtered = filtered.filter((t) => groupCustomers.some((c) => c.id === t.customerId))
    }
    if (filterProductType && filterProductType !== "all") {
      filtered = filtered.filter((transaction) => {
        if (
          transaction.type === "product_purchase" ||
          transaction.type === "product_in" ||
          transaction.type === "product_sale" ||
          transaction.type === "product_out"
        ) {
          return transaction.productTypeId === filterProductType
        }
        return false
      })
    }

    // در آخر، اگر فیلتر "25 سند آخر" فعال باشه، فقط 25 تای آخر از نتایج فیلتر شده رو برمی‌گردونیم
    if (showLast25Only) {
      return filtered.slice(-25)
    }

    return filtered
  }, [data.transactions, dateFrom, dateTo, selectedCustomer, selectedGroup, data.customers, showLast25Only, filterProductType, documentType])

  // Sorting با استفاده از balanceMap بهینه شده
  const sortedTransactions = useMemo(() => {
    if (!sortField) return filteredTransactions

    return [...filteredTransactions].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case "documentNumber":
          aValue = a.documentNumber || ""
          bValue = b.documentNumber || ""
          break
        case "type":
          aValue = getTransactionTypeLabel(a.type)
          bValue = getTransactionTypeLabel(b.type)
          break
        case "customer":
          aValue = getCustomerName(a.customerId)
          bValue = getCustomerName(b.customerId)
          break
        case "productType":
          aValue = a.productTypeId ? getProductTypeName(a.productTypeId) : ""
          bValue = b.productTypeId ? getProductTypeName(b.productTypeId) : ""
          break
        case "productIn":
          aValue = a.type === "product_in" ? a.weight || 0 : 0
          bValue = b.type === "product_in" ? b.weight || 0 : 0
          break
        case "productOut":
          aValue = a.type === "product_out" ? a.weight || 0 : 0
          bValue = b.type === "product_out" ? b.weight || 0 : 0
          break
        case "productPurchase":
          aValue = a.type === "product_purchase" ? a.weight || 0 : 0
          bValue = b.type === "product_purchase" ? b.weight || 0 : 0
          break
        case "productSale":
          aValue = a.type === "product_sale" ? a.weight || 0 : 0
          bValue = b.type === "product_sale" ? b.weight || 0 : 0
          break
        case "unitPrice":
          aValue = a.unitPrice || 0
          bValue = b.unitPrice || 0
          break
        case "amount":
          aValue = a.amount || 0
          bValue = b.amount || 0
          break
        case "date":
          aValue = new Date(a.date).getTime()
          bValue = new Date(b.date).getTime()
          break
        case "description":
          aValue = a.description || ""
          bValue = b.description || ""
          break
        case "cashBalance":
          // برای sorting از اولین ارز استفاده می‌کنیم
          const aBalances = runningBalancesMap.get(a.id)?.cashBalances || {}
          const bBalances = runningBalancesMap.get(b.id)?.cashBalances || {}
          aValue = Object.values(aBalances)[0] || 0
          bValue = Object.values(bBalances)[0] || 0
          break
        case "productBalance":
          const aProductBalance = a.productTypeId
            ? runningBalancesMap.get(a.id)?.productBalances[a.productTypeId] || 0
            : 0
          const bProductBalance = b.productTypeId
            ? runningBalancesMap.get(b.id)?.productBalances[b.productTypeId] || 0
            : 0
          aValue = aProductBalance
          bValue = bProductBalance
          break
        default:
          if (sortField.startsWith("balance_")) {
            const currencyId = sortField.replace("balance_", "")
            const aBalances = runningBalancesMap.get(a.id)?.cashBalances || {}
            const bBalances = runningBalancesMap.get(b.id)?.cashBalances || {}
            aValue = aBalances[currencyId] || 0
            bValue = bBalances[currencyId] || 0
          } else {
            // @ts-ignore
            aValue = a[sortField] || 0
            // @ts-ignore
            bValue = b[sortField] || 0
          }
          break
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [filteredTransactions, sortField, sortDirection, runningBalancesMap])

  // تعیین ارزهایی که باید نمایش داده شوند
  const displayCurrencies = useMemo(() => {
    if (selectedCurrencies.length === 0) {
      // نمایش همه ارزها
      return data.currencies || []
    } else {
      // نمایش فقط ارزهای انتخاب شده
      return (data.currencies || []).filter(c => selectedCurrencies.includes(c.id))
    }
  }, [selectedCurrencies, data.currencies])

  // محاسبه جمع کل
  const totals = useMemo(() => {
    let totalAmount = 0
    let totalProductIn = 0
    let totalProductOut = 0
    let totalProductPurchase = 0
    let totalProductSale = 0

    sortedTransactions.forEach((transaction) => {
      totalAmount += transaction.amount || 0
      if (transaction.type === "product_in") totalProductIn += transaction.weight || 0
      if (transaction.type === "product_out") totalProductOut += transaction.weight || 0
      if (transaction.type === "product_purchase") totalProductPurchase += transaction.weight || 0
      if (transaction.type === "product_sale") totalProductSale += transaction.weight || 0
    })

    return { totalAmount, totalProductIn, totalProductOut, totalProductPurchase, totalProductSale }
  }, [sortedTransactions])

  // Pagination logic
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFrom, dateTo, selectedCustomer, selectedGroup, showLast25Only, filterProductType])

  // تابع برای فعال/غیرفعال کردن فیلتر "25 سند آخر"
  const handleToggleLast25 = () => {
    setShowLast25Only(!showLast25Only)
    setCurrentPage(1)
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const rowsHtml = sortedTransactions
      .map((t) => {
        const rb = runningBalancesMap.get(t.id)
        if (!rb) return ""
        const productVal = t.productTypeId ? (rb.productBalances[t.productTypeId] || 0) : 0

        // رنگ‌ها برای ستون‌های مبلغ (مثل جدول اصلی)
        const dollarClass =
          t.type === "cash_out" || t.type === "product_sale" ? "green" :
            t.type === "cash_in" || t.type === "product_purchase" || t.type === "expense" ? "red" : ""


        // Badge بد/بس
        const badge = (val: number) =>
          val > 0
            ? '<span class="badge green-badge">لایه تی</span>'
            : val < 0
              ? '<span class="badge red-badge">هه یه تی</span>'
              : '<span class="badge gray-badge">صفر</span>'

        // قیمت واحد (اگه داری)
        const unit = getUnitPrice(t)
        const unitCell = unit != null ? `${unit.toLocaleString("en-US")} دولار/تن` : "-"

        return `
        <tr>
          <td>${t.documentNumber || "-"}</td>
          <td>${getTransactionTypeLabel(t.type)}</td>
          <td>${getCustomerName(t.customerId)}</td>
          <td>${getProductTypeName(t.productTypeId)}</td>
          <td>${t.weight ? (t.weight).toLocaleString("en-US") + " تن" : "-"}</td>
          <td>${unitCell}</td>
          <td><span class="${dollarClass}">${(t.amount || 0).toLocaleString("en-US")} دولار</span></td>
          <td>${(rb.cashBalances[t.currencyId || "default"] || 0).toLocaleString("en-US")} ${badge(rb.cashBalances[t.currencyId || "default"] || 0)}</td>
          <td>${productVal.toLocaleString("en-US")} ${badge(productVal)}</td>
          <td>
            <div>${formatDate(t.date)}</div>
            <div class="subtle small">${formatDateGregorian(t.date)}</div>
          </td>
          <td>${t.description || "-"}</td>
        </tr>
      `
      })
      .join("")

    const customerLabel = selectedCustomer
      ? `مشتری: ${getCustomerName(selectedCustomer)}`
      : "همهٔ مشتریان"

    const rangeLabel = (dateFrom && dateTo)
      ? `از ${formatDate(dateFrom)} تا ${formatDate(dateTo)}`
      : ""

    printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
      <meta charset="UTF-8">
      <title>لیست اسناد و حسابات ادروم</title>

      <!-- فونت وزیرمتن (گوگل) + وزیر (jsDelivr) -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css" rel="stylesheet">

      <style>
        @page { margin: 5mm; }
        body { font-family: 'vazirmatn','Vazir', Arial, sans-serif; direction: rtl; }
        h1 { text-align:center; margin: 0 0 4px; font-weight:700; }
        .meta { text-align:center; color:#374151; font-size:16px; margin-bottom:10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #333; padding: 4px; text-align: center; vertical-align: middle; }
        th { background-color: #f5f5f5; }
        .green { color: #059669; }   /* خروج وجه، فروش آرد */
        .red   { color: #dc2626; }   /* ورود وجه، خرید آرد */
        .badge { padding: 2px 6px; border-radius: 9999px; font-size: 10px; }
        .green-badge { background: #dcfce7; color:#166534; } /* بد = مشتری بدهکار */
        .red-badge   { background: #fee2e2; color:#991b1b; } /* بس = ما بدهکار */
        .gray-badge  { background: #f3f4f6; color:#374151; }
        .small { font-size: 11px; }
        .subtle { color: #6b7280; }
        .footer { position: fixed; bottom: 1mm; left: 0; right: 0; text-align: center; color:#6b7280; font-size: 11px; }
        .header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.header h1 {
  margin: 0;
  font-weight: 700;
}
.logo {
  height: 40px; /* یا هر سایزی که بخوای */
}
      </style>
    </head>
    <body>
  <div class="header">
    <h1>لیست اسناد و حسابات ادروم</h1>
    <img src="/logo.png" alt="Adrom Logo" class="logo" />
  </div>
      <div class="meta">
        ${customerLabel} ${rangeLabel ? " | " + rangeLabel : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>ره قم سند</th>
            <th>نوع</th>
            <th>مشتری</th>
            <th>نوع محصول</th>
            <th>مقدار</th>
            <th>سعر</th>
            <th>مبلغ (دلار)</th>
            <th>آخیر حساب دولار</th>
            <th>آخیر حساب محصول</th>
            <th>تاریخ</th>
            <th>ته بینی</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">این گزارش توسط سیستم حسابداری زانیار (ادروم) منتشر شده است</div>
    </body>
    </html>
  `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }

  const handlePrintKurdish = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const customer = selectedCustomer
      ? data.customers.find((c) => c.id === selectedCustomer)
      : null

    const customerName = customer ? customer.name : "هەموو کڕیار"
    const customerPhone = customer?.phone || ""

    // پیدا کردن ارز پایه برای تشخیص ستون مبلغ
    const baseCurrencyId = data.currencies?.find(c => c.isBase)?.id || data.currencies?.[0]?.id || "default"

    const rowsHtml = sortedTransactions
      .map((t) => {
        const balances = runningBalancesMap.get(t.id)?.cashBalances || {}

        const dollarClass =
          t.type === "cash_out" || t.type === "product_sale" || t.type === "income" ? "green" :
            t.type === "cash_in" || t.type === "product_purchase" || t.type === "expense" ? "red" : ""

        const badge = (val: number) =>
          val > 0
            ? '<span class="badge green-badge">قەرز</span>'
            : val < 0
              ? '<span class="badge red-badge">بە قەرز</span>'
              : '<span class="badge gray-badge">سفر</span>'

        const kurdishTypes: Record<string, string> = {
          product_purchase: "کڕینی کاڵا",
          product_sale: "فرۆشتنی کاڵا",
          product_in: "هاتنی کاڵا",
          product_out: "چوونی کاڵا",
          cash_in: "هاتنی پارە",
          cash_out: "چوونی پارە",
          expense: "خەرجی",
          income: "داهات"
        }

        // تعیین نام ارز این تراکنش
        const txCurrencyId = t.currencyId || baseCurrencyId
        const txCurrency = data.currencies.find(c => c.id === txCurrencyId)
        const currencyName = txCurrency ? txCurrency.name : "-"

        return `
        <tr>
          <td>${t.documentNumber || "-"}</td>
          <td>${kurdishTypes[t.type] || t.type}</td>
          <td>${currencyName}</td>
          ${displayCurrencies.map(c => {
          // آیا مبلغ این تراکنش مربوط به این ستون ارز است؟
          const isThisCurrency = c.id === txCurrencyId
          // اگر بله، مبلغ را نشان بده، وگرنه خط تیره
          if (isThisCurrency) {
            return `<td><span class="${dollarClass}">${(t.amount || 0).toLocaleString("en-US")}</span></td>`
          } else {
            return `<td>-</td>`
          }
        }).join("")}
          ${displayCurrencies.map(c => {
          const bal = balances[c.id] || 0
          return `<td>${bal.toLocaleString("en-US")} ${badge(bal)}</td>`
        }).join("")}
          <td>
            <div class="ltr">${formatDateGregorian(t.date)}</div>
          </td>
          <td>${t.description || "-"}</td>
        </tr>`
      })
      .join("")

    printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ku">
    <head>
      <meta charset="UTF-8">
      <title>لیستی بەڵگەنامەکان - ${customerName}</title>

      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css" rel="stylesheet">

      <style>
        @page { margin: 10mm; }
        body {
          font-family: 'vazirmatn','Vazir', Arial, sans-serif;
          direction: rtl;
          background: white;
          padding: 0;
          margin: 0;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          background: #f0fdf4;
          color: #1f2937;
          padding: 20px;
          border-radius: 12px;
          border: 2px solid #059669;
        }
        h1 {
          font-size: 28px;
          margin: 0 0 10px;
          font-weight: 800;
          color: #059669;
        }
        .customer-name {
          font-size: 24px;
          color: #374151;
          font-weight: 700;
          margin: 5px 0;
        }
        .meta {
          font-size: 14px;
          color: #6b7280;
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-top: 20px;
          background: white;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 8px 6px;
          text-align: center;
          vertical-align: middle;
        }
        th {
          background: #059669;
          color: white;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }
        tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }
        tbody tr:hover {
          background-color: #f0fdf4;
        }
        .green {
          color: #059669;
          font-weight: 700;
        }
        .red {
          color: #dc2626;
          font-weight: 700;
        }
        .badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          display: inline-block;
          margin-right: 4px;
        }
        .green-badge {
          background: #dcfce7;
          color: #166534;
        }
        .red-badge {
          background: #fee2e2;
          color: #991b1b;
        }
        .gray-badge {
          background: #f3f4f6;
          color: #374151;
        }
        .small { font-size: 10px; }
        .subtle { color: #9ca3af; }
        .ltr { direction: ltr; }
        .summary {
          margin-top: 30px;
          padding: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .summary h2 {
          font-size: 18px;
          margin: 0 0 15px;
          text-align: right;
          color: #334155;
          font-weight: 700;
          border-bottom: 2px solid #cbd5e1;
          padding-bottom: 8px;
        }
        .summary-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          justify-content: flex-start;
        }
        .summary-item {
          flex: 1;
          min-width: 200px;
          text-align: center;
          padding: 15px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .summary-label {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .summary-value {
          font-size: 20px;
          font-weight: 800;
          direction: ltr;
        }
        .summary-value.positive { color: #059669; }
        .summary-value.negative { color: #dc2626; }
        .summary-status {
          font-size: 12px;
          font-weight: 600;
          margin-top: 6px;
          padding: 2px 8px;
          border-radius: 12px;
          display: inline-block;
        }
        .summary-status.positive { background: #dcfce7; color: #166534; }
        .summary-status.negative { background: #fee2e2; color: #991b1b; }
        .summary-status.zero { background: #f1f5f9; color: #64748b; }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #9ca3af;
          font-size: 10px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>لیستی بەڵگەنامەکان</h1>
        <div class="customer-name">
          ${customerName}
          ${customerPhone ? `<span style="font-size: 20px; margin-right: 10px; color: #dcfce7;">(${customerPhone})</span>` : ""}
        </div>
        <div class="meta">
          ${dateFrom && dateTo ? `لە ${formatDate(dateFrom)} بۆ ${formatDate(dateTo)}` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ژمارە</th>
            <th>جۆر</th>
            <th>جۆری دراو</th>
            ${displayCurrencies.map(c => `<th>بڕ ${c.name}</th>`).join("")}
            ${displayCurrencies.map(c => `<th>ئاخیر حساب ${c.name}</th>`).join("")}
            <th>بەروار</th>
            <th>تێبینی</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="summary">
        <h2>گزارش حساب</h2>
        <div class="summary-grid">
          ${displayCurrencies.map(c => {
      let finalBal = 0
      if (sortedTransactions.length > 0) {
        const lastTx = sortedTransactions[sortedTransactions.length - 1]
        const lastBalMap = runningBalancesMap.get(lastTx.id)?.cashBalances
        if (lastBalMap) finalBal = lastBalMap[c.id] || 0
      }

      return `
              <div class="summary-item">
                <div class="summary-label">ئەنقەد ${c.name} لامانە</div>
                <div class="summary-value ${finalBal > 0 ? "positive" : finalBal < 0 ? "negative" : ""}">${finalBal.toLocaleString("en-US")}</div>
                <div class="summary-status ${finalBal > 0 ? "positive" : finalBal < 0 ? "negative" : "zero"}">
                  ${finalBal > 0 ? "قەرز" : finalBal < 0 ? "بە قەرز" : "سفر"}
                </div>
              </div>
            `
    }).join("")}
        </div>
      </div>
    </body>
    </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }



  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "شماره سند,نوع,مشتری,نوع محصول,مبلغ,تاریخ\n" +
      filteredTransactions
        .map(
          (t) =>
            `${t.documentNumber || ""},${getTransactionTypeLabel(t.type)},${getCustomerName(t.customerId)},${getProductTypeName(t.productTypeId)},${t.amount || 0},${formatDate(t.date)}`,
        )
        .join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "documents-list.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleEdit = (transaction: Transaction) => {
    if (onEdit) {
      onEdit(transaction)
    } else {
      // اگر onEdit پاس نشده، پیام نمایش می‌دهیم
      alert(`برای ویرایش سند شماره ${transaction.documentNumber || transaction.id}، به بخش ثبت اسناد بروید`)
    }
  }

  const handleDelete = (transaction: Transaction) => {
    if (confirm(`آیا از حذف سند شماره ${transaction.documentNumber || transaction.id} اطمینان دارید؟`)) {
      let transactionsToDelete = [transaction.id]

      // اگر سند اصلی است، تمام زیرسندهای آن را هم حذف کن
      if (transaction.isMainDocument) {
        const subDocs = data.transactions.filter(t => t.parentDocumentId === transaction.id)
        subDocs.forEach(sub => transactionsToDelete.push(sub.id))
      }

      // اگر تراکنش مرتبط دارد (روش قدیمی)، آن را هم حذف کن
      if (transaction.linkedTransactionId) {
        transactionsToDelete.push(transaction.linkedTransactionId)
      }

      // اگر خود این سند یک زیرسند است، شاید بهتر باشد سند اصلی آن هم حذف شود؟
      // فعلاً فقط خودش را حذف می‌کنیم، اما اگر منطق سیستم این است که زیرسند بدون سند اصلی معنا ندارد، باید بررسی شود.
      // اما چون کاربر ممکن است بخواهد فقط یک ردیف را حذف کند، همین کافی است.
      // نکته: در سیستم جدید، معمولاً کاربر با سند اصلی کار دارد.

      const updatedTransactions = data.transactions.filter((t) => !transactionsToDelete.includes(t.id))

      onDataChange({
        ...data,
        transactions: updatedTransactions,
      })
    }
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* فیلترها */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>فیلترهای جستجو</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">از تاریخ</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">تا تاریخ</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">مشتری</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="همه مشتریان" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه مشتریان</SelectItem>
                  {data.customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">گروه مشتری</label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="همه گروه‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه گروه‌ها</SelectItem>
                  {data.customerGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">نوع محصول</label>
              <Select value={filterProductType} onValueChange={setFilterProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="همه محصولات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه محصولات</SelectItem>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">نوع سند</label>
              <Select value={documentType} onValueChange={(value) => setDocumentType(value as "all" | "main" | "sub")}>
                <SelectTrigger>
                  <SelectValue placeholder="همه اسناد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه اسناد</SelectItem>
                  <SelectItem value="main">فقط اسناد اصلی</SelectItem>
                  <SelectItem value="sub">فقط زیرسندها</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">ارز</label>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCurrencies([])}
                  className={selectedCurrencies.length === 0 ? "bg-blue-50" : ""}
                >
                  {selectedCurrencies.length === 0 ? "✓ " : ""}تمامی ارزها
                </Button>
                <div className="flex flex-wrap gap-2">
                  {data.currencies?.map((currency) => (
                    <Button
                      key={currency.id}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedCurrencies.includes(currency.id)) {
                          setSelectedCurrencies(selectedCurrencies.filter(id => id !== currency.id))
                        } else {
                          setSelectedCurrencies([...selectedCurrencies, currency.id])
                        }
                      }}
                      className={selectedCurrencies.includes(currency.id) ? "bg-green-50 border-green-500" : ""}
                    >
                      {selectedCurrencies.includes(currency.id) ? "✓ " : ""}
                      {currency.name} ({currency.symbol})
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              onClick={handleToggleLast25}
              variant={showLast25Only ? "default" : "outline"}
              size="sm"
              className={showLast25Only ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {showLast25Only ? "✓ " : ""}نمایش 25 سند آخر
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="h-4 w-4 ml-2" />
              چاپ
            </Button>
            <Button onClick={handlePrintKurdish} variant="outline" size="sm" className="bg-green-50 hover:bg-green-100">
              <Printer className="h-4 w-4 ml-2" />
              پرینت - کوردی
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 ml-2" />
              خروجی CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* جدول اسناد */}
      <Card>
        <CardHeader className="print:pb-2">
          <CardTitle className="text-center print:text-lg"> لیست اسناد</CardTitle>
          <div className="text-center text-sm text-muted-foreground print:text-black print:text-xs">
            {showLast25Only && (
              <div className="text-blue-600 font-semibold mb-1">
                📌 نمایش 25 سند آخر
                {selectedCustomer && ` از مشتری ${getCustomerName(selectedCustomer)}`}
                {selectedGroup && ` از گروه ${data.customerGroups.find(g => g.id === selectedGroup)?.name}`}
                {(dateFrom || dateTo) && ` در بازه زمانی مشخص`}
              </div>
            )}
            {!showLast25Only && dateFrom && dateTo && `از ${formatDate(dateFrom)} تا ${formatDate(dateTo)}`}
            {!showLast25Only && selectedCustomer && ` - مشتری: ${getCustomerName(selectedCustomer)}`}
          </div>
          {sortedTransactions.length > 500 && !dateFrom && !dateTo && !showLast25Only && (
            <div className="text-center text-sm text-orange-600 mt-2 print:hidden">
              ⚠️ تعداد اسناد زیاد است ({sortedTransactions.length} سند). برای عملکرد بهتر، از فیلتر تاریخ استفاده کنید.
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto print:overflow-x-visible">
            <Table className="text-xs print:text-xs print:break-inside-avoid">
              <TableHeader>
                <TableRow>
                  <SortableHeader field="documentNumber">شماره</SortableHeader>
                  <SortableHeader field="type">نوع</SortableHeader>
                  <SortableHeader field="customer">مشتری</SortableHeader>
                  <SortableHeader field="productType">محصول</SortableHeader>
                  <SortableHeader field="productSale">مقدار</SortableHeader>
                  <SortableHeader field="unitPrice">سعر</SortableHeader>
                  <SortableHeader field="amount">مبلغ</SortableHeader>

                  {/* ستون‌های dynamic به ازای هر ارز */}
                  {displayCurrencies.map(currency => (
                    <SortableHeader key={currency.id} field={`balance_${currency.id}`}>
                      ت.حساب {currency.name}
                    </SortableHeader>
                  ))}

                  <SortableHeader field="productBalance">ت.حساب محصول</SortableHeader>
                  <SortableHeader field="date">تاریخ</SortableHeader>
                  <SortableHeader field="description">توضیح</SortableHeader>
                  <TableHead className="text-center print:hidden w-[80px]">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((transaction) => {
                  const runningBalance = runningBalancesMap.get(transaction.id)
                  const mainProductType = transaction.productTypeId && runningBalance
                    ? runningBalance.productBalances[transaction.productTypeId] || 0
                    : 0

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-center font-mono text-xs p-2">
                        {transaction.documentNumber || "-"}
                      </TableCell>
                      <TableCell className="text-center text-xs p-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {getTransactionTypeLabel(transaction.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs p-2 max-w-[100px] truncate">
                        {getCustomerName(transaction.customerId)}
                      </TableCell>
                      <TableCell className="text-center text-xs p-2 max-w-[80px] truncate">
                        {getProductTypeName(transaction.productTypeId)}
                      </TableCell>
                      <TableCell className="text-center text-xs p-2 whitespace-nowrap">{transaction.weight ? `${(transaction.weight || 0).toLocaleString()}` : "-"}</TableCell>
                      <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                        {(() => {
                          const unit = getUnitPrice(transaction)
                          return unit != null ? `${unit.toLocaleString()}` : "-"
                        })()}
                      </TableCell>

                      <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                        {transaction.type === "cash_in" ? (
                          <span className="text-red-600">
                            {(transaction.amount || 0).toLocaleString()}
                          </span>
                        ) : transaction.type === "cash_out" ? (
                          <span className="text-green-600">
                            {(transaction.amount || 0).toLocaleString()}
                          </span>
                        ) : transaction.type === "product_purchase" ? (
                          <span className="text-red-600">
                            {(transaction.amount || 0).toLocaleString()}
                          </span>
                        ) : transaction.type === "product_sale" ? (
                          <span className="text-green-600">
                            {(transaction.amount || 0).toLocaleString()}
                          </span>

                        ) : transaction.type === "expense" ? (
                          <span className="text-red-600">
                            {(transaction.amount || 0).toLocaleString()}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>



                      {/* ستون‌های dynamic ته حساب به ازای هر ارز */}
                      {displayCurrencies.map(currency => {
                        const balance = runningBalance?.cashBalances?.[currency.id] || 0
                        return (
                          <TableCell key={currency.id} className="text-center text-xs p-2">
                            <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                              <span className="text-[10px]">{balance.toLocaleString()}</span>
                              {debtBadge(balance)}
                            </div>
                          </TableCell>
                        )
                      })}

                      {/* ته حساب محصولی + Badge */}
                      <TableCell className="text-center text-xs p-2">
                        {(() => {
                          if (!runningBalance) return "-"
                          const mainProductType = transaction.productTypeId
                          if (!mainProductType) return "-"
                          const productVal = runningBalance.productBalances?.[mainProductType] || 0
                          return (
                            <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                              <span className="text-[10px]">{productVal.toLocaleString()}</span>
                              {debtBadge(productVal)}
                            </div>
                          )
                        })()}
                      </TableCell>

                      <TableCell className="text-center text-[10px] p-2 whitespace-nowrap">
                        <div>{formatDate(transaction.date)}</div>
                        <div className="text-muted-foreground">
                          {formatDateGregorian(transaction.date)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs p-2 max-w-[120px] truncate text-muted-foreground" title={transaction.description || "-"}>{transaction.description || "-"}</TableCell>
                      <TableCell className="text-center print:hidden p-1">
                        <div className="flex gap-0.5 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-600"
                            onClick={() => handleDelete(transaction)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* جمع کل */}
          <div className="mt-6 p-4 bg-muted rounded-lg print:bg-gray-100 print:mt-4 print:p-2 print:break-inside-avoid">
            <h3 className="font-semibold mb-3 text-center print:text-sm print:mb-2">خلاصه کل</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm print:grid-cols-5 print:gap-2 print:text-xs">
              <div className="text-center">
                <div className="font-medium print:text-xs">کل ورود محصول</div>
                <div className="text-lg font-bold text-blue-600 print:text-sm">
                  {totals.totalProductIn.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل خروج محصول</div>
                <div className="text-lg font-bold text-orange-600 print:text-sm">
                  {totals.totalProductOut.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل خرید محصول</div>
                <div className="text-lg font-bold text-green-600 print:text-sm">
                  {totals.totalProductPurchase.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل فروش محصول</div>
                <div className="text-lg font-bold text-purple-600 print:text-sm">
                  {totals.totalProductSale.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل مبلغ دلار</div>
                <div
                  className={`text-lg font-bold print:text-sm ${totals.totalAmount >= 0 ? "text-gray-800" : "text-red-600"}`}
                >
                  {totals.totalAmount.toLocaleString()} دلار
                </div>
              </div>

            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-6 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">تعداد در هر صفحه:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(val) => {
                setItemsPerPage(Number(val))
                setCurrentPage(1)
              }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                نمایش {startIndex + 1} تا {Math.min(endIndex, sortedTransactions.length)} از {sortedTransactions.length} سند
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                اولین
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                صفحه {currentPage} از {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                آخرین
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* دکمه چاپ آخرین اسناد (پایین صفحه) */}
      <div className="flex justify-center print:hidden">
        <Button variant="secondary" onClick={() => handlePrint()}>
          نسخه چاپیِ آخرین اسناد (همه صفحات)
        </Button>
      </div>
    </div>
  )
}
