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
import type { Transaction, Customer, CustomerGroup, FlourType, unitPrice } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
const getAmountClass = (type: string) => {
    // نوع‌هایی که باید سبز باشند
    const green = new Set([
        "toman_out",     // خروج تومن
        "cash_out",      // خروج وجه (دلار)
        "flour_out",     // خروج آرد
        "flour_purchase" // خرید آرد
    ])

    // نوع‌هایی که باید قرمز باشند
    const red = new Set([
        "toman_in",   // ورود تومن
        "cash_in",    // ورود وجه (دلار)
        "flour_in",   // ورود آرد
        "flour_sale", // فروش آرد
        "expense"     // هزینه
    ])

    if (green.has(type)) return "text-green-600"
    if (red.has(type)) return "text-red-600"
    return "" // پیش‌فرض
}
type RunningBalance = {
    dollar: number
    toman: number
    flour: number // وزن خالص آرد
}

function deltaFromTransaction(tx: Transaction) {
    let dollar = 0
    let toman = 0
    let flour = 0
    const amt = Number(tx.amount || 0)
    const w = Number(tx.weight || 0)

    // پول نقد دلاری
    if (tx.type === "cash_in") dollar += amt
    if (tx.type === "cash_out") dollar -= amt

    // تومان
    if (tx.type === "toman_in") toman += amt
    if (tx.type === "toman_out") toman -= amt

    // آرد/وزن
    if (tx.type === "flour_in" || tx.type === "flour_purchase") flour += w
    if (tx.type === "flour_out" || tx.type === "flour_sale") flour -= w

    return { dollar, toman, flour }
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
        const prev = perCustomerAcc.get(cid) || { dollar: 0, toman: 0, flour: 0 }
        const d = deltaFromTransaction(tx)
        const next: RunningBalance = {
            dollar: prev.dollar + d.dollar,
            toman: prev.toman + d.toman,
            flour: prev.flour + d.flour,
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
    flourTypes: FlourType[]
  }
  onDataChange: (data: any) => void
  onEdit?: (transaction: Transaction) => void
}

export function DocumentsList({ data, onDataChange, onEdit }: DocumentsListProps) {
  const [flourTypes] = useLocalStorageGeneric<FlourType[]>("flourTypes", [])

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [showLast25Only, setShowLast25Only] = useState(false)

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


  const getFlourTypeName = (flourTypeId?: string) => {
    if (!flourTypeId) return "-"
    if (!flourTypes || !Array.isArray(flourTypes)) {
      return "نامشخص"
    }

    const found = flourTypes.find((f) => f.id === flourTypeId)
    return found?.name || "نامشخص"
  }

  const getTransactionTypeLabel = (type: string) => {
    const types = {
      flour_purchase: "خرید آرد",
      flour_sale: "فروش آرد",
      flour_in: "ورود آرد",
      flour_out: "خروج آرد",
      cash_in: "هه یه تی دولار",
      cash_out: "لایه تی دولار",
      expense: "هزینه",
      toman_in: "ورود تومن",
      toman_out: "خروج تومن",
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
    const balanceMap = new Map<string, { cashBalance: number; tomanBalance: number; flourBalances: { [key: string]: number } }>()
    const perCustomerBalance = new Map<string, { cashBalance: number; tomanBalance: number; flourBalances: { [key: string]: number } }>()

    // مرتب‌سازی همه اسناد بر اساس تاریخ
    const allTransactionsSorted = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    allTransactionsSorted.forEach((transaction) => {
      const customerId = transaction.customerId
      const currentBalance = perCustomerBalance.get(customerId) || { cashBalance: 0, tomanBalance: 0, flourBalances: {} }

      switch (transaction.type) {
        case "flour_purchase":
          currentBalance.cashBalance -= transaction.amount || 0
          if (transaction.flourTypeId) {
            currentBalance.flourBalances[transaction.flourTypeId] =
              (currentBalance.flourBalances[transaction.flourTypeId] || 0) + (transaction.weight || 0)
          }
          break
        case "flour_sale":
          currentBalance.cashBalance += transaction.amount || 0
          if (transaction.flourTypeId) {
            currentBalance.flourBalances[transaction.flourTypeId] =
              (currentBalance.flourBalances[transaction.flourTypeId] || 0) - (transaction.weight || 0)
          }
          break
        case "flour_in":
          if (transaction.flourTypeId) {
            currentBalance.flourBalances[transaction.flourTypeId] =
              (currentBalance.flourBalances[transaction.flourTypeId] || 0) - (transaction.weight || 0)
          }
          break
        case "flour_out":
          if (transaction.flourTypeId) {
            currentBalance.flourBalances[transaction.flourTypeId] =
              (currentBalance.flourBalances[transaction.flourTypeId] || 0) + (transaction.weight || 0)
          }
          break
        case "cash_in":
          currentBalance.cashBalance -= transaction.amount || 0
          break
        case "cash_out":
          currentBalance.cashBalance += transaction.amount || 0
          break
        case "expense":
          currentBalance.cashBalance -= transaction.amount || 0
          break
        case "toman_in":
          currentBalance.tomanBalance -= transaction.amount || 0
          break
        case "toman_out":
          currentBalance.tomanBalance += transaction.amount || 0
          break
      }

      balanceMap.set(transaction.id, {
        cashBalance: currentBalance.cashBalance,
        tomanBalance: currentBalance.tomanBalance,
        flourBalances: { ...currentBalance.flourBalances }
      })

      perCustomerBalance.set(customerId, currentBalance)
    })

    return balanceMap
  }, [data.transactions])

  // فیلتر اسناد (بعد از محاسبه running balance)
  const filteredTransactions = useMemo(() => {
    let filtered = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // اول فیلترهای دیگه رو اعمال می‌کنیم
    if (dateFrom) {
      filtered = filtered.filter((t) => t.date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((t) => t.date <= dateTo)
    }
    if (selectedCustomer) {
      filtered = filtered.filter((t) => t.customerId === selectedCustomer)
    }
    if (selectedGroup) {
      const groupCustomers = data.customers.filter((c) => c.groupId === selectedGroup)
      filtered = filtered.filter((t) => groupCustomers.some((c) => c.id === t.customerId))
    }

    // در آخر، اگر فیلتر "25 سند آخر" فعال باشه، فقط 25 تای آخر از نتایج فیلتر شده رو برمی‌گردونیم
    if (showLast25Only) {
      return filtered.slice(-25)
    }

    return filtered
  }, [data.transactions, dateFrom, dateTo, selectedCustomer, selectedGroup, data.customers, showLast25Only])

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
          case "flourType":
            aValue = getFlourTypeName(a.flourTypeId)
            bValue = getFlourTypeName(b.flourTypeId)
            break
          case "flourIn":
            aValue = a.type === "flour_in" ? a.weight || 0 : 0
            bValue = b.type === "flour_in" ? b.weight || 0 : 0
            break
          case "flourOut":
            aValue = a.type === "flour_out" ? a.weight || 0 : 0
            bValue = b.type === "flour_out" ? b.weight || 0 : 0
            break
          case "flourPurchase":
            aValue = a.type === "flour_purchase" ? a.weight || 0 : 0
            bValue = b.type === "flour_purchase" ? b.weight || 0 : 0
            break
          case "flourSale":
            aValue = a.type === "flour_sale" ? a.weight || 0 : 0
            bValue = b.type === "flour_sale" ? b.weight || 0 : 0
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
          aValue = runningBalancesMap.get(a.id)?.cashBalance || 0
          bValue = runningBalancesMap.get(b.id)?.cashBalance || 0
            break
          case "tomanBalance":
          aValue = runningBalancesMap.get(a.id)?.tomanBalance || 0
          bValue = runningBalancesMap.get(b.id)?.tomanBalance || 0
            break
          case "flourBalance":
            const aFlourBalance = a.flourTypeId
            ? runningBalancesMap.get(a.id)?.flourBalances[a.flourTypeId] || 0
              : 0
            const bFlourBalance = b.flourTypeId
            ? runningBalancesMap.get(b.id)?.flourBalances[b.flourTypeId] || 0
              : 0
            aValue = aFlourBalance
            bValue = bFlourBalance
            break
          default:
            return 0
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

  // محاسبه جمع کل
  const totals = useMemo(() => {
    let totalAmount = 0
    let totalTomanAmount = 0
    let totalFlourIn = 0
    let totalFlourOut = 0
    let totalFlourPurchase = 0
    let totalFlourSale = 0

    sortedTransactions.forEach((transaction) => {
      if (transaction.type === "toman_in" || transaction.type === "toman_out") {
        totalTomanAmount += transaction.amount || 0
      } else {
        totalAmount += transaction.amount || 0
      }
      if (transaction.type === "flour_in") totalFlourIn += transaction.weight || 0
      if (transaction.type === "flour_out") totalFlourOut += transaction.weight || 0
      if (transaction.type === "flour_purchase") totalFlourPurchase += transaction.weight || 0
      if (transaction.type === "flour_sale") totalFlourSale += transaction.weight || 0
    })

    return { totalAmount, totalTomanAmount, totalFlourIn, totalFlourOut, totalFlourPurchase, totalFlourSale }
  }, [sortedTransactions])

  // Pagination logic
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFrom, dateTo, selectedCustomer, selectedGroup, showLast25Only])

  // تابع برای فعال/غیرفعال کردن فیلتر "25 سند آخر"
  const handleToggleLast25 = () => {
    setShowLast25Only(!showLast25Only)
    setCurrentPage(1)
  }

  // Debug logging
  useEffect(() => {
    console.log("[DocumentsList] Total transactions:", data.transactions.length)
    console.log("[DocumentsList] Filtered transactions:", filteredTransactions.length)
    console.log("[DocumentsList] Sorted transactions:", sortedTransactions.length)
    console.log("[DocumentsList] Paginated transactions:", paginatedTransactions.length)
    console.log("[DocumentsList] Current page:", currentPage, "Items per page:", itemsPerPage)
  }, [data.transactions.length, filteredTransactions.length, sortedTransactions.length, paginatedTransactions.length, currentPage, itemsPerPage])

    const handlePrint = () => {
        const printWindow = window.open("", "_blank")
        if (!printWindow) return

        const rowsHtml = sortedTransactions
            .map((t) => {
                const rb = runningBalancesMap.get(t.id)
                if (!rb) return ""
                const flourVal = t.flourTypeId ? (rb.flourBalances[t.flourTypeId] || 0) : 0

                // رنگ‌ها برای ستون‌های مبلغ (مثل جدول اصلی)
                const dollarClass =
                    t.type === "cash_out" || t.type === "flour_sale" ? "green" :
                        t.type === "cash_in" || t.type === "flour_purchase" || t.type === "expense" ? "red" : ""
                const tomanClass =
                    t.type === "toman_out" ? "green" :
                        t.type === "toman_in" ? "red" : ""

                // Badge بد/بس
                const badge = (val: number) =>
                    val > 0
                        ? '<span class="badge green-badge">لایه تی</span>'
                        : val < 0
                            ? '<span class="badge red-badge">هه یه تی</span>'
                            : '<span class="badge gray-badge">صفر</span>'

                // قیمت واحد (اگه داری)
                const unit =
                    (t.type === "toman_in" || t.type === "toman_out") ? undefined : getUnitPrice(t)
                const unitCell =
                    (t.type === "toman_in" || t.type === "toman_out")
                        ? "-"
                        : (unit != null ? `${unit.toLocaleString("en-US")} دولار/تن` : "-")

                return `
        <tr>
          <td>${t.documentNumber || "-"}</td>
          <td>${getTransactionTypeLabel(t.type)}</td>
          <td>${getCustomerName(t.customerId)}</td>
          <td>${getFlourTypeName(t.flourTypeId)}</td>
          <td>${t.weight ? (t.weight).toLocaleString("en-US") + " تن" : "-"}</td>
          <td>${unitCell}</td>
          <td>${(t.type === "toman_in" || t.type === "toman_out")
                        ? "-"
                        : `<span class="${dollarClass}">${(t.amount || 0).toLocaleString("en-US")} دولار</span>`}
          </td>
          <td>${(t.type === "toman_in" || t.type === "toman_out")
                        ? `<span class="${tomanClass}">${(t.amount || 0).toLocaleString("en-US")} تمن</span>`
                        : "-"}
          </td>
          <td>${(rb.tomanBalance || 0).toLocaleString("en-US")} ${badge(rb.tomanBalance || 0)}</td>
          <td>${(rb.cashBalance || 0).toLocaleString("en-US")} ${badge(rb.cashBalance || 0)}</td>
          <td>${flourVal.toLocaleString("en-US")} ${badge(flourVal)}</td>
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
        .green { color: #059669; }   /* خروج وجه/تومن، فروش آرد */
        .red   { color: #dc2626; }   /* ورود وجه/تومن، خرید آرد */
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
            <th>نوع آرد</th>
            <th>مقدار</th>
            <th>سعر</th>
            <th>مبلغ (دلار)</th>
            <th>تومن</th>
            <th>آخیر حساب تمن</th>
            <th>آخیر حساب دولار</th>
            <th>آخیر حساب آرد</th>
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



  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "شماره سند,نوع,مشتری,نوع آرد,مبلغ,تاریخ\n" +
      filteredTransactions
        .map(
          (t) =>
            `${t.documentNumber || ""},${getTransactionTypeLabel(t.type)},${getCustomerName(t.customerId)},${getFlourTypeName(t.flourTypeId)},${t.amount || 0},${formatDate(t.date)}`,
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
      const updatedTransactions = data.transactions.filter((t) => t.id !== transaction.id)
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
                  <SortableHeader field="flourType">آرد</SortableHeader>
                  <SortableHeader field="flourSale">مقدار</SortableHeader>
                  <SortableHeader field="unitPrice">سعر</SortableHeader>
                  <SortableHeader field="amount">مبلغ</SortableHeader>
                  <SortableHeader field="tomanBalance">ت.حساب تومن</SortableHeader>
                  <SortableHeader field="cashBalance">ت.حساب دلار</SortableHeader>
                  <SortableHeader field="flourBalance">ت.حساب آرد</SortableHeader>
                  <SortableHeader field="date">تاریخ</SortableHeader>
                  <SortableHeader field="description">توضیح</SortableHeader>
                  <TableHead className="text-center print:hidden w-[80px]">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((transaction) => {
                  const runningBalance = runningBalancesMap.get(transaction.id)
                  const mainFlourType = transaction.flourTypeId && runningBalance
                    ? runningBalance.flourBalances[transaction.flourTypeId] || 0
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
                        {getFlourTypeName(transaction.flourTypeId)}
                      </TableCell>
                      <TableCell className="text-center text-xs p-2 whitespace-nowrap">{transaction.weight ? `${(transaction.weight || 0).toLocaleString()}` : "-"}</TableCell>
                      <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                              {transaction.type === "toman_in" || transaction.type === "toman_out" ? (
                                  "-"
                              ) : (
                                  (() => {
                                      const unit = getUnitPrice(transaction)
                                  return unit != null ? `${unit.toLocaleString()}` : "-"
                                  })()
                              )}
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
                              ) : transaction.type === "flour_purchase" ? (
                                  <span className="text-red-600">
                                  {(transaction.amount || 0).toLocaleString()}
                                  </span>
                              ) : transaction.type === "flour_sale" ? (
                                  <span className="text-green-600">
                                  {(transaction.amount || 0).toLocaleString()}
                                  </span>
                          ) : transaction.type === "toman_in" ? (
                                  <span className="text-red-600">
                                  {(transaction.amount || 0).toLocaleString()}
                                  </span>
                              ) : transaction.type === "toman_out" ? (
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

                          {/* ته حساب تومنی + Badge */}
                      <TableCell className="text-center text-xs p-2">
                          <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                              <span className="text-[10px]">{runningBalance ? runningBalance.tomanBalance.toLocaleString() : "-"}</span>
                                  {runningBalance ? debtBadge(runningBalance.tomanBalance) : null}
                              </div>
                          </TableCell>

                          {/* ته حساب دلاری + Badge */}
                      <TableCell className="text-center text-xs p-2">
                          <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                              <span className="text-[10px]">{runningBalance ? runningBalance.cashBalance.toLocaleString() : "-"}</span>
                                  {runningBalance ? debtBadge(runningBalance.cashBalance) : null}
                              </div>
                          </TableCell>

                          {/* ته حساب آردی + Badge */}
                      <TableCell className="text-center text-xs p-2">
                              {(() => {
                                  if (!runningBalance) return "-"
                                  const mainFlourType = transaction.flourTypeId
                                  if (!mainFlourType) return "-"
                                  const flourVal = runningBalance.flourBalances?.[mainFlourType] || 0
                                  return (
                                  <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                      <span className="text-[10px]">{flourVal.toLocaleString()}</span>
                                          {debtBadge(flourVal)}
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
                <div className="font-medium print:text-xs">کل ورود آرد</div>
                <div className="text-lg font-bold text-blue-600 print:text-sm">
                  {totals.totalFlourIn.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل خروج آرد</div>
                <div className="text-lg font-bold text-orange-600 print:text-sm">
                  {totals.totalFlourOut.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل خرید آرد</div>
                <div className="text-lg font-bold text-green-600 print:text-sm">
                  {totals.totalFlourPurchase.toLocaleString()} تن
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium print:text-xs">کل فروش آرد</div>
                <div className="text-lg font-bold text-purple-600 print:text-sm">
                  {totals.totalFlourSale.toLocaleString()} تن
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
              <div className="text-center">
                <div className="font-medium print:text-xs">کل مبلغ تومن</div>
                <div
                  className={`text-lg font-bold print:text-sm ${totals.totalTomanAmount >= 0 ? "text-gray-800" : "text-red-600"}`}
                >
                  {totals.totalTomanAmount.toLocaleString()} تومن
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
