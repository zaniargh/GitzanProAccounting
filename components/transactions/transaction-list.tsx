"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Package, DollarSign, Search, Trash2, ArrowUp, ArrowDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import type { AppData, TransactionType, ProductType, Transaction } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import { formatBothDatesWithTime } from "@/lib/date-utils"
import { buildLetterheadHTML, type CompanyInfo } from "@/components/print/build-letterhead-html"
import { useLang } from "@/components/language-provider"


const getAmountClass = (amount: number) => {
  // amount مثبت = سبز (دارایی زیاد یا بدهی کم)
  // amount منفی = قرمز (دارایی کم یا بدهی زیاد)
  if (amount > 0) return "text-green-600"
  if (amount < 0) return "text-red-600"
  return "" // صفر
}

interface TransactionListProps {
  data: AppData
  onDataChange: (data: AppData) => void
  onEdit?: (transaction: any) => void
}

type SortField = "documentNumber" | "type" | "customer" | "productType" | "weight" | "quantity" | "unitPrice" | "amount" | "date" | "description"
type SortDirection = "asc" | "desc"

const TruncatedTooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isTruncated, setIsTruncated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkTruncation = () => {
      if (ref.current) {
        setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth)
      }
    }

    checkTruncation()
    window.addEventListener("resize", checkTruncation)
    return () => window.removeEventListener("resize", checkTruncation)
  }, [text])

  if (!isTruncated) {
    return <div ref={ref} className="truncate">{children}</div>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div ref={ref} className="truncate cursor-default">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function TransactionList({ data, onDataChange, onEdit }: TransactionListProps) {
  const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])
  const { t, lang } = useLang()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<TransactionType | "all">("all")
  const [filterCustomer, setFilterCustomer] = useState("all")
  const [filterProductType, setFilterProductType] = useState("all")
  const [displayWeightUnit, setDisplayWeightUnit] = useState("original")

  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set()) // Track which main docs are expanded

  const convertWeight = (weight: number, fromUnit: string, toUnit: string) => {
    if (fromUnit === toUnit) return weight
    if (toUnit === "original") return weight

    // Convert to Ton first
    let weightInTon = weight
    switch (fromUnit) {
      case "kg": weightInTon = weight / 1000; break;
      case "g": weightInTon = weight / 1000000; break;
      case "mg": weightInTon = weight / 1000000000; break;
      case "lb": weightInTon = weight / 2204.62; break;
      case "ton": default: weightInTon = weight; break;
    }

    // Convert from Ton to target unit
    switch (toUnit) {
      case "kg": return weightInTon * 1000;
      case "g": return weightInTon * 1000000;
      case "mg": return weightInTon * 1000000000;
      case "lb": return weightInTon * 2204.62;
      case "ton": default: return weightInTon;
    }
  }

  const convertWeightToTons = (weight: number | undefined, weightUnit: string | undefined): number => {
    if (!weight) return 0
    let weightInTon = weight
    if (weightUnit === "kg") {
      weightInTon = weight / 1000
    }
    return weightInTon
  }

  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const getCustomerName = (customerId: string) => {
    const customer = data.customers.find((c) => c.id === customerId)
    if (customer) {
      // ترجمه حساب‌های پیش‌فرض
      if (customer.id === "default-cash-safe") {
        return lang === "fa" ? "صندوق" : "Cash Box"
      } else if (customer.id === "default-warehouse") {
        return lang === "fa" ? "موجودی" : "Inventory"
      }
      return customer.name
    }

    const bankAccount = data.bankAccounts?.find((b) => b.id === customerId)
    if (bankAccount) return `${bankAccount.bankName} - ${bankAccount.accountHolder}`

    return t("unknown")
  }

  const getProductTypeName = (productTypeId?: string) => {
    if (!productTypeId) return "-"
    return productTypes.find((productType) => productType.id === productTypeId)?.name || t("unknown")
  }

  // Calculate totals from subdocuments for main document display
  const getSubdocumentTotals = (mainDocId: string) => {
    const subdocs = getSubdocuments(mainDocId)

    const initialGoods = () => ({ weight: 0, quantity: 0 })
    const initialMoney = () => ({} as Record<string, number>)

    const totals = {
      goodsIn: initialGoods(),
      goodsOut: initialGoods(),
      goodsCredit: initialGoods(),
      goodsDebit: initialGoods(),
      moneyIn: initialMoney(),
      moneyOut: initialMoney(),
      moneyCredit: initialMoney(),
      moneyDebit: initialMoney(),
      hasData: false,
      weightUnit: "ton" // Default to ton
    }

    if (subdocs.length === 0) return null

    let commonUnit: string | null = null
    let mixedUnits = false

    subdocs.forEach(sub => {
      totals.hasData = true

      // Check for common weight unit
      if (sub.weight && sub.weightUnit) {
        if (commonUnit === null) {
          commonUnit = sub.weightUnit
        } else if (commonUnit !== sub.weightUnit) {
          mixedUnits = true
        }
      }

      // Helper to add goods
      const addGoods = (target: { weight: number, quantity: number }) => {
        if (sub.weight) {
          // Normalize to ton for aggregation
          const w = convertWeight(Math.abs(sub.weight), sub.weightUnit || "ton", "ton")
          target.weight += w
        }
        if (sub.quantity) target.quantity += Math.abs(sub.quantity)
      }

      // Helper to add money
      const addMoney = (target: Record<string, number>) => {
        if (sub.amount) {
          const currency = sub.currencyId || (data.currencies?.find(c => c.isBase)?.id || "default")
          target[currency] = (target[currency] || 0) + Math.abs(sub.amount)
        }
      }

      // Goods Logic
      if (sub.type === "product_in" || sub.type === "income") addGoods(totals.goodsIn)
      if (sub.type === "product_out" || sub.type === "expense") addGoods(totals.goodsOut)
      if ((sub.type === "product_purchase" || sub.type === "payable") && (sub.weight || sub.quantity)) addGoods(totals.goodsCredit)
      if ((sub.type === "product_sale" || sub.type === "receivable") && (sub.weight || sub.quantity)) addGoods(totals.goodsDebit)

      // Money Logic
      if (sub.type === "cash_in" || sub.type === "income") addMoney(totals.moneyIn)
      if (sub.type === "cash_out" || sub.type === "expense") addMoney(totals.moneyOut)
      if ((sub.type === "product_purchase" || sub.type === "payable") && sub.amount) addMoney(totals.moneyCredit)
      if ((sub.type === "product_sale" || sub.type === "receivable") && sub.amount) addMoney(totals.moneyDebit)
    })

    if (!mixedUnits && commonUnit) {
      totals.weightUnit = commonUnit
    }

    return totals
  }

  const renderAggregatedMoney = (moneyMap: Record<string, number>, colorClass: string) => {
    const entries = Object.entries(moneyMap)
    if (entries.length === 0) return "-"
    return (
      <div className="flex flex-col gap-1 items-center">
        {entries.map(([currId, amount]) => {
          const symbol = data.currencies?.find(c => c.id === currId)?.symbol || "$"
          return (
            <span key={currId} className={`font-bold ${colorClass}`}>
              {formatNumber(amount)} <span className="text-[10px] text-gray-500 ml-0.5">{symbol}</span>
            </span>
          )
        })}
      </div>
    )
  }

  const renderAggregatedGoods = (goods: { weight: number, quantity: number }, colorClass: string, originalUnit: string = "ton") => {
    if (!goods.weight && !goods.quantity) return "-"

    // If original, we default to ton for aggregated values because they are normalized to ton
    const targetUnit = displayWeightUnit === "original" ? originalUnit : displayWeightUnit

    // Convert weight to display unit
    const displayW = convertWeight(goods.weight, "ton", targetUnit)

    return (
      <span className={`font-medium ${colorClass}`}>
        {goods.quantity ? (
          <>
            {formatNumber(goods.quantity)} <span className="text-[10px] text-gray-500 ml-0.5">(Count)</span>
          </>
        ) : null}
        {goods.quantity && goods.weight ? " / " : ""}
        {goods.weight ? (
          <>
            {formatNumber(displayW)} <span className="text-[10px] text-gray-500 ml-0.5">({t(`weightUnit_${targetUnit}`) || targetUnit})</span>
          </>
        ) : null}
      </span>
    )
  }

  const getTransactionTypeInfo = (transaction: Transaction) => {
    // If this is a main document, show "MainDocument" instead of the type
    if (transaction.isMainDocument) {
      console.log("Main document found:", transaction.documentNumber, transaction)
      return {
        label: "MainDocument",
        icon: Package,
        color: "bg-indigo-100 text-indigo-800",
        arrow: ArrowDown
      }
    }

    const type = transaction.type
    const isBankAccount = transaction.accountId && transaction.accountId !== "default-cash-safe"

    switch (type) {
      case "product_in":
        return { label: t("productIn"), icon: Package, color: "bg-red-100 text-red-800", arrow: ArrowDown }
      case "product_out":
        return { label: t("productOut"), icon: Package, color: "bg-green-100 text-green-800", arrow: ArrowUp }
      case "product_purchase":
        return { label: t("productPurchase"), icon: Package, color: "bg-blue-100 text-blue-800", arrow: ArrowDown }
      case "product_sale":
        return { label: t("productSale"), icon: Package, color: "bg-purple-100 text-purple-800", arrow: ArrowUp }
      case "cash_in":
        return {
          label: isBankAccount ? t("bankReceipt") : t("cashReceipt"),
          icon: DollarSign,
          color: "bg-green-100 text-green-800",
          arrow: ArrowDown
        }
      case "cash_out":
        return {
          label: isBankAccount ? t("bankWithdrawal") : t("cashPayment"),
          icon: DollarSign,
          color: "bg-red-100 text-red-800",
          arrow: ArrowUp
        }
      case "expense":
        return { label: t("expense"), icon: DollarSign, color: "bg-green-100 text-green-800", arrow: ArrowUp }
      case "income":
        return { label: t("income"), icon: DollarSign, color: "bg-red-100 text-red-800", arrow: ArrowDown }
      case "receivable":
        return { label: t("receivable"), icon: Package, color: "bg-green-100 text-green-800", arrow: ArrowUp }
      case "payable":
        return { label: t("payable"), icon: Package, color: "bg-red-100 text-red-800", arrow: ArrowDown }
      default:
        return { label: t("unknown"), icon: DollarSign, color: "bg-gray-100 text-gray-800", arrow: ArrowDown }
    }
  }

  const filteredTransactions = useMemo(() => {
    // ابتدا همه تراکنش‌ها را فیلتر کنیم (شامل main و sub)
    const matchingTransactions = data.transactions.filter((transaction) => {
      const typeInfo = getTransactionTypeInfo(transaction)
      const customerName = getCustomerName(transaction.customerId)
      const productTypeName = getProductTypeName(transaction.productTypeId)
      const searchLower = searchTerm.toLowerCase()

      const matchesSearch = transaction.documentNumber.toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower) ||
        productTypeName.toLowerCase().includes(searchLower) ||
        typeInfo.label.toLowerCase().includes(searchLower) ||
        transaction.description.toLowerCase().includes(searchLower)

      const matchesType = filterType === "all" || transaction.type === filterType
      const matchesCustomer = filterCustomer === "all" || transaction.customerId === filterCustomer
      const matchesProductType = filterProductType === "all" || transaction.productTypeId === filterProductType



      return matchesSearch && matchesType && matchesCustomer && matchesProductType
    })

    // حالا فقط main documents را برگردان، اما اگر subdocument match شد، parent آن را هم include کن
    const mainDocIds = new Set<string>()

    matchingTransactions.forEach(t => {
      if (t.parentDocumentId) {
        // این یک subdocument است که match شده، parent آن را اضافه کن
        mainDocIds.add(t.parentDocumentId)
      } else {
        // این یک main document است که match شده
        mainDocIds.add(t.id)
      }
    })

    // فقط main documents را برگردان
    return data.transactions.filter(t => mainDocIds.has(t.id) && !t.parentDocumentId)
  }, [data.transactions, searchTerm, filterType, filterCustomer, filterProductType, data.bankAccounts])

  const toggleExpand = (docId: string) => {
    setExpandedDocs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(docId)) {
        newSet.delete(docId)
      } else {
        newSet.add(docId)
      }
      return newSet
    })
  }

  const getSubdocuments = (parentId: string): Transaction[] => {
    return data.transactions.filter(t => t.parentDocumentId === parentId)
  }

  const handleDelete = (transactionId: string) => {
    if (confirm(t("deleteDocumentConfirm"))) {
      const transactionToDelete = data.transactions.find(t => t.id === transactionId)
      let transactionsToDelete = [transactionId]

      // اگر سند اصلی است، تمام زیرسندهای آن را هم حذف کن
      if (transactionToDelete?.isMainDocument) {
        const subDocs = data.transactions.filter(t => t.parentDocumentId === transactionId)
        subDocs.forEach(sub => transactionsToDelete.push(sub.id))
      }

      // اگر تراکنش مرتبط دارد (روش قدیمی)، آن را هم حذف کن
      if (transactionToDelete?.linkedTransactionId) {
        transactionsToDelete.push(transactionToDelete.linkedTransactionId)
      }

      const updatedTransactions = data.transactions.filter((transaction) =>
        !transactionsToDelete.includes(transaction.id)
      )
      onDataChange({
        ...data,
        transactions: updatedTransactions,
      })
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const formatDate = (dateString: string) => {
    if (!dateString || dateString.trim() === "") {
      return {
        persian: "تاریخ نامعتبر",
        gregorian: "Invalid Date",
      }
    }

    try {
      const dates = formatBothDatesWithTime(dateString)
      return {
        persian: dates.persian,
        gregorian: dates.gregorian,
      }
    } catch (error) {
      return {
        persian: dateString,
        gregorian: dateString,
      }
    }
  }

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case "documentNumber":
          aValue = a.documentNumber || ""
          bValue = b.documentNumber || ""
          break
        case "type":
          aValue = getTransactionTypeInfo(a).label
          bValue = getTransactionTypeInfo(b).label
          break
        case "customer":
          aValue = getCustomerName(a.customerId)
          bValue = getCustomerName(b.customerId)
          break
        case "productType":
          aValue = getProductTypeName(a.productTypeId)
          bValue = getProductTypeName(b.productTypeId)
          break
        case "weight":
          aValue = a.weight || 0
          bValue = b.weight || 0
          break
        case "quantity":
          aValue = a.quantity || 0
          bValue = b.quantity || 0
          break
        case "unitPrice":
          aValue = (a.unitPrice != null) ? a.unitPrice : ((a.weight && a.amount) ? a.amount / a.weight : 0)
          bValue = (b.unitPrice != null) ? b.unitPrice : ((b.weight && b.amount) ? b.amount / b.weight : 0)
          break
        case "amount":
          aValue = a.amount
          bValue = b.amount
          break
        case "date":
          const dateA = a.date || a.createdAt || ""
          const dateB = b.date || b.createdAt || ""
          // Simple string comparison works for ISO dates (YYYY-MM-DDTHH:mm)
          // If not ISO, try timestamp
          if (dateA === dateB) {
            // If dates are equal, sort by creation time (if available) or ID to ensure stable sort
            aValue = a.createdAt || a.id
            bValue = b.createdAt || b.id
          } else {
            aValue = dateA
            bValue = dateB
          }
          break
        case "description":
          aValue = a.description
          bValue = b.description
          break
        default:
          aValue = new Date(a.date || a.createdAt).getTime()
          bValue = new Date(b.date || b.createdAt).getTime()
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue, "fa")
        return sortDirection === "asc" ? comparison : -comparison
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [filteredTransactions, sortField, sortDirection])

  // Pagination logic
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = useMemo(() => {
    return sortedTransactions.slice(startIndex, endIndex)
  }, [sortedTransactions, startIndex, endIndex])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterType, filterCustomer, filterProductType])

  const handlePrintOnLetterhead = () => {
    const rows = sortedTransactions.map((t) => {
      const unitPrice = (t.unitPrice != null)
        ? t.unitPrice
        : (t.weight && t.amount ? t.amount / t.weight : undefined)

      return {
        documentNumber: t.documentNumber ?? "-",
        type: getTransactionTypeInfo(t).label,
        customerName: getCustomerName(t.customerId),
        productTypeName: getProductTypeName(t.productTypeId),
        weight: t.weight ? `${t.weight} ${t.weightUnit || "ton"}` : "-",
        quantity: t.quantity,
        unitPrice: unitPrice ? `${unitPrice} ${data.currencies?.find(c => c.id === t.currencyId)?.symbol || "$"}/${t.weightUnit || "ton"}` : "-",
        amount: `${t.amount} ${data.currencies?.find(c => c.id === t.currencyId)?.symbol || "$"}`,
        datePersian: formatDate(t.date || t.createdAt || "").persian,
        description: t.description ?? "-",
      }
    })

    const company: CompanyInfo = {
      nameFa: "ADROM Company",
      addressFa: "ته لاری شوشه - نهومی 2 - شوقه ره قم 4",
      phones: ["+964 770 155 9099", "+964 770 140 8575"],
      website: "Www.AdromCo.com",
      email: "info@adromco.com",
    }

    const html = buildLetterheadHTML(rows, company)
    const w = window.open("", "_blank", "width=900,height=1000")
    if (!w) return
    w.document.write(html); w.document.close(); w.focus()
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }


  const handlePrintDocuments = () => {
    const rows = sortedTransactions.map((t) => {
      const currencySymbol = data.currencies?.find(c => c.id === t.currencyId)?.symbol || "$";
      const weightUnitLabel = t.weightUnit || "ton";
      const usd = `${formatNumber(t.amount || 0)} ${currencySymbol}`;
      const green = new Set(["cash_out", "product_out", "product_sale"]);
      const red = new Set(["cash_in", "product_in", "product_purchase", "expense"]);
      const usdCls = green.has(t.type) ? "green" : red.has(t.type) ? "red" : "";
      return `<tr>
        <td>${t.documentNumber || "-"}</td>
        <td>${getTransactionTypeInfo(t).label}</td>
        <td>${getCustomerName(t.customerId)}</td>
        <td>${getProductTypeName(t.productTypeId)}</td>
        <td>${t.quantity ? `${formatNumber(t.quantity)}` : "-"}</td>
        <td>${t.weight ? `${formatNumber(t.weight)} ${weightUnitLabel}` : "-"}</td>
        <td>${(t.unitPrice != null) ? `${formatNumber(t.unitPrice)} ${currencySymbol}/${weightUnitLabel}` : ((t.weight && t.amount) ? `${formatNumber((t.amount) / (t.weight))} ${currencySymbol}/${weightUnitLabel}` : "-")}</td>
        <td class="${usdCls}">${usd}</td>
        <td>${formatDate(t.date || t.createdAt || "").persian}</td>
        <td class="desc">${t.description || "-"}</td>
      </tr>`
    }).join("")

    const html = `<!doctype html>
<html dir="rtl" lang="fa">
<head><meta charset="utf-8"/><title>چاپ آخرین اسناد</title>
<style>
  @page { size: A4; margin: 12mm; }
  :root {
    --fg: #0f172a;
    --muted: #64748b;
    --green: #16a34a;
    --red: #dc2626;
    --accent: #2563eb;
    --bg: #ffffff;
    --stripe: #f8fafc;
    --border: #e2e8f0;
  }
  body{font-family: Vazirmatn, IRANSans, Segoe UI, Tahoma, sans-serif; color:var(--fg); background:var(--bg); padding:16px;}
  h1{font-size:18px; margin:0 0 12px; text-align:center; color:var(--accent);}
  table{width:100%;border-collapse:collapse;}
  th,td{border:1px solid var(--border);padding:8px;font-size:12px;text-align:center;}
  th{background:var(--stripe);}
  tr:nth-child(even) td { background: #fcfdff; }
  .green{color:var(--green);font-weight:700;}
  .red{color:var(--red);font-weight:700;}
  .desc{text-align:right;color:var(--muted);}
</style></head><body>
<h1>آخرین اسناد</h1>
<table><thead><tr>
  <th>شماره سند</th><th>نوع</th><th>مشتری</th><th>نوع کالا</th><th>تعداد</th><th>مقدار</th><th>قیمت واحد</th>
  <th>مبلغ</th><th>تاریخ</th><th>توضیحات</th>
</tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
</body></html>`
    const w = window.open("", "_blank", "width=900,height=1000")
    if (!w) return
    w.document.write(html); w.document.close(); w.focus();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchDocuments")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 text-right"
            />
          </div>
        </div>
        <Select value={filterType} onValueChange={(value) => setFilterType(value as TransactionType | "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("documentType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allDocuments")}</SelectItem>
            <SelectItem value="product_in">{t("productIn")}</SelectItem>
            <SelectItem value="product_out">{t("productOut")}</SelectItem>
            <SelectItem value="product_purchase">{t("productPurchase")}</SelectItem>
            <SelectItem value="product_sale">{t("productSale")}</SelectItem>
            <SelectItem value="cash_in">{t("cashIn")}</SelectItem>
            <SelectItem value="cash_out">{t("cashOut")}</SelectItem>
            <SelectItem value="expense">{t("expense")}</SelectItem>
            <SelectItem value="income">{t("income")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("customer")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCustomers")}</SelectItem>
            {data.customers.map((customer) => {
              let displayName = customer.name
              if (customer.id === "default-cash-safe") {
                displayName = lang === "fa" ? "صندوق" : "Cash Box"
              } else if (customer.id === "default-warehouse") {
                displayName = lang === "fa" ? "موجودی" : "Inventory"
              }
              return (
                <SelectItem key={customer.id} value={customer.id}>
                  {displayName}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <Select value={filterProductType} onValueChange={setFilterProductType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("productType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allProductTypes")}</SelectItem>
            {productTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={displayWeightUnit} onValueChange={setDisplayWeightUnit}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("weightUnit")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">{t("originalUnit")}</SelectItem>
            <SelectItem value="ton">{t("weightUnit_ton")}</SelectItem>
            <SelectItem value="kg">{t("weightUnit_kg")}</SelectItem>
            <SelectItem value="lb">{t("weightUnit_lb")}</SelectItem>
            <SelectItem value="g">{t("weightUnit_g")}</SelectItem>
            <SelectItem value="mg">{t("weightUnit_mg")}</SelectItem>
          </SelectContent>
        </Select>
      </div>



      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort("documentNumber")}
                  >
                    {t("documentNumber")}
                    {getSortIcon("documentNumber")}
                  </Button>
                </TableHead>
                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort("type")}
                  >
                    {t("type")}
                    {getSortIcon("type")}
                  </Button>
                </TableHead>
                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort("customer")}
                  >
                    {t("customer")}
                    {getSortIcon("customer")}
                  </Button>
                </TableHead>
                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort("productType")}
                  >
                    {t("productType")}
                    {getSortIcon("productType")}
                  </Button>
                </TableHead>
                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  {t("price")}
                </TableHead>

                {/* Goods Section Header */}
                <TableHead className="text-center text-xs p-1 h-auto border-r border-b bg-blue-50/50" colSpan={4}>
                  <span className="font-bold text-blue-700">{t("goodsSection")}</span>
                </TableHead>

                {/* Money Section Header */}
                <TableHead className="text-center text-xs p-1 h-auto border-r border-b bg-green-50/50" colSpan={4}>
                  <span className="font-bold text-green-700">{t("moneySection")}</span>
                </TableHead>

                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort("date")}
                  >
                    {t("date")}
                    {getSortIcon("date")}
                  </Button>
                </TableHead>
                <TableHead className="text-center text-xs p-1 h-auto border-r" rowSpan={2}>
                  {t("description")}
                </TableHead>
                <TableHead className="text-center text-xs p-1 h-auto sticky right-0 bg-background z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]" rowSpan={2}>
                  {t("operations")}
                </TableHead>
              </TableRow>

              {/* Sub-headers Row */}
              <TableRow className="bg-muted/50">
                {/* Goods Sub-headers */}
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-blue-50/30">{t("colIn")}</TableHead>
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-blue-50/30">{t("colOut")}</TableHead>
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-blue-50/30">{t("colReceivable")}</TableHead>
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-blue-50/30">{t("colPayable")}</TableHead>

                {/* Money Sub-headers */}
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-green-50/30">{t("colIn")}</TableHead>
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-green-50/30">{t("colOut")}</TableHead>
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-green-50/30">{t("colReceivable")}</TableHead>
                <TableHead className="text-center text-[10px] p-1 h-auto border-r bg-green-50/30">{t("colPayable")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.map((transaction) => {
                const typeInfo = getTransactionTypeInfo(transaction)
                const Icon = typeInfo.icon
                const Arrow = typeInfo.arrow
                const subdocuments = getSubdocuments(transaction.id)
                const hasSubdocs = subdocuments.length > 0
                const isExpanded = expandedDocs.has(transaction.id)
                const mainDocTotals = !transaction.parentDocumentId && hasSubdocs ? getSubdocumentTotals(transaction.id) : null

                const renderRow = (trans: Transaction, isSubdoc = false, mainDocTotals: any = null) => (
                  <TableRow key={trans.id} className={isSubdoc ? "bg-muted/30" : ""}>
                    <TableCell className={`text-center font-mono p-2 ${isSubdoc ? "text-[9px]" : "text-[10px]"}`}>
                      <div className="flex items-center justify-center gap-1">
                        {!isSubdoc && hasSubdocs && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => toggleExpand(trans.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        {isSubdoc && <span className="text-muted-foreground mr-4">└</span>}
                        <span>{trans.documentNumber || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center p-2">
                      <Badge className={`${getTransactionTypeInfo(trans).color} ${isSubdoc ? "text-[8px]" : "text-[9px]"} px-1 py-0`}>
                        {getTransactionTypeInfo(trans).label}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-center p-2 max-w-[100px] ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {(() => {
                        const customer = data.customers.find((c) => c.id === trans.customerId)
                        let content: React.ReactNode = t("unknown")
                        let text = t("unknown")

                        if (customer) {
                          if (customer.id === "default-cash-safe") {
                            content = (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 whitespace-nowrap">
                                {lang === "fa" ? "صندوق" : "Cash Box"}
                              </Badge>
                            )
                            text = lang === "fa" ? "صندوق" : "Cash Box"
                          } else if (customer.id === "default-warehouse") {
                            text = lang === "fa" ? "موجودی" : "Inventory"
                            content = (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 whitespace-nowrap">
                                {text}
                              </Badge>
                            )
                          } else {
                            content = customer.name
                            text = customer.name
                          }
                        } else {
                          const bankAccount = data.bankAccounts?.find((b) => b.id === trans.customerId)
                          if (bankAccount) {
                            text = `${bankAccount.bankName} - ${bankAccount.accountHolder}`
                            content = (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 whitespace-nowrap">
                                {text}
                              </Badge>
                            )
                          }
                        }

                        return (
                          <TruncatedTooltip text={text}>
                            {content}
                          </TruncatedTooltip>
                        )
                      })()}
                    </TableCell>
                    <TableCell className={`text-center p-2 max-w-[80px] ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      <TruncatedTooltip text={getProductTypeName(trans.productTypeId)}>
                        {getProductTypeName(trans.productTypeId)}
                      </TruncatedTooltip>
                    </TableCell>
                    {/* Price Column */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {(trans.type === "product_purchase" || trans.type === "product_sale") && trans.unitPrice ? (
                        <>
                          {formatNumber(trans.unitPrice)}
                          <span className="text-[10px] text-gray-500 ml-1">
                            {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                          </span>
                        </>
                      ) : "-"}
                    </TableCell>
                    {/* Goods Receipt (Product In) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedGoods(mainDocTotals.goodsIn, "text-red-600", mainDocTotals.weightUnit)
                      ) : (
                        ((trans.type === "product_in" || trans.type === "income") && (trans.weight || trans.quantity)) ? (
                          <span className="font-medium text-red-600">
                            {trans.quantity ? (
                              <>
                                {formatNumber(Math.abs(trans.quantity))}
                                <span className="text-[10px] text-gray-500 ml-1">(Count)</span>
                              </>
                            ) : ""}
                            {trans.quantity && trans.weight ? " / " : ""}
                            {trans.weight ? (
                              displayWeightUnit === "original" ? (
                                <>
                                  {formatNumber(Math.abs(trans.weight))}
                                  <span className="text-[10px] text-gray-500 ml-1">({trans.weightUnit || "ton"})</span>
                                </>
                              ) : (
                                <>
                                  {formatNumber(Math.abs(convertWeight(trans.weight, trans.weightUnit || "ton", displayWeightUnit)))}
                                  <span className="text-[10px] text-gray-500 ml-1">({t(`weightUnit_${displayWeightUnit}`) || displayWeightUnit})</span>
                                </>
                              )
                            ) : ""}
                          </span>
                        ) : "-"
                      )}
                    </TableCell>

                    {/* Goods Issue (Product Out) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedGoods(mainDocTotals.goodsOut, "text-green-600", mainDocTotals.weightUnit)
                      ) : (
                        ((trans.type === "product_out" || trans.type === "expense") && (trans.weight || trans.quantity)) ? (
                          <span className="font-medium text-green-600">
                            {trans.quantity ? (
                              <>
                                {formatNumber(Math.abs(trans.quantity))}
                                <span className="text-[10px] text-gray-500 ml-1">(Count)</span>
                              </>
                            ) : ""}
                            {trans.quantity && trans.weight ? " / " : ""}
                            {trans.weight ? (
                              displayWeightUnit === "original" ? (
                                <>
                                  {formatNumber(Math.abs(trans.weight))}
                                  <span className="text-[10px] text-gray-500 ml-1">({trans.weightUnit || "ton"})</span>
                                </>
                              ) : (
                                <>
                                  {formatNumber(Math.abs(convertWeight(trans.weight, trans.weightUnit || "ton", displayWeightUnit)))}
                                  <span className="text-[10px] text-gray-500 ml-1">({t(`weightUnit_${displayWeightUnit}`) || displayWeightUnit})</span>
                                </>
                              )
                            ) : ""}
                          </span>
                        ) : "-"
                      )}
                    </TableCell>

                    {/* Goods Credit (Payable) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedGoods(mainDocTotals.goodsCredit, "text-red-600", mainDocTotals.weightUnit)
                      ) : (
                        (() => {
                          if ((trans.type === "product_purchase" || trans.type === "payable") && (trans.quantity || trans.weight)) {
                            const val = trans.quantity || trans.weight || 0;
                            return (
                              <span className="font-medium text-red-600">
                                {formatNumber(Math.abs(val))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  ({trans.weight ? (trans.weightUnit || "ton") : "Count"})
                                </span>
                              </span>
                            )
                          }
                          return "-"
                        })()
                      )}
                    </TableCell>

                    {/* Goods Debit (Receivable) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedGoods(mainDocTotals.goodsDebit, "text-green-600", mainDocTotals.weightUnit)
                      ) : (
                        (() => {
                          if ((trans.type === "product_sale" || trans.type === "receivable") && (trans.quantity || trans.weight)) {
                            const val = trans.quantity || trans.weight || 0;
                            return (
                              <span className="font-medium text-green-600">
                                {formatNumber(Math.abs(val))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  ({trans.weight ? (trans.weightUnit || "ton") : "Count"})
                                </span>
                              </span>
                            )
                          }
                          return "-"
                        })()
                      )}
                    </TableCell>

                    {/* Money Receipt (Cash In) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedMoney(mainDocTotals.moneyIn, "text-red-600")
                      ) : (
                        (() => {
                          // For main documents, use moneyIn if available
                          if (trans.moneyIn !== undefined && trans.moneyIn > 0) {
                            return (
                              <span className="font-bold text-red-600">
                                {formatNumber(Math.abs(trans.moneyIn))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                                </span>
                              </span>
                            )
                          }
                          // For regular transactions, check type
                          if (trans.type === "cash_in" || trans.type === "income") {
                            return (
                              <span className="font-bold text-red-600">
                                {formatNumber(Math.abs(trans.amount))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                                </span>
                              </span>
                            )
                          }
                          return "-"
                        })()
                      )}
                    </TableCell>

                    {/* Money Payment (Cash Out) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedMoney(mainDocTotals.moneyOut, "text-green-600")
                      ) : (
                        (() => {
                          // For main documents, use moneyOut if available
                          if (trans.moneyOut !== undefined && trans.moneyOut > 0) {
                            return (
                              <span className="font-bold text-green-600">
                                {formatNumber(Math.abs(trans.moneyOut))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                                </span>
                              </span>
                            )
                          }
                          // For regular transactions, check type
                          if (trans.type === "cash_out" || trans.type === "expense") {
                            return (
                              <span className="font-bold text-green-600">
                                {formatNumber(Math.abs(trans.amount))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                                </span>
                              </span>
                            )
                          }
                          return "-"
                        })()
                      )}
                    </TableCell>

                    {/* Money Credit (Payable) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedMoney(mainDocTotals.moneyCredit, "text-red-600")
                      ) : (
                        (() => {
                          // Product Purchase -> Red
                          // Payable -> Red
                          if ((trans.type === "product_purchase" || trans.type === "payable") && trans.amount) {
                            return (
                              <span className="font-bold text-red-600">
                                {formatNumber(Math.abs(trans.amount))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                                </span>
                              </span>
                            )
                          }
                          return "-"
                        })()
                      )}
                    </TableCell>

                    {/* Money Debit (Receivable) */}
                    <TableCell className={`text-center p-2 whitespace-nowrap ${isSubdoc ? "text-[10px]" : "text-xs"}`}>
                      {!isSubdoc && mainDocTotals ? (
                        renderAggregatedMoney(mainDocTotals.moneyDebit, "text-green-600")
                      ) : (
                        (() => {
                          // Product Sale -> Green
                          // Receivable -> Green
                          if ((trans.type === "product_sale" || trans.type === "receivable") && trans.amount) {
                            return (
                              <span className="font-bold text-green-600">
                                {formatNumber(Math.abs(trans.amount))}
                                <span className="text-[10px] text-gray-500 ml-1">
                                  {data.currencies?.find(c => c.id === trans.currencyId)?.symbol || "$"}
                                </span>
                              </span>
                            )
                          }
                          return "-"
                        })()
                      )}
                    </TableCell>
                    <TableCell className={`text-center p-2 ${isSubdoc ? "text-[9px]" : "text-[10px]"}`}>
                      {lang === "fa" ? (
                        <div>
                          <div className="font-medium">
                            {formatDate(trans.date || trans.createdAt || "").persian}
                          </div>
                          <div className="text-muted-foreground text-[9px]">
                            {formatDate(trans.date || trans.createdAt || "").gregorian}
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium">
                          {formatDate(trans.date || trans.createdAt || "").gregorian}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`text-center p-2 max-w-[120px] truncate ${isSubdoc ? "text-[10px]" : "text-xs"}`} title={trans.description}>
                      {trans.description}
                    </TableCell>
                    <TableCell className="text-center p-2 sticky right-0 bg-background z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                      <div className="flex gap-0.5 justify-center">
                        {onEdit && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(trans)}>
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDelete(trans.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )

                return (
                  <React.Fragment key={transaction.id}>
                    {renderRow(transaction, false, mainDocTotals)}
                    {isExpanded && subdocuments.map(subdoc => renderRow(subdoc, true))}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {
          sortedTransactions.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchTerm || filterType !== "all" || filterCustomer !== "all"
                  ? t("documentNotFound")
                  : t("noDocumentsRegistered")}
              </p>
            </div>
          )
        }

        {/* Pagination Controls */}
        {
          sortedTransactions.length > 0 && (
            <div className="flex items-center justify-between mt-6 p-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("itemsPerPage")}</span>
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
                  {t("showing")} {startIndex + 1} {t("to")} {Math.min(endIndex, sortedTransactions.length)} {t("of")} {sortedTransactions.length} {t("documentsCount")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  {t("first")}
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
                  {t("page")} {currentPage} {t("of")} {totalPages}
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
                  {t("last")}
                </Button>
              </div>
            </div>
          )
        }
      </Card >

      {/* Warning for large datasets */}
      {
        sortedTransactions.length > 500 && (
          <Card className="mt-4">
            <div className="p-4 text-center text-sm text-orange-600">
              ⚠️ {t("largeDatasetWarning")} ({sortedTransactions.length} {t("documentsCount")}).
            </div>
          </Card>
        )
      }

      <div className="flex justify-center gap-4 mt-4 print:hidden">
        <Button variant="secondary" onClick={handlePrintDocuments}>{t("printLastDocuments")}</Button>
        <Button variant="secondary" onClick={handlePrintOnLetterhead}>
          {t("printOnLetterhead")}
        </Button>
      </div>
    </div >
  )
}
