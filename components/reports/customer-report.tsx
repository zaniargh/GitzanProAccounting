"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { AppData } from "@/types"

interface CustomerReportProps {
  data: AppData
}

export function CustomerReport({ data }: CustomerReportProps) {
  const [selectedCustomer, setSelectedCustomer] = useState("all")

  const getCustomerTransactions = (customerId: string) => {
    return data.transactions.filter((transaction) => customerId === "all" || transaction.customerId === customerId)
  }

  const calculateCustomerSummary = (customerId: string) => {
    const transactions = getCustomerTransactions(customerId)

    let cashIn = 0
    let cashOut = 0
    let flourIn = 0
    let flourOut = 0
    let flourInAmount = 0
    let flourOutAmount = 0

    transactions.forEach((transaction) => {
      switch (transaction.type) {
        case "cash_in":
          cashIn += transaction.amount
          break
        case "cash_out":
          cashOut += transaction.amount
          break
        case "flour_in":
          flourIn += transaction.quantity || 0
          flourInAmount += transaction.amount
          break
        case "flour_out":
          flourOut += transaction.quantity || 0
          flourOutAmount += transaction.amount
          break
      }
    })

    return {
      cashIn,
      cashOut,
      flourIn,
      flourOut,
      flourInAmount,
      flourOutAmount,
      netCash: cashIn - cashOut,
      netFlour: flourIn - flourOut,
      totalTransactions: transactions.length,
    }
  }

  const getCustomerName = (customerId: string) => {
    return data.customers.find((customer) => customer.id === customerId)?.name || "نامشخص"
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fa-IR")
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "flour_in":
        return "ورود آرد"
      case "flour_out":
        return "خروج آرد"
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
      case "flour_in":
        return "bg-green-100 text-green-800"
      case "flour_out":
        return "bg-red-100 text-red-800"
      case "cash_in":
        return "bg-blue-100 text-blue-800"
      case "cash_out":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const summary = calculateCustomerSummary(selectedCustomer)
  const transactions = getCustomerTransactions(selectedCustomer).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">گزارش مشتریان</h2>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="انتخاب مشتری" />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">تعداد تراکنش‌ها</h3>
          <p className="text-2xl font-bold text-primary">{summary.totalTransactions}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">خالص نقدی</h3>
          <p className={`text-2xl font-bold ${summary.netCash >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatNumber(summary.netCash)} دلار
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">خالص آرد</h3>
          <p className={`text-2xl font-bold ${summary.netFlour >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatNumber(summary.netFlour)} تن
          </p>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold">تراکنش‌های اخیر</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>تاریخ</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>مقدار</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>توضیحات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.slice(0, 10).map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatDate(transaction.date)}</TableCell>
                <TableCell>
                  <Badge className={getTransactionTypeColor(transaction.type)}>
                    {getTransactionTypeLabel(transaction.type)}
                  </Badge>
                </TableCell>
                <TableCell>{getCustomerName(transaction.customerId)}</TableCell>
                <TableCell>{transaction.quantity ? `${formatNumber(transaction.quantity)} تن` : "-"}</TableCell>
                <TableCell>{formatNumber(transaction.amount)} دلار</TableCell>
                <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {transactions.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">تراکنشی یافت نشد</p>
          </div>
        )}
      </Card>
    </div>
  )
}
