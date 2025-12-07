"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { AppData, ProductType } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import { formatNumber } from "@/lib/number-utils"

interface CustomerReportProps {
  data: AppData
}

export function CustomerReport({ data }: CustomerReportProps) {
  const [selectedCustomer, setSelectedCustomer] = useState("all")
  const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])

  const getCustomerTransactions = (customerId: string) => {
    return data.transactions.filter((transaction) => customerId === "all" || transaction.customerId === customerId)
  }

  const customerTransactions = getCustomerTransactions(selectedCustomer)

  const totals = useMemo(() => {
    let cashIn = 0
    let cashOut = 0
    let totalProductIn = 0
    let totalProductOut = 0
    let totalProductPurchase = 0
    let totalProductSale = 0
    let totalAmount = 0

    // New total accumulators
    let goodsIn = 0
    let goodsOut = 0
    let moneyReceivable = 0
    let moneyPayable = 0

    customerTransactions.forEach((t) => {
      totalAmount += t.amount || 0

      // Standard totals (existing logic)
      switch (t.type) {
        case "cash_in":
          cashIn += t.amount || 0
          break
        case "cash_out":
          cashOut += t.amount || 0
          break
        case "product_in":
          totalProductIn += t.weight || 0
          break
        case "product_out":
          totalProductOut += t.weight || 0
          break
        case "product_purchase":
          totalProductPurchase += t.weight || 0
          break
        case "product_sale":
          totalProductSale += t.weight || 0
          break
      }

      // New requested totals (excluding expense and income)
      if (t.type !== "expense" && t.type !== "income") {
        switch (t.type) {
          case "product_in":
          case "product_purchase":
            goodsIn += t.weight || 0
            break
          case "product_out":
          case "product_sale":
            goodsOut += t.weight || 0
            break
          case "cash_in":
          case "receivable":
            moneyReceivable += t.amount || 0
            break
          case "cash_out":
          case "payable":
            moneyPayable += t.amount || 0
            break
        }
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
      netProduct: totalProductIn + totalProductSale - totalProductOut - totalProductPurchase,
      totalTransactions: customerTransactions.length,
      totalAmount,
      // New totals
      goodsIn,
      goodsOut,
      moneyReceivable,
      moneyPayable
    }
  }, [customerTransactions])

  // New calculation based on specific user formulas
  const userTotals = useMemo(() => {
    let goods_in = 0
    let goods_payable = 0
    let goods_out = 0
    let goods_receivable = 0

    let money_in = 0
    let money_payable = 0
    let money_out = 0
    let money_receivable = 0

    customerTransactions.forEach(t => {
      if (t.type === 'expense' || t.type === 'income') return;

      // Goods Mapping
      if (t.type === 'product_in') goods_in += t.weight || 0;
      if (t.type === 'product_purchase') goods_receivable += t.weight || 0;

      if (t.type === 'product_out') goods_out += t.weight || 0;
      if (t.type === 'product_sale') goods_payable += t.weight || 0;

      // Money Mapping
      if (t.type === 'cash_in') money_in += t.amount || 0;

      // Money Payable includes straightforward 'payable' AND the money owed from purchase
      if (t.type === 'payable' || t.type === 'product_purchase') money_payable += t.amount || 0;

      if (t.type === 'cash_out') money_out += t.amount || 0;

      // Money Receivable includes straightforward 'receivable' AND money to be received from sale
      if (t.type === 'receivable' || t.type === 'product_sale') money_receivable += t.amount || 0;
    });

    // Formula: (Goods In + Goods Payable) - (Goods Out + Goods Receivable)
    const netGoods = (goods_in + goods_payable) - (goods_out + goods_receivable);

    // Formula: (Money In + Money Payable) - (Money Out + Money Receivable)
    const netMoney = (money_in + money_payable) - (money_out + money_receivable);

    return {
      netGoods, netMoney,
      components: { goods_in, goods_payable, goods_out, goods_receivable, money_in, money_payable, money_out, money_receivable }
    };
  }, [customerTransactions])

  const getCustomerName = (customerId: string) => {
    const customer = data.customers.find((c) => c.id === customerId)
    if (customer) {
      // ترجمه حساب‌های پیش‌فرض
      if (customer.id === "default-cash-safe") {
        return "صندوق من"
      }
      if (customer.id === "default-warehouse") {
        return "انبار"
      }
      return customer.name
    }

    const bankAccount = data.bankAccounts?.find((b) => b.id === customerId)
    if (bankAccount) return `${bankAccount.bankName} - ${bankAccount.accountHolder}`

    return "نامشخص"
  }

  const getProductTypeName = (productTypeId?: string) => {
    if (!productTypeId) return "-"
    const found = productTypes.find((f) => f.id === productTypeId)
    return found?.name || "نامشخص"
  }

  // formatNumber imported from @/lib/number-utils

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
      case "receivable":
        return "طلب"
      case "payable":
        return "بدهی"
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
      case "receivable":
        return "bg-emerald-100 text-emerald-800"
      case "payable":
        return "bg-rose-100 text-rose-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const transactions = customerTransactions.sort(
    (a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime(),
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <h3 className="font-semibold mb-2 text-blue-800">Net Goods (خالص کالا)</h3>
          <div className="flex justify-between items-end">
            <div className="text-sm text-blue-600 space-y-1">
              <div dir="ltr">In + Payable: {formatNumber(userTotals.components.goods_in + userTotals.components.goods_payable)}</div>
              <div dir="ltr">Out + Receivable: {formatNumber(userTotals.components.goods_out + userTotals.components.goods_receivable)}</div>
            </div>
            <p className={`text-2xl font-bold ${userTotals.netGoods >= 0 ? "text-blue-700" : "text-red-700"}`}>
              {formatNumber(userTotals.netGoods)} تن
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <h3 className="font-semibold mb-2 text-emerald-800">Net Money (خالص حساب)</h3>
          <div className="flex justify-between items-end">
            <div className="text-sm text-emerald-600 space-y-1">
              <div dir="ltr">In + Payable: {formatNumber(userTotals.components.money_in + userTotals.components.money_payable)}</div>
              <div dir="ltr">Out + Receivable: {formatNumber(userTotals.components.money_out + userTotals.components.money_receivable)}</div>
            </div>
            <p className={`text-2xl font-bold ${userTotals.netMoney >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatNumber(userTotals.netMoney)} دلار
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">تعداد تراکنش‌ها</h3>
          <p className="text-2xl font-bold text-primary">{totals.totalTransactions}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">خالص نقدی</h3>
          <p className={`text-2xl font-bold ${totals.netCash >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatNumber(totals.netCash)} دلار
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">خالص محصول</h3>
          <p className={`text-2xl font-bold ${totals.netProduct >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatNumber(totals.netProduct)} تن
          </p>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">ورود محصول</div>
            <div className="text-2xl font-bold text-blue-600">{totals.totalProductIn.toLocaleString()} تن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">خروج محصول</div>
            <div className="text-2xl font-bold text-orange-600">{totals.totalProductOut.toLocaleString()} تن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">خرید محصول</div>
            <div className="text-2xl font-bold text-green-600">{totals.totalProductPurchase.toLocaleString()} تن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-muted-foreground">فروش محصول</div>
            <div className="text-2xl font-bold text-purple-600">{totals.totalProductSale.toLocaleString()} تن</div>
          </CardContent>
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
              <TableHead>نوع محصول</TableHead>
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
                <TableCell className="text-center">{transaction.productTypeId ? getProductTypeName(transaction.productTypeId) : "-"}</TableCell>
                <TableCell>{transaction.weight ? `${formatNumber(transaction.weight)} تن` : "-"}</TableCell>
                <TableCell>{formatNumber(transaction.amount || 0)} دلار</TableCell>
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
    </div >
  )
}
