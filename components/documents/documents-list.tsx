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
import { useLang } from "@/components/language-provider"
import type { Transaction, Customer, CustomerGroup, ProductType, Currency, BankAccount } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import { formatNumber } from "@/lib/number-utils"

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
  initialFilter?: { customerId?: string } | null
  onFilterClear?: () => void
}

export function DocumentsList({ data, onDataChange, onEdit, initialFilter, onFilterClear }: DocumentsListProps) {
  const { t, lang } = useLang()
  const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [showLast25Only, setShowLast25Only] = useState(true)
  const [filterProductType, setFilterProductType] = useState("all")
  const [documentType, setDocumentType] = useState<"all" | "main" | "sub">("sub") // فیلتر نوع سند
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]) // فیلتر ارزها - خالی یعنی همه

  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Apply initial filter
  useEffect(() => {
    if (initialFilter?.customerId) {
      setSelectedCustomer(initialFilter.customerId)
      // Optional: clear dates/other filters if desired when coming from customer list
      setDateFrom("")
      setDateTo("")
      // Notify parent we consumed the filter
      if (onFilterClear) onFilterClear()
    }
  }, [initialFilter, onFilterClear])

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

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
      className="text-center print:text-xs cursor-pointer hover:bg-muted/50 select-none p-1 h-auto"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </div>
    </TableHead>
  )


  // Badge برای نمایش بد/بس بر اساس علامت
  const debtBadge = (val: number) => {
    if (val > 0) {
      // مشتری بدهکارِ ماست → "بد" (سبز)
      return <span className="px-1 py-0 rounded-full bg-green-100 text-green-700 text-[9px]">{t("debtor")}</span>
    }
    if (val < 0) {
      // ما بدهکار مشتری‌ایم → "بس" (قرمز)
      return <span className="px-1 py-0 rounded-full bg-red-100 text-red-700 text-[9px]">{t("creditor")}</span>
    }
    // صفر
    return null
  }

  // ...

  const getCustomerName = (customerId: string) => {
    return data.customers.find((c) => c.id === customerId)?.name || t("unknown")
  }

  const getUnitPrice = (t: Transaction) => {
    if (t.unitPrice != null) return t.unitPrice
    if (t.amount != null && t.weight) {
      const raw = t.amount / t.weight
      return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : undefined
    }
    return undefined
  }

  // ...

  const getProductTypeName = (productTypeId?: string) => {
    if (!productTypeId) return "-"
    if (!productTypes || !Array.isArray(productTypes)) {
      return t("unknown")
    }

    const found = productTypes.find((f) => f.id === productTypeId)
    return found?.name || t("unknown")
  }

  const getTransactionTypeLabel = (type: string) => {
    const types = {
      product_purchase: t("productPurchase"),
      product_sale: t("productSale"),
      product_in: t("productIn"),
      product_out: t("productOut"),
      cash_in: t("cashIn"),
      cash_out: t("cashOut"),
      expense: t("expense"),
      income: t("income"),
      receivable: t("receivable"),
      payable: t("payable"),
    }
    return types[type as keyof typeof types] || type
  }


  const formatDate = (dateString: string) => {
    try {
      if (lang === "fa") return formatPersianDate(dateString)
      return formatGregorianDate(dateString)
    } catch (error) {
      return dateString
    }
  }

  // running balance ...
  const runningBalancesMap = useMemo(() => {
    const balanceMap = new Map<string, {
      cashBalances: { [currencyId: string]: number }
      productBalances: { [key: string]: { weight: number, quantity: number } }
    }>()
    const perCustomerBalance = new Map<string, {
      cashBalances: { [currencyId: string]: number }
      productBalances: { [key: string]: { weight: number, quantity: number } }
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
            const current = currentBalance.productBalances[transaction.productTypeId] || { weight: 0, quantity: 0 }
            currentBalance.productBalances[transaction.productTypeId] = {
              weight: current.weight - (transaction.weight || 0),
              quantity: current.quantity - (transaction.quantity || 0)
            }
          }
          break
        case "product_sale":
          currentBalance.cashBalances[currencyId] = currentCashBalance + amount
          if (transaction.productTypeId) {
            const current = currentBalance.productBalances[transaction.productTypeId] || { weight: 0, quantity: 0 }
            currentBalance.productBalances[transaction.productTypeId] = {
              weight: current.weight + (transaction.weight || 0),
              quantity: current.quantity + (transaction.quantity || 0)
            }
          }
          break
        case "product_in":
          if (transaction.productTypeId) {
            const current = currentBalance.productBalances[transaction.productTypeId] || { weight: 0, quantity: 0 }
            currentBalance.productBalances[transaction.productTypeId] = {
              weight: current.weight - (transaction.weight || 0),
              quantity: current.quantity - (transaction.quantity || 0)
            }
          }
          break
        case "product_out":
          if (transaction.productTypeId) {
            const current = currentBalance.productBalances[transaction.productTypeId] || { weight: 0, quantity: 0 }
            currentBalance.productBalances[transaction.productTypeId] = {
              weight: current.weight + (transaction.weight || 0),
              quantity: current.quantity + (transaction.quantity || 0)
            }
          }
          break
        case "cash_out":
        case "expense":
        case "receivable":
        case "payable": // Payable is now signed (negative), so we just add it
          currentBalance.cashBalances[currencyId] = currentCashBalance + amount
          if (transaction.productTypeId) {
            const current = currentBalance.productBalances[transaction.productTypeId] || { weight: 0, quantity: 0 }
            currentBalance.productBalances[transaction.productTypeId] = {
              weight: current.weight + (transaction.weight || 0),
              quantity: current.quantity + (transaction.quantity || 0)
            }
          }
          break
        case "cash_in":
        case "income":
          currentBalance.cashBalances[currencyId] = currentCashBalance - amount
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
      filtered = filtered.filter((t) => !t.isMainDocument)
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
          const aBal = a.productTypeId ? runningBalancesMap.get(a.id)?.productBalances[a.productTypeId] : null
          const bBal = b.productTypeId ? runningBalancesMap.get(b.id)?.productBalances[b.productTypeId] : null

          const aVal = aBal ? (aBal.weight || aBal.quantity || 0) : 0
          const bVal = bBal ? (bBal.weight || bBal.quantity || 0) : 0

          aValue = aVal
          bValue = bVal
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
      .map((tx) => {
        const rb = runningBalancesMap.get(tx.id) || { cashBalances: {}, productBalances: {} }
        const mainProductType = tx.productTypeId
        const productVal = mainProductType ? (rb.productBalances[mainProductType] || { weight: 0, quantity: 0 }) : { weight: 0, quantity: 0 }

        // رنگ‌ها برای ستون‌های مبلغ (مثل جدول اصلی)
        const dollarClass =
          tx.type === "cash_out" || tx.type === "product_sale" ? "green" :
            tx.type === "cash_in" || tx.type === "product_purchase" || tx.type === "expense" ? "red" : ""


        // Badge بد/بس
        const badge = (val: number) =>
          val > 0
            ? `<span class="badge green-badge">${t("debtor")}</span>`
            : val < 0
              ? `<span class="badge red-badge">${t("creditor")}</span>`
              : `<span class="badge gray-badge">-</span>`

        // Logic for Split Columns
        const isGoodsIn = ["product_purchase", "product_in"].includes(tx.type)
        const isGoodsOut = ["product_sale", "product_out"].includes(tx.type)
        const isDebtor = ["product_sale", "cash_out"].includes(tx.type)
        const isCreditor = ["product_purchase", "cash_in", "expense"].includes(tx.type)

        // Helper for Goods Display
        // Helper for Goods Display
        const formatGoods = (tx: Transaction) => {
          if (tx.weight) return `${formatNumber(tx.weight)} ${t(tx.weightUnit || "ton")}`
          if (tx.quantity) return `${formatNumber(tx.quantity)} ${t("count")}`
          return "-"
        }

        // قیمت واحد (اگه داری)
        const unit = getUnitPrice(tx)
        const unitCell = unit != null ? `${formatNumber(unit)} ${t("dollar")}/${t("ton")}` : "-"



        return `
        <tr>
          <td>${tx.documentNumber || "-"}</td>
          <td>${getTransactionTypeLabel(tx.type)}</td>
          <td>${getCustomerName(tx.customerId)}</td>
          <td>${getProductTypeName(tx.productTypeId)}</td>
          <td><span class="red">${isGoodsIn ? formatGoods(tx) : "-"}</span></td>
          <td><span class="green">${isGoodsOut ? formatGoods(tx) : "-"}</span></td>
          <td>${unitCell}</td>
          <td><span class="green">${isDebtor ? formatNumber(tx.amount || 0) : "-"}</span></td>
          <td><span class="red">${isCreditor ? formatNumber(tx.amount || 0) : "-"}</span></td>
          <td>${formatNumber(rb.cashBalances[tx.currencyId || "default"] || 0)} ${badge(rb.cashBalances[tx.currencyId || "default"] || 0)}</td>
          <td>
            ${productVal.weight ? formatNumber(productVal.weight) + " " + t(tx.weightUnit || "ton") : ""}
            ${productVal.weight && productVal.quantity ? " / " : ""}
            ${productVal.quantity ? formatNumber(productVal.quantity) + " " + t("count") : ""}
            ${!productVal.weight && !productVal.quantity ? "0" : ""}
            ${badge(productVal.weight || productVal.quantity || 0)}
          </td>
          <td>
            ${lang === "fa" ? `
              <div>${formatPersianDate(tx.date)}</div>
              <div class="subtle small">${formatGregorianDate(tx.date)}</div>
            ` : `
              <div>${formatGregorianDate(tx.date)}</div>
            `}
          </td>
          <td>${tx.description || "-"}</td>
        </tr>
      `
      })
      .join("")

    const customerLabel = selectedCustomer
      ? `${t("customer")}: ${getCustomerName(selectedCustomer)}`
      : t("allCustomers")

    const rangeLabel = (dateFrom && dateTo)
      ? `${t("fromDate")} ${formatDate(dateFrom)} ${t("toDate")} ${formatDate(dateTo)}`
      : ""

    printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="${lang === "fa" || (lang as string) === "ku" ? "rtl" : "ltr"}" lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <title>${t("printTitle")}</title>

      <!-- فونت وزیرمتن (گوگل) + وزیر (jsDelivr) -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css" rel="stylesheet">

      <style>
        @page { margin: 5mm; }
        body { font-family: 'vazirmatn','Vazir', Arial, sans-serif; direction: ${lang === "fa" || (lang as string) === "ku" ? "rtl" : "ltr"}; }
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
                <th style="width:5%">${t("documentNumber")}</th>
                <th style="width:8%">${t("type")}</th>
                <th style="width:12%">${t("customer")}</th>
                <th style="width:8%">${t("productType")}</th>
                <th style="width:6%">${t("colIn")}</th>
                <th style="width:6%">${t("colOut")}</th>
                <th style="width:8%">${t("unitPrice")}</th>
                <th style="width:8%">${t("debtor")}</th>
                <th style="width:8%">${t("creditor")}</th>
                <th style="width:12%">${t("balanceDollar")}</th>
                <th style="width:12%">${t("balanceProduct")}</th>
                <th style="width:9%">${t("date")}</th>
                <th>${t("description")}</th>
              </tr>
            </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">${t("reportGeneratedByZanyar")}</div>
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

    const customerName = customer ? customer.name : t("allCustomers")
    const customerPhone = customer?.phone || ""

    // پیدا کردن ارز پایه برای تشخیص ستون مبلغ
    const baseCurrencyId = data.currencies?.find(c => c.isBase)?.id || data.currencies?.[0]?.id || "default"

    const rowsHtml = sortedTransactions
      .map((tx) => {
        const balances = runningBalancesMap.get(tx.id)?.cashBalances || {}

        const dollarClass =
          tx.type === "cash_out" || tx.type === "product_sale" || tx.type === "income" ? "green" :
            tx.type === "cash_in" || tx.type === "product_purchase" || tx.type === "expense" ? "red" : ""

        const badge = (val: number) =>
          val > 0
            ? `<span class="badge green-badge">${t("debtor")}</span>`
            : val < 0
              ? `<span class="badge red-badge">${t("creditor")}</span>`
              : `<span class="badge gray-badge">${t("zero")}</span>`

        const kurdishTypes: Record<string, string> = {
          product_purchase: t("productPurchase"),
          product_sale: t("productSale"),
          product_in: t("productIn"),
          product_out: t("productOut"),
          cash_in: t("cashIn"),
          cash_out: t("cashOut"),
          expense: t("expense"),
          income: t("income")
        }

        // تعیین نام ارز این تراکنش
        const txCurrencyId = tx.currencyId || baseCurrencyId
        const txCurrency = data.currencies.find(c => c.id === txCurrencyId)
        const currencyName = txCurrency ? txCurrency.name : "-"

        return `
        <tr>
          <td>${tx.documentNumber || "-"}</td>
          <td>${kurdishTypes[tx.type] || tx.type}</td>
          <td>${currencyName}</td>
          ${displayCurrencies.map(c => {
          // آیا مبلغ این تراکنش مربوط به این ستون ارز است؟
          const isThisCurrency = c.id === txCurrencyId
          // اگر بله، مبلغ را نشان بده، وگرنه خط تیره
          if (isThisCurrency) {
            return `<td><span class="${dollarClass}">${formatNumber(tx.amount || 0)}</span></td>`
          } else {
            return `<td>-</td>`
          }
        }).join("")}
          ${displayCurrencies.map(c => {
          const bal = balances[c.id] || 0
          return `<td>${formatNumber(bal)} ${badge(bal)}</td>`
        }).join("")}
          <td>
            <div class="ltr">${formatGregorianDate(tx.date)}</div>
          </td>
          <td>${tx.description || "-"}</td>
        </tr>`
      })
      .join("")

    printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ku">
    <head>
      <meta charset="UTF-8">
      <title>${t("documentList")} - ${customerName}</title>

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
        <h1>${t("documentList")}</h1>
        <div class="customer-name">
          ${customerName}
          ${customerPhone ? `<span style="font-size: 20px; margin-right: 10px; color: #dcfce7;">(${customerPhone})</span>` : ""}
        </div>
        <div class="meta">
          ${dateFrom && dateTo ? `${t("from")} ${formatDate(dateFrom)} ${t("to")} ${formatDate(dateTo)}` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>${t("documentNumber")}</th>
            <th>${t("type")}</th>
            <th>${t("currencyType")}</th>
            ${displayCurrencies.map(c => `<th>${t("amount")} ${c.name}</th>`).join("")}
            ${displayCurrencies.map(c => `<th>${t("finalBalance")} ${c.name}</th>`).join("")}
            <th>${t("date")}</th>
            <th>${t("description")}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="summary">
        <h2>${t("accountReport")}</h2>
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
                <div class="summary-label">${t("currentBalance")} ${c.name}</div>
                <div class="summary-value ${finalBal > 0 ? "positive" : finalBal < 0 ? "negative" : ""}">${formatNumber(finalBal)}</div>
                <div class="summary-status ${finalBal > 0 ? "positive" : finalBal < 0 ? "negative" : "zero"}">
                  ${finalBal > 0 ? t("debtor") : finalBal < 0 ? t("creditor") : t("zero")}
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
      `${t("documentNumber")},${t("type")},${t("customer")},${t("productType")},${t("amount")},${t("date")}\n` +
      filteredTransactions
        .map(
          (tx) =>
            `${tx.documentNumber || ""},${getTransactionTypeLabel(tx.type)},${getCustomerName(tx.customerId)},${getProductTypeName(tx.productTypeId)},${tx.amount || 0},${formatDate(tx.date)}`,
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
      alert(`${t("editTransactionAlert")} ${transaction.documentNumber || transaction.id}`)
    }
  }

  const handleDelete = (transaction: Transaction) => {
    if (confirm(`${t("confirmDeleteTransaction")} ${transaction.documentNumber || transaction.id}?`)) {
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
          <CardTitle>{t("search")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("fromDate")}</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("toDate")}</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("customer")}</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder={t("allCustomers")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCustomers")}</SelectItem>
                  {data.customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("customerGroup")}</label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder={t("allGroups")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allGroups")}</SelectItem>
                  {data.customerGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("productType")}</label>
              <Select value={filterProductType} onValueChange={setFilterProductType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("allProducts")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allProducts")}</SelectItem>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("documentType")}</label>
              <Select value={documentType} onValueChange={(value) => setDocumentType(value as "all" | "main" | "sub")}>
                <SelectTrigger>
                  <SelectValue placeholder={t("allDocuments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allDocuments")}</SelectItem>
                  <SelectItem value="main">{t("documentTypeMain")}</SelectItem>
                  <SelectItem value="sub">{t("documentTypeSub")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("currency")}</label>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCurrencies([])}
                  className={selectedCurrencies.length === 0 ? "bg-blue-50" : ""}
                >
                  {selectedCurrencies.length === 0 ? "✓ " : ""}{t("allCurrencies")}
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
            <Button variant={showLast25Only ? "default" : "outline"} onClick={handleToggleLast25}>
              {showLast25Only ? t("showAll") : t("showLast25")}
            </Button>
            <Button variant="outline" onClick={handlePrintKurdish} className="gap-2">
              <Printer className="w-4 h-4" />
              {t("printKurdish")}
            </Button>
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              {t("printList")}
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              {t("exportCSV")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* جدول اسناد */}
      <Card>
        <CardHeader className="print:pb-2">
          <CardTitle className="text-center print:text-lg"> {t("documentList")}</CardTitle>
          <div className="text-center text-sm text-muted-foreground print:text-black print:text-xs">
            {showLast25Only && (
              <div className="text-blue-600 font-semibold mb-1">
                📌 {t("showingLast25Documents")}
                {selectedCustomer && ` ${t("fromCustomer")} ${getCustomerName(selectedCustomer)}`}
                {selectedGroup && ` ${t("fromGroup")} ${data.customerGroups.find(g => g.id === selectedGroup)?.name}`}
                {(dateFrom || dateTo) && ` ${t("inDateRange")}`}
              </div>
            )}
            {!showLast25Only && dateFrom && dateTo && `${t("from")} ${formatDate(dateFrom)} ${t("to")} ${formatDate(dateTo)}`}
            {!showLast25Only && selectedCustomer && ` - ${t("customer")}: ${getCustomerName(selectedCustomer)}`}
          </div>
          {sortedTransactions.length > 500 && !dateFrom && !dateTo && !showLast25Only && (
            <div className="text-center text-sm text-orange-600 mt-2 print:hidden">
              ⚠️ {t("tooManyDocumentsWarning").replace("{{count}}", String(sortedTransactions.length))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto print:overflow-x-visible">
            <Table className="text-xs print:text-xs print:break-inside-avoid">
              <TableHeader>
                <TableRow>
                  <SortableHeader field="documentNumber">{t("documentNumber")}</SortableHeader>
                  <SortableHeader field="type">{t("type")}</SortableHeader>
                  <SortableHeader field="customer">{t("customer")}</SortableHeader>
                  <SortableHeader field="productType">{t("productType")}</SortableHeader>
                  <SortableHeader field="productIn">{t("colIn")}</SortableHeader>
                  <SortableHeader field="productOut">{t("colOut")}</SortableHeader>
                  <SortableHeader field="unitPrice">{t("unitPrice")}</SortableHeader>
                  <SortableHeader field="amount">{t("debtor")}</SortableHeader>
                  <SortableHeader field="amount">{t("creditor")}</SortableHeader>
                  {/* ستون‌های dynamic به ازای هر ارز */}
                  {displayCurrencies.map(currency => (
                    <SortableHeader key={currency.id} field={`balance_${currency.id}`}>
                      {t("finalBalance")} {currency.name}
                    </SortableHeader>
                  ))}
                  <SortableHeader field="productBalance">{t("finalProductBalance")}</SortableHeader>
                  <SortableHeader field="date">{t("date")}</SortableHeader>
                  <SortableHeader field="description">{t("description")}</SortableHeader>
                  <TableHead className="text-center print:hidden w-[80px] p-1 h-auto">{t("actions")}</TableHead>
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
                      <TableCell className="text-center font-mono text-xs p-1">
                        {transaction.documentNumber || "-"}
                      </TableCell>
                      <TableCell className="text-center text-xs p-1">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {getTransactionTypeLabel(transaction.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs p-1 max-w-[80px] truncate">
                        {getCustomerName(transaction.customerId)}
                      </TableCell>
                      <TableCell className="text-center text-xs p-1 max-w-[60px] truncate">
                        {getProductTypeName(transaction.productTypeId)}
                      </TableCell>
                      <TableCell className="text-center text-xs p-1 whitespace-nowrap">
                        <span className="text-red-600 font-medium">
                          {["product_purchase", "product_in"].includes(transaction.type)
                            ? (transaction.weight
                              ? `${formatNumber(transaction.weight)} ${t(transaction.weightUnit || "ton")}`
                              : transaction.quantity
                                ? `${formatNumber(transaction.quantity)} ${t("count")}`
                                : "-")
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs p-1 whitespace-nowrap">
                        <span className="text-green-600 font-medium">
                          {["product_sale", "product_out"].includes(transaction.type)
                            ? (transaction.weight
                              ? `${formatNumber(transaction.weight)} ${t(transaction.weightUnit || "ton")}`
                              : transaction.quantity
                                ? `${formatNumber(transaction.quantity)} ${t("count")}`
                                : "-")
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs p-1 whitespace-nowrap">
                        {(() => {
                          const unit = getUnitPrice(transaction)
                          return unit != null ? `${formatNumber(unit)}` : "-"
                        })()}
                      </TableCell>

                      {/* Debtor (Green) */}
                      <TableCell className="text-center text-xs p-1 whitespace-nowrap">
                        {["product_sale", "cash_out"].includes(transaction.type) ? (
                          <span className="text-green-600 font-medium">
                            {formatNumber(transaction.amount || 0)}
                          </span>
                        ) : "-"}
                      </TableCell>

                      {/* Creditor (Red) */}
                      <TableCell className="text-center text-xs p-1 whitespace-nowrap">
                        {["product_purchase", "cash_in", "expense", "income"].includes(transaction.type) ? (
                          <span className="text-red-600 font-medium">
                            {formatNumber(transaction.amount || 0)}
                          </span>
                        ) : "-"}
                      </TableCell>



                      {/* ستون‌های dynamic ته حساب به ازای هر ارز */}
                      {displayCurrencies.map(currency => {
                        const balance = runningBalance?.cashBalances?.[currency.id] || 0
                        return (
                          <TableCell key={currency.id} className="text-center text-xs p-1">
                            <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                              <span className="text-[10px]">{formatNumber(balance)}</span>
                              {debtBadge(balance)}
                            </div>
                          </TableCell>
                        )
                      })}

                      {/* ته حساب محصولی + Badge */}
                      <TableCell className="text-center text-xs p-1">
                        {(() => {
                          if (!runningBalance) return "-"
                          const mainProductType = transaction.productTypeId
                          if (!mainProductType) return "-"
                          const productVal = runningBalance.productBalances?.[mainProductType] || { weight: 0, quantity: 0 }
                          return (
                            <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                              {productVal.weight ? (
                                <span>{formatNumber(productVal.weight)} {t(transaction.weightUnit || "ton")}</span>
                              ) : null}
                              {productVal.weight && productVal.quantity ? " / " : ""}
                              {productVal.quantity ? (
                                <span>{formatNumber(productVal.quantity)} {t("count")}</span>
                              ) : null}
                              {!productVal.weight && !productVal.quantity ? <span>0</span> : null}
                              {debtBadge(productVal.weight || productVal.quantity || 0)}
                            </div>
                          )
                        })()}
                      </TableCell>

                      <TableCell className="text-center text-[10px] p-1 whitespace-nowrap">
                        {lang === "fa" ? (
                          <>
                            <div>{formatDate(transaction.date)}</div>
                            <div className="text-muted-foreground">
                              {formatGregorianDate(transaction.date)}
                            </div>
                          </>
                        ) : (
                          <div className="font-medium">
                            {formatDate(transaction.date)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs p-1 max-w-[100px] truncate text-muted-foreground" title={transaction.description || "-"}>{transaction.description || "-"}</TableCell>
                      <TableCell className="text-center print:hidden p-0.5">
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
            <h3 className="font-semibold mb-3 text-center print:text-sm print:mb-2">{t("summaryTotal")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm print:grid-cols-5 print:gap-2 print:text-xs">
              <div className="text-center">
                <div className="font-medium print:text-xs">{t("totalProductIn")}</div>
                <div className="text-lg font-bold text-blue-600 print:text-sm">
                  {formatNumber(totals.totalProductIn)} {t("ton")}
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">{t("totalProductOut")}</div>
                <div className="text-lg font-bold text-orange-600 print:text-sm">
                  {formatNumber(totals.totalProductOut)} {t("ton")}
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">{t("totalProductPurchase")}</div>
                <div className="text-lg font-bold text-green-600 print:text-sm">
                  {formatNumber(totals.totalProductPurchase)} {t("ton")}
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">{t("totalProductSale")}</div>
                <div className="text-lg font-bold text-purple-600 print:text-sm">
                  {formatNumber(totals.totalProductSale)} {t("ton")}
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">{t("totalAmountDollar")}</div>
                <div
                  className={`text-lg font-bold print:text-sm ${totals.totalAmount >= 0 ? "text-gray-800" : "text-red-600"}`}
                >
                  {formatNumber(totals.totalAmount)} {t("dollar")}
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
