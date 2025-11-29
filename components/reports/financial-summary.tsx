"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react"
import type { AppData } from "@/types"

interface FinancialSummaryProps {
  data: AppData
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  const calculateSummary = () => {
    let cashIn = 0
    let cashOut = 0
    let totalProductIn = 0
    let totalProductOut = 0
    let totalProductPurchase = 0
    let totalProductSale = 0
    let productInAmount = 0
    let productOutAmount = 0

    data.transactions.forEach((transaction) => {
      switch (transaction.type) {
        case "cash_in":
          cashIn += transaction.amount || 0
          break
        case "cash_out":
          cashOut += transaction.amount || 0
          break
        case "product_in":
          totalProductIn += transaction.weight || 0
          productInAmount += transaction.amount || 0
          break
        case "product_out":
          totalProductOut += transaction.weight || 0
          productOutAmount += transaction.amount || 0
          break
        case "product_purchase":
          totalProductIn += transaction.weight || 0
          totalProductPurchase += transaction.weight || 0
          cashOut += transaction.amount || 0
          break
        case "product_sale":
          totalProductOut += transaction.weight || 0
          totalProductSale += transaction.weight || 0
          cashIn += transaction.amount || 0
          break
      }
    })

    const netCash = cashIn - cashOut
    const netProduct = totalProductIn - totalProductOut
    const totalRevenue = cashIn + productOutAmount
    const totalExpenses = cashOut + productInAmount
    const netProfit = totalRevenue - totalExpenses

    return {
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      netCash,
      totalProductIn,
      totalProductOut,
      netProduct,
      totalRevenue,
      totalExpenses,
      netProfit,
    }
  }

  const summary = calculateSummary()

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num)
  }

  const summaryCards = [
    {
      title: "کل درآمد",
      value: summary.totalRevenue,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "کل هزینه",
      value: summary.totalExpenses,
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "سود خالص",
      value: summary.netProfit,
      icon: DollarSign,
      color: summary.netProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: summary.netProfit >= 0 ? "bg-green-50" : "bg-red-50",
    },
    {
      title: "موجودی محصول",
      value: summary.netProduct,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      unit: "تن",
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">خلاصه مالی</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={`p-6 ${card.bgColor}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {formatNumber(card.value)} {card.unit || "دلار"}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">جریان نقدی</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>ورود وجه نقد:</span>
              <Badge className="bg-green-100 text-green-800">{formatNumber(summary.totalCashIn)} دلار</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>خروج وجه نقد:</span>
              <Badge className="bg-red-100 text-red-800">{formatNumber(summary.totalCashOut)} دلار</Badge>
            </div>
            <hr />
            <div className="flex justify-between items-center font-semibold">
              <span>خالص نقدی:</span>
              <Badge className={summary.netCash >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {formatNumber(summary.netCash)} دلار
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">موجودی محصول</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>ورود محصول:</span>
              <Badge className="bg-blue-100 text-blue-800">{formatNumber(summary.totalProductIn)} تن</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>خروج محصول:</span>
              <Badge className="bg-orange-100 text-orange-800">{formatNumber(summary.totalProductOut)} تن</Badge>
            </div>
            <hr />
            <div className="flex justify-between items-center font-semibold">
              <span>موجودی فعلی:</span>
              <Badge className={summary.netProduct >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {formatNumber(summary.netProduct)} تن
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
