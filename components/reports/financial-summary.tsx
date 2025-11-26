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
    let totalCashIn = 0
    let totalCashOut = 0
    let totalFlourIn = 0
    let totalFlourOut = 0
    let totalFlourInAmount = 0
    let totalFlourOutAmount = 0

    data.transactions.forEach((transaction) => {
      switch (transaction.type) {
        case "cash_in":
          totalCashIn += transaction.amount
          break
        case "cash_out":
          totalCashOut += transaction.amount
          break
        case "flour_in":
          totalFlourIn += transaction.quantity || 0
          totalFlourInAmount += transaction.amount
          break
        case "flour_out":
          totalFlourOut += transaction.quantity || 0
          totalFlourOutAmount += transaction.amount
          break
      }
    })

    const netCash = totalCashIn - totalCashOut
    const netFlour = totalFlourIn - totalFlourOut
    const totalRevenue = totalCashIn + totalFlourOutAmount
    const totalExpenses = totalCashOut + totalFlourInAmount
    const netProfit = totalRevenue - totalExpenses

    return {
      totalCashIn,
      totalCashOut,
      netCash,
      totalFlourIn,
      totalFlourOut,
      netFlour,
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
      title: "موجودی آرد",
      value: summary.netFlour,
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
          <h3 className="font-semibold mb-4">موجودی آرد</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>ورود آرد:</span>
              <Badge className="bg-blue-100 text-blue-800">{formatNumber(summary.totalFlourIn)} تن</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>خروج آرد:</span>
              <Badge className="bg-orange-100 text-orange-800">{formatNumber(summary.totalFlourOut)} تن</Badge>
            </div>
            <hr />
            <div className="flex justify-between items-center font-semibold">
              <span>موجودی فعلی:</span>
              <Badge className={summary.netFlour >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {formatNumber(summary.netFlour)} تن
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
