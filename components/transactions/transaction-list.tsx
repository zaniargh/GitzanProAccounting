"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Package, DollarSign, Search, Trash2, ArrowUp, ArrowDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import type { AppData, TransactionType, FlourType } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import { formatBothDatesWithTime } from "@/lib/date-utils"
import { buildLetterheadHTML, type CompanyInfo } from "@/components/print/build-letterhead-html"
import { useLang } from "@/components/language-provider"


const getAmountClass = (type: string) => {
  // نوع‌هایی که باید سبز باشند
  const green = new Set([
    "cash_out",      // خروج وجه (دلار)
    "flour_out",     // خروج آرد
    "flour_sale" // فروش آرد
  ])

  // نوع‌هایی که باید قرمز باشند
  const red = new Set([
    "cash_in",    // ورود وجه (دلار)
    "flour_in",   // ورود آرد
    "flour_purchase", // خرید آرد
    "expense"     // هزینه
  ])

  if (green.has(type)) return "text-green-600"
  if (red.has(type)) return "text-red-600"
  return "" // پیش‌فرض
}

interface TransactionListProps {
  data: AppData
  onDataChange: (data: AppData) => void
  onEdit?: (transaction: any) => void
}

type SortField = "documentNumber" | "type" | "customer" | "flourType" | "weight" | "quantity" | "unitPrice" | "amount" | "date" | "description"
type SortDirection = "asc" | "desc"

export function TransactionList({ data, onDataChange, onEdit }: TransactionListProps) {
  const [flourTypes] = useLocalStorageGeneric<FlourType[]>("flourTypes", [])
  const { t } = useLang()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<TransactionType | "all">("all")
  const [filterCustomer, setFilterCustomer] = useState("all")

  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const getCustomerName = (customerId: string) => {
    return data.customers.find((customer) => customer.id === customerId)?.name || t("unknown")
  }

  const getFlourTypeName = (flourTypeId?: string) => {
    if (!flourTypeId) return "-"
    return flourTypes.find((flourType) => flourType.id === flourTypeId)?.name || t("unknown")
  }

  const getTransactionTypeInfo = (type: TransactionType) => {
    switch (type) {
      case "flour_in":
        return { label: t("flourIn"), icon: Package, color: "bg-green-100 text-green-800", arrow: ArrowDown }
      case "flour_out":
        return { label: t("flourOut"), icon: Package, color: "bg-red-100 text-red-800", arrow: ArrowUp }
      case "flour_purchase":
        return { label: t("flourPurchase"), icon: Package, color: "bg-blue-100 text-blue-800", arrow: ArrowDown }
      case "flour_sale":
        return { label: t("flourSale"), icon: Package, color: "bg-purple-100 text-purple-800", arrow: ArrowUp }
      case "cash_in":
        return { label: t("cashIn"), icon: DollarSign, color: "bg-green-100 text-green-800", arrow: ArrowDown }
      case "cash_out":
        return { label: t("cashOut"), icon: DollarSign, color: "bg-red-100 text-red-800", arrow: ArrowUp }
      case "expense":
        return { label: t("expense"), icon: DollarSign, color: "bg-orange-100 text-orange-800", arrow: ArrowUp }
      default:
        return { label: t("unknown"), icon: DollarSign, color: "bg-gray-100 text-gray-800", arrow: ArrowUp }
    }
  }

  const filteredTransactions = useMemo(() => {
    return data.transactions.filter((transaction) => {
      const matchesSearch =
        getCustomerName(transaction.customerId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = filterType === "all" || transaction.type === filterType
      const matchesCustomer = filterCustomer === "all" || transaction.customerId === filterCustomer
      return matchesSearch && matchesType && matchesCustomer
    })
  }, [data.transactions, searchTerm, filterType, filterCustomer])

  const handleDelete = (transactionId: string) => {
    if (confirm(t("deleteDocumentConfirm"))) {
      const updatedTransactions = data.transactions.filter((transaction) => transaction.id !== transactionId)
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
          aValue = getTransactionTypeInfo(a.type).label
          bValue = getTransactionTypeInfo(b.type).label
          break
        case "customer":
          aValue = getCustomerName(a.customerId)
          bValue = getCustomerName(b.customerId)
          break
        case "flourType":
          aValue = getFlourTypeName(a.flourTypeId)
          bValue = getFlourTypeName(b.flourTypeId)
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
          aValue = new Date(a.createdAt || a.date).getTime()
          bValue = new Date(b.createdAt || b.date).getTime()
          break
        case "description":
          aValue = a.description
          bValue = b.description
          break
        default:
          aValue = new Date(a.createdAt || b.date).getTime()
          bValue = new Date(b.createdAt || b.date).getTime()
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
  }, [searchTerm, filterType, filterCustomer])

  // Debug logging
  useEffect(() => {
    console.log("[TransactionList] Total transactions:", data.transactions.length)
    console.log("[TransactionList] Filtered transactions:", filteredTransactions.length)
    console.log("[TransactionList] Sorted transactions:", sortedTransactions.length)
    console.log("[TransactionList] Paginated transactions:", paginatedTransactions.length)
    console.log("[TransactionList] Current page:", currentPage, "Items per page:", itemsPerPage)
  }, [data.transactions.length, filteredTransactions.length, sortedTransactions.length, paginatedTransactions.length, currentPage, itemsPerPage])

  const handlePrintOnLetterhead = () => {
    const rows = sortedTransactions.map((t) => {
      const isUSD = true
      const unitPrice = (t.unitPrice != null)
        ? t.unitPrice
        : (t.weight && t.amount ? t.amount / t.weight : undefined)

      return {
        documentNumber: t.documentNumber ?? "-",
        type: getTransactionTypeInfo(t.type).label,
        customerName: getCustomerName(t.customerId),
        flourTypeName: getFlourTypeName(t.flourTypeId),
        weight: t.weight ? `${t.weight} ${t.weightUnit || "ton"}` : "-",
        quantity: t.quantity,
        unitPrice: unitPrice ? `${unitPrice} ${data.currencies?.find(c => c.id === t.currencyId)?.symbol || "$"}/${t.weightUnit || "ton"}` : "-",
        amount: `${t.amount} ${data.currencies?.find(c => c.id === t.currencyId)?.symbol || "$"}`,
        toman: undefined,
        datePersian: formatDate(t.createdAt || t.date || "").persian,
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
      const green = new Set(["cash_out", "flour_out", "flour_sale"]);
      const red = new Set(["cash_in", "flour_in", "flour_purchase", "expense"]);
      const usdCls = green.has(t.type) ? "green" : red.has(t.type) ? "red" : "";
      return `<tr>
        <td>${t.documentNumber || "-"}</td>
        <td>${getTransactionTypeInfo(t.type).label}</td>
        <td>${getCustomerName(t.customerId)}</td>
        <td>${getFlourTypeName(t.flourTypeId)}</td>
        <td>${t.quantity ? `${formatNumber(t.quantity)}` : "-"}</td>
        <td>${t.weight ? `${formatNumber(t.weight)} ${weightUnitLabel}` : "-"}</td>
        <td>${(t.unitPrice != null) ? `${formatNumber(t.unitPrice)} ${currencySymbol}/${weightUnitLabel}` : ((t.weight && t.amount) ? `${formatNumber((t.amount) / (t.weight))} ${currencySymbol}/${weightUnitLabel}` : "-")}</td>
        <td class="${usdCls}">${usd}</td>
        <td>${formatDate(t.createdAt || t.date || "").persian}</td>
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
            <SelectItem value="flour_in">{t("flourIn")}</SelectItem>
            <SelectItem value="flour_out">{t("flourOut")}</SelectItem>
            <SelectItem value="flour_purchase">{t("flourPurchase")}</SelectItem>
            <SelectItem value="flour_sale">{t("flourSale")}</SelectItem>
            <SelectItem value="cash_in">{t("cashIn")}</SelectItem>
            <SelectItem value="cash_out">{t("cashOut")}</SelectItem>
            <SelectItem value="expense">{t("expense")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("customer")} />
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

      <Card>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("documentNumber")}
                >
                  {t("documentNumber")}
                  {getSortIcon("documentNumber")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("type")}
                >
                  {t("type")}
                  {getSortIcon("type")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("customer")}
                >
                  {t("customer")}
                  {getSortIcon("customer")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("flourType")}
                >
                  {t("flourType")}
                  {getSortIcon("flourType")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("quantity")}
                >
                  {t("quantity")}
                  {getSortIcon("quantity")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("weight")}
                >
                  {t("weight")}
                  {getSortIcon("weight")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("unitPrice")}
                >
                  {t("unitPrice")}
                  {getSortIcon("unitPrice")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("amount")}
                >
                  {t("amount")}
                  {getSortIcon("amount")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">{t("toman")}</TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("date")}
                >
                  {t("date")}
                  {getSortIcon("date")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                  onClick={() => handleSort("description")}
                >
                  {t("description")}
                  {getSortIcon("description")}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs p-2 w-[80px]">{t("operations")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.map((transaction) => {
              const typeInfo = getTransactionTypeInfo(transaction.type)
              const Icon = typeInfo.icon
              const Arrow = typeInfo.arrow


              return (
                <TableRow key={transaction.id}>
                  <TableCell className="text-center font-mono text-[10px] p-2">{transaction.documentNumber || "-"}</TableCell>
                  <TableCell className="text-center p-2">
                    <Badge className={`${typeInfo.color} text-[9px] px-1 py-0`}>
                      {typeInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs p-2 max-w-[100px] truncate">{getCustomerName(transaction.customerId)}</TableCell>
                  <TableCell className="text-center text-xs p-2 max-w-[80px] truncate">{getFlourTypeName(transaction.flourTypeId)}</TableCell>
                  <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                    {transaction.quantity ? `${formatNumber(transaction.quantity)}` : "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                    {transaction.weight ? `${formatNumber(transaction.weight)} ${transaction.weightUnit || "ton"}` : "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                    {(transaction.unitPrice != null) ? `${formatNumber(transaction.unitPrice)}`
                      : ((transaction.weight && transaction.amount) ? `${formatNumber(transaction.amount / transaction.weight)}` : "-")}
                  </TableCell>
                  <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                    {transaction.type === "toman_in" || transaction.type === "toman_out"
                      ? "-"
                      : (<span className={`font-bold ${getAmountClass(transaction.type)}`}>
                        {formatNumber(transaction.amount)} {data.currencies?.find(c => c.id === transaction.currencyId)?.symbol || "$"}
                      </span>)}
                  </TableCell>
                  <TableCell className="text-center text-xs p-2 whitespace-nowrap">
                    {transaction.type === "toman_in" || transaction.type === "toman_out"
                      ? (<span className={`font-bold ${getAmountClass(transaction.type)}`}>{formatNumber(transaction.amount)}</span>)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center text-[10px] p-2">
                    <div>
                      <div className="font-medium">
                        {formatDate(transaction.createdAt || transaction.date || "").persian}
                      </div>
                      <div className="text-muted-foreground text-[9px]">
                        {formatDate(transaction.createdAt || transaction.date || "").gregorian}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs p-2 max-w-[120px] truncate">{transaction.description}</TableCell>
                  <TableCell className="text-center p-2">
                    <div className="flex gap-0.5 justify-center">
                      {onEdit && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(transaction)}>
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
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDelete(transaction.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {sortedTransactions.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchTerm || filterType !== "all" || filterCustomer !== "all"
                ? t("documentNotFound")
                : t("noDocumentsRegistered")}
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {sortedTransactions.length > 0 && (
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
        )}
      </Card>

      {/* Warning for large datasets */}
      {sortedTransactions.length > 500 && (
        <Card className="mt-4">
          <div className="p-4 text-center text-sm text-orange-600">
            ⚠️ {t("largeDatasetWarning")} ({sortedTransactions.length} {t("documentsCount")}).
          </div>
        </Card>
      )}

      <div className="flex justify-center gap-4 mt-4 print:hidden">
        <Button variant="secondary" onClick={handlePrintDocuments}>{t("printLastDocuments")}</Button>
        <Button variant="secondary" onClick={handlePrintOnLetterhead}>
          {t("printOnLetterhead")}
        </Button>
      </div>
    </div>
  )
}
