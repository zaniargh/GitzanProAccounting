"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, DollarSign } from "lucide-react"
import type { Transaction, AppData, TransactionType } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import type { FlourType } from "@/types"
import { TransactionList } from "./transaction-list"
import { useLang } from "@/components/language-provider"

interface TransactionFormProps {
  data: AppData
  onDataChange: (data: AppData) => void
}

const generateDocumentNumber = (transactions: Transaction[]): string => {
  const currentYear = new Date().getFullYear()
  const yearTransactions = transactions.filter((t) => new Date(t.createdAt).getFullYear() === currentYear)
  const nextNumber = yearTransactions.length + 1
  return `${currentYear}-${nextNumber.toString().padStart(4, "0")}`
}

export function TransactionForm({ data, onDataChange }: TransactionFormProps) {
  const [flourTypes] = useLocalStorageGeneric<FlourType[]>("flourTypes", [])
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [validationError, setValidationError] = useState<string>("")
  const { t, lang } = useLang()

  const getLocalDateTime = () => {
    const now = new Date()
    const baghdadTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Baghdad" }))
    const year = baghdadTime.getFullYear()
    const month = String(baghdadTime.getMonth() + 1).padStart(2, "0")
    const day = String(baghdadTime.getDate()).padStart(2, "0")
    const hours = String(baghdadTime.getHours()).padStart(2, "0")
    const minutes = String(baghdadTime.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const [formData, setFormData] = useState({
    type: "flour_in" as TransactionType,
    customerId: "",
    amount: "",
    weight: "", // وزن (تن)
    quantity: "", // تعداد
    unitPrice: "", // قیمت واحد
    flourTypeId: "",
    description: "",
    date: getLocalDateTime(), // استفاده از تاریخ و ساعت محلی
    currencyId: data.settings?.baseCurrencyId || "",
    weightUnit: data.settings?.baseWeightUnit || "ton",
  })

  // Update local state when global settings change (if needed, or just initialize)
  useEffect(() => {
    // Only sync if local state is empty (initial load) or if we want to force sync
    // Here we just ensure if it was empty, we pick up the global setting
    if (data.settings?.baseCurrencyId && !formData.currencyId) {
      setFormData(prev => ({ ...prev, currencyId: data.settings!.baseCurrencyId! }))
    }
    if (data.settings?.baseWeightUnit && !formData.weightUnit) {
      setFormData(prev => ({ ...prev, weightUnit: data.settings!.baseWeightUnit! }))
    }
  }, [data.settings, formData.currencyId, formData.weightUnit])

  const weightUnits = [
    { value: "mg", label: t("weightUnit_mg") },
    { value: "g", label: t("weightUnit_g") },
    { value: "kg", label: t("weightUnit_kg") },
    { value: "ton", label: t("weightUnit_ton") },
    { value: "lb", label: t("weightUnit_lb") },
  ]

  // قبلاً اینجا مشتری‌های هزینه به صورت خودکار ساخته می‌شدند.
  // به درخواست شما، دیگر هیچ مشتری پیش‌فرضی به صورت خودکار ایجاد نمی‌شود.

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type,
      customerId: transaction.customerId,
      amount: transaction.amount.toString(),
      weight: transaction.weight?.toString() || "",
      quantity: transaction.quantity?.toString() || "",
      unitPrice: transaction.unitPrice?.toString() || "",
      flourTypeId: transaction.flourTypeId || "",
      description: transaction.description,
      date: transaction.date.includes("T") ? transaction.date.slice(0, 16) : transaction.date + "T00:00",
      currencyId: transaction.currencyId || data.settings?.baseCurrencyId || "",
      weightUnit: transaction.weightUnit || data.settings?.baseWeightUnit || "ton",
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError("")

    // Validation: Customer must be selected
    if (!formData.customerId) {
      setValidationError(t("selectCustomerRequired"))
      return
    }

    // Validation for flour_in and flour_out: only one of quantity or weight should be filled
    if (formData.type === "flour_in" || formData.type === "flour_out") {
      const hasQuantity = formData.quantity && formData.quantity.trim() !== ""
      const hasWeight = formData.weight && formData.weight.trim() !== ""

      if (!hasQuantity && !hasWeight) {
        setValidationError(t("quantityOrWeightRequired"))
        return
      }

      if (hasQuantity && hasWeight) {
        setValidationError(t("quantityOrWeightRequired"))
        return
      }
    }

    let totalAmount = 0
    if (formData.type === "flour_purchase" || formData.type === "flour_sale") {
      totalAmount = Number.parseFloat(formData.weight) * Number.parseFloat(formData.unitPrice)
    } else if (
      formData.type === "cash_in" ||
      formData.type === "cash_out" ||
      formData.type === "expense" ||
      formData.type === "income"
    ) {
      totalAmount = Number.parseFloat(formData.amount)
    }

    if (editingTransaction) {
      const updatedTransactions = data.transactions.map((transaction) =>
        transaction.id === editingTransaction.id
          ? {
            ...transaction,
            type: formData.type,
            customerId: formData.customerId,
            amount: totalAmount,
            weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
            quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
            unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
            flourTypeId: formData.flourTypeId || undefined,
            description: formData.description,
            date: formData.date,
            currencyId: formData.currencyId,
            weightUnit: formData.weightUnit,
            // Preserve original createdAt
            createdAt: transaction.createdAt || transaction.date,
          }
          : transaction,
      )
      onDataChange({
        ...data,
        transactions: updatedTransactions,
      })
      setEditingTransaction(null)
    } else {
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        documentNumber: generateDocumentNumber(data.transactions),
        type: formData.type,
        customerId: formData.customerId,
        amount: totalAmount,
        weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
        quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
        unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
        flourTypeId: formData.flourTypeId || undefined,
        description: formData.description,
        date: formData.date,
        createdAt: getLocalDateTime(), // ثبت ساعت دقیق بغداد
        currencyId: formData.currencyId,
        weightUnit: formData.weightUnit,
      }

      onDataChange({
        ...data,
        transactions: [...data.transactions, newTransaction],
      })
    }

    setFormData({
      type: formData.type,
      customerId: "",
      amount: "",
      weight: "",
      quantity: "",
      unitPrice: "",
      flourTypeId: "",
      description: "",
      date: getLocalDateTime(), // استفاده از تاریخ و ساعت محلی
      currencyId: formData.currencyId, // Keep current selection
      weightUnit: formData.weightUnit, // Keep current selection
    })
    setValidationError("")
  }

  const handleCancelEdit = () => {
    setEditingTransaction(null)
    setFormData({
      type: "flour_in",
      customerId: "",
      amount: "",
      weight: "",
      quantity: "",
      unitPrice: "",
      flourTypeId: "",
      description: "",
      date: getLocalDateTime(), // استفاده از تاریخ و ساعت محلی
      currencyId: data.settings?.baseCurrencyId || "",
      weightUnit: data.settings?.baseWeightUnit || "ton",
    })
    setValidationError("")
  }

  const getCustomerName = (customerId: string) => {
    return data.customers.find((customer) => customer.id === customerId)?.name || t("unknown")
  }

  const transactionTypes = [
    { value: "flour_in", label: t("flourIn"), icon: Package, color: "text-green-600" },
    { value: "flour_out", label: t("flourOut"), icon: Package, color: "text-red-600" },
    { value: "flour_purchase", label: t("flourPurchase"), icon: Package, color: "text-blue-600" },
    { value: "flour_sale", label: t("flourSale"), icon: Package, color: "text-purple-600" },
    { value: "cash_in", label: t("cashIn"), icon: DollarSign, color: "text-green-600" },
    { value: "cash_out", label: t("cashOut"), icon: DollarSign, color: "text-red-600" },
    { value: "expense", label: t("expense"), icon: DollarSign, color: "text-orange-600" },
    { value: "income", label: t("income"), icon: DollarSign, color: "text-emerald-600" },
  ]

  const currentType = transactionTypes.find((t) => t.value === formData.type)
  const isFlourTransaction =
    formData.type === "flour_in" ||
    formData.type === "flour_out" ||
    formData.type === "flour_purchase" ||
    formData.type === "flour_sale"

  const getFilteredCustomers = () => {
    return data.customers
  }

  return (
    <div className="space-y-6">
      <Card className={`p-6 ${editingTransaction ? "ring-2 ring-blue-500 bg-blue-50/50" : ""}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {currentType && <currentType.icon className={`h-5 w-5 ${currentType.color}`} />}
            <h2 className="text-lg font-semibold">
              {editingTransaction ? (
                <span className="text-blue-600">{t("editDocumentNumber")} {editingTransaction.documentNumber}</span>
              ) : (
                t("newDocument")
              )}
            </h2>
          </div>
          {editingTransaction && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">{t("editing")}</span>
              <Button variant="outline" onClick={handleCancelEdit}>
                {t("cancelEdit")}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label>{t("baseCurrency")}</Label>
            <Select
              value={formData.currencyId}
              onValueChange={(value) => {
                setFormData({ ...formData, currencyId: value })
                // Update global settings
                onDataChange({
                  ...data,
                  settings: { ...(data.settings || {}), baseCurrencyId: value }
                })
              }}
            >
              <SelectTrigger className="text-right">
                <SelectValue placeholder={t("selectCurrency")} />
              </SelectTrigger>
              <SelectContent>
                {data.currencies?.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("baseWeight")}</Label>
            <Select
              value={formData.weightUnit}
              onValueChange={(value) => {
                setFormData({ ...formData, weightUnit: value })
                // Update global settings
                onDataChange({
                  ...data,
                  settings: { ...(data.settings || {}), baseWeightUnit: value }
                })
              }}
            >
              <SelectTrigger className="text-right">
                <SelectValue placeholder={t("selectWeightUnit")} />
              </SelectTrigger>
              <SelectContent>
                {weightUnits.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as TransactionType, customerId: "" })}
        >
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 gap-1">
            {transactionTypes.map((type) => {
              const Icon = type.icon
              return (
                <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-1 px-2 py-1">
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="hidden md:inline text-xs truncate">{type.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {transactionTypes.map((type) => (
            <TabsContent key={type.value} value={type.value}>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer">{formData.type === "expense" ? t("expenseType") : t("customer")}</Label>
                    <Select
                      value={formData.customerId}
                      onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                    >
                      <SelectTrigger className={lang === "fa" ? "text-right" : "text-left"} dir={lang === "fa" ? "rtl" : "ltr"}>
                        <SelectValue placeholder={formData.type === "expense" ? t("selectExpenseType") : t("selectCustomer")} />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredCustomers().map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                            {customer.phone !== "هزینه" && ` - ${customer.phone}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="date">{t("dateTime")}</Label>
                    <Input
                      id="date"
                      type="datetime-local"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="text-right"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isFlourTransaction && (
                    <>
                      <div>
                        <Label htmlFor="flourType">{t("flourType")}</Label>
                        <Select
                          value={formData.flourTypeId}
                          onValueChange={(value) => {
                            const selectedFlour = flourTypes.find(f => f.id === value)
                            const updates: any = { flourTypeId: value }

                            if (selectedFlour?.measurementType === "quantity") {
                              updates.weight = ""
                            } else if (selectedFlour?.measurementType === "weight") {
                              updates.quantity = ""
                            }

                            setFormData({ ...formData, ...updates })
                          }}
                        >
                          <SelectTrigger className={lang === "fa" ? "text-right" : "text-left"} dir={lang === "fa" ? "rtl" : "ltr"}>
                            <SelectValue placeholder={t("selectFlourType")} />
                          </SelectTrigger>
                          <SelectContent>
                            {flourTypes.map((flourType) => (
                              <SelectItem key={flourType.id} value={flourType.id}>
                                {flourType.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="quantity">{t("quantity")}</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          className={lang === "fa" ? "text-right" : "text-left"}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          onWheel={(e) => e.currentTarget.blur()}
                          required={formData.type === "flour_purchase" || formData.type === "flour_sale"}
                          disabled={flourTypes.find(f => f.id === formData.flourTypeId)?.measurementType === "weight"}
                        />
                      </div>

                      <div>
                        <Label htmlFor="weight">{t("weight")} ({weightUnits.find(u => u.value === formData.weightUnit)?.label || formData.weightUnit})</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={formData.weight}
                          onChange={(e) => {
                            const weight = e.target.value
                            setFormData({ ...formData, weight })
                            if (
                              weight &&
                              formData.unitPrice &&
                              (formData.type === "flour_purchase" || formData.type === "flour_sale")
                            ) {
                              const total = Number.parseFloat(weight) * Number.parseFloat(formData.unitPrice)
                              setFormData((prev) => ({ ...prev, weight, amount: total.toString() }))
                            }
                          }}
                          className={lang === "fa" ? "text-right" : "text-left"}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          onWheel={(e) => e.currentTarget.blur()}
                          required={formData.type === "flour_purchase" || formData.type === "flour_sale"}
                          disabled={flourTypes.find(f => f.id === formData.flourTypeId)?.measurementType === "quantity"}
                        />
                      </div>

                      {(formData.type === "flour_purchase" || formData.type === "flour_sale") && (
                        <div>
                          <Label htmlFor="unitPrice">{t("unitPrice")} ({data.currencies?.find(c => c.id === formData.currencyId)?.symbol || "$"}/{weightUnits.find(u => u.value === formData.weightUnit)?.label || formData.weightUnit})</Label>
                          <Input
                            id="unitPrice"
                            type="number"
                            step="0.01"
                            value={formData.unitPrice}
                            onChange={(e) => {
                              const unitPrice = e.target.value
                              setFormData({ ...formData, unitPrice })
                              if (unitPrice && formData.weight) {
                                const total = Number.parseFloat(formData.weight) * Number.parseFloat(unitPrice)
                                setFormData((prev) => ({ ...prev, unitPrice, amount: total.toString() }))
                              }
                            }}
                            className={lang === "fa" ? "text-right" : "text-left"}
                            dir={lang === "fa" ? "rtl" : "ltr"}
                            onWheel={(e) => e.currentTarget.blur()}
                            required
                          />
                        </div>
                      )}
                    </>
                  )}

                  {(formData.type === "cash_in" ||
                    formData.type === "cash_out" ||
                    formData.type === "flour_purchase" ||
                    formData.type === "flour_sale" ||
                    formData.type === "expense" ||
                    formData.type === "income") && (
                      <div className={isFlourTransaction ? "md:col-span-1" : ""}>
                        <Label htmlFor="amount">
                          {formData.type === "flour_purchase" || formData.type === "flour_sale"
                            ? `${t("totalAmountUSD")} (${data.currencies?.find(c => c.id === formData.currencyId)?.symbol || "$"})`
                            : `${t("amountUSD")} (${data.currencies?.find(c => c.id === formData.currencyId)?.symbol || "$"})`}
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className={lang === "fa" ? "text-right" : "text-left"}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          onWheel={(e) => e.currentTarget.blur()}
                          required
                          readOnly={
                            (formData.type === "flour_purchase" || formData.type === "flour_sale") &&
                            !!formData.weight &&
                            !!formData.unitPrice
                          }
                        />
                      </div>
                    )}
                </div>

                <div>
                  <Label htmlFor="description">{t("descriptionOptional")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={lang === "fa" ? "text-right" : "text-left"}
                    dir={lang === "fa" ? "rtl" : "ltr"}
                    rows={3}
                  />
                </div>

                {validationError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{validationError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={data.customers.length === 0 || (isFlourTransaction && flourTypes.length === 0)}
                >
                  {data.customers.length === 0
                    ? t("defineCustomerFirst")
                    : isFlourTransaction && flourTypes.length === 0
                      ? t("defineFlourTypeFirst")
                      : editingTransaction
                        ? t("updateDocument")
                        : t("submitDocument")}
                </Button>
              </form>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">{t("lastRegisteredDocuments")}</h3>
        <TransactionList data={data} onDataChange={onDataChange} onEdit={handleEdit} />
      </div>
    </div >
  )
}
