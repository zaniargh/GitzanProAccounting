"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar, Download } from "lucide-react"
import type { AppData, ProductType } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"

interface DateRangeReportProps {
  data: AppData
}

export function DateRangeReport({ data }: DateRangeReportProps) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [filteredTransactions, setFilteredTransactions] = useState(data.transactions)
  const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])

  const handleFilter = () => {
    if (!startDate || !endDate) {
      setFilteredTransactions(data.transactions)
      return
    }

    const filtered = data.transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date)
      const start = new Date(startDate)
      const end = new Date(endDate)
      return transactionDate >= start && transactionDate <= end
    })

    setFilteredTransactions(filtered)
  }

  const summary = useMemo(() => {
    let cashIn = 0
    let cashOut = 0
    let totalProductIn = 0
    let totalProductOut = 0
    let totalProductPurchase = 0
    let totalProductSale = 0

    filteredTransactions.forEach((transaction) => {
      switch (transaction.type) {
        case "cash_in":
          cashIn += transaction.amount || 0
          break
        case "cash_out":
          cashOut += transaction.amount || 0
          break
        case "product_in":
          totalProductIn += transaction.weight || 0
          break
        case "product_out":
          totalProductOut += transaction.weight || 0
          break
        case "product_purchase":
          totalProductPurchase += transaction.weight || 0
          cashOut += transaction.amount || 0
          break
        case "product_sale":
          totalProductSale += transaction.weight || 0
          cashIn += transaction.amount || 0
          break
      }
    })

    return {
      cashIn,
      cashOut,
      totalProductIn,
      totalProductOut,
      totalProductPurchase,
      totalProductSale,
      netCash: cashIn - cashOut,
      totalRevenue: cashIn, // Simplified revenue calculation
      totalExpenses: cashOut, // Simplified expense calculation
      netProfit: cashIn - cashOut,
    }
  }, [filteredTransactions])

  const exportReport = () => {
    const reportData = {
      period: startDate && endDate ? `${startDate} تا ${endDate}` : "همه دوره‌ها",
      summary,
      transactions: filteredTransactions,
      generatedAt: new Date().toISOString(),
    }

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `product-accounting-report-${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getCustomerName = (customerId: string) => {
    return data.customers.find((customer) => customer.id === customerId)?.name || "نامشخص"
  }

  const getProductTypeName = (productTypeId?: string) => {
    if (!productTypeId) return "-"
    const found = productTypes.find((f) => f.id === productTypeId)
    return found?.name || "نامشخص"
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fa-IR")
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "product_in":
        return "ورود محصول"
      case "product_out":
        return "خروج محصول"
      case "product_purchase":
        return "خرید محصول"
      case "product_sale":
        return "فروش محصول"
      case "cash_in":
        return "ورود وجه"
      case "cash_out":
        return "خروج وجه"
      default:
        return type
    }
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "product_in":
        return "bg-green-100 text-green-800"
      case "product_out":
        return "bg-red-100 text-red-800"
      case "product_purchase":
        return "bg-purple-100 text-purple-800"
      case "product_sale":
        return "bg-yellow-100 text-yellow-800"
      case "cash_in":
        return "bg-blue-100 text-blue-800"
      case "cash_out":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">گزارش بازه زمانی</h2>
        <Button onClick={exportReport} variant="outline">
          <Download className="h-4 w-4 ml-2" />
          خروجی گزارش
        </Button>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label htmlFor="startDate">از تاریخ</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="endDate">تا تاریخ</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={handleFilter}>
            <Calendar className="h-4 w-4 ml-2" />
            اعمال فیلتر
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">کل درآمد</h3>
          <p className="text-xl font-bold text-green-600">{formatNumber(summary.totalRevenue)} دلار</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">کل هزینه</h3>
          <p className="text-xl font-bold text-red-600">{formatNumber(summary.totalExpenses)} دلار</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">سود خالص</h3>
          <p className={`text-xl font-bold ${summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatNumber(summary.netProfit)} دلار
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">تعداد تراکنش</h3>
          <p className="text-xl font-bold text-primary">{filteredTransactions.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">ورود محصول</div>
            <div className="text-2xl font-bold text-blue-600">{summary.totalProductIn.toLocaleString()} تن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">خروج محصول</div>
            <div className="text-2xl font-bold text-orange-600">{summary.totalProductOut.toLocaleString()} تن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">خرید محصول</div>
            <div className="text-2xl font-bold text-green-600">{summary.totalProductPurchase.toLocaleString()} تن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">فروش محصول</div>
            <div className="text-2xl font-bold text-purple-600">{summary.totalProductSale.toLocaleString()} تن</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold">
            تراکنش‌های دوره{" "}
            {startDate && endDate ? `(${formatDate(startDate)} تا ${formatDate(endDate)})` : "(همه دوره‌ها)"}
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>تاریخ</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>نوع محصول</TableHead>
              <TableHead>مقدار</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>توضیحات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatDate(transaction.date)}</TableCell>
                <TableCell>
                  <Badge className={getTransactionTypeColor(transaction.type)}>
                    {getTransactionTypeLabel(transaction.type)}
                  </Badge>
                </TableCell>
                <TableCell>{getCustomerName(transaction.customerId)}</TableCell>
                <TableCell className="text-center">{transaction.productTypeId ? getProductTypeName(transaction.productTypeId) : "-"}</TableCell>
                <TableCell>{transaction.weight ? `${formatNumber(transaction.weight)} تن` : "-"}</TableCell>
                <TableCell>{formatNumber(transaction.amount || 0)} دلار</TableCell>
                <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredTransactions.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">تراکنشی یافت نشد</p>
          </div>
        )}
      </Card>
    </div>
  )
}
