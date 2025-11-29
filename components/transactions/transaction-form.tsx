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
import type { ProductType } from "@/types"
import { TransactionList } from "./transaction-list"
import { useLang } from "@/components/language-provider"

interface TransactionFormProps {
  data: AppData
  onDataChange: (data: AppData) => void
  productTypes?: ProductType[]
}

const generateDocumentNumber = (transactions: Transaction[]): string => {
  const currentYear = new Date().getFullYear()
  const yearTransactions = transactions.filter((t) => new Date(t.createdAt).getFullYear() === currentYear)
  const nextNumber = yearTransactions.length + 1
  return `${currentYear}-${nextNumber.toString().padStart(4, "0")}`
}

export function TransactionForm({ data, onDataChange, productTypes = [] }: TransactionFormProps) {
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
    const seconds = String(baghdadTime.getSeconds()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  }

  const [formData, setFormData] = useState({
    type: "product_in" as TransactionType,
    customerId: "",
    amount: "",
    weight: "", // وزن (تن)
    quantity: "", // تعداد
    unitPrice: "", // قیمت واحد
    productTypeId: "",
    description: "",
    date: getLocalDateTime(), // استفاده از تاریخ و ساعت محلی
    currencyId: data.settings?.baseCurrencyId || "",
    weightUnit: data.settings?.baseWeightUnit || "ton",
    accountId: "default-cash-safe", // حساب نقدی (Cash Safe یا Bank Account)
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
      productTypeId: transaction.productTypeId || "",
      description: transaction.description,
      date: transaction.date.includes("T") ? transaction.date.slice(0, 16) : transaction.date + "T00:00",
      currencyId: transaction.currencyId || data.settings?.baseCurrencyId || "",
      weightUnit: transaction.weightUnit || data.settings?.baseWeightUnit || "ton",
      accountId: transaction.accountId || "default-cash-safe",
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

    // Validation for product_in and product_out: only one of quantity or weight should be filled
    if (formData.type === "product_in" || formData.type === "product_out") {
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
    if (formData.type === "product_purchase" || formData.type === "product_sale") {
      if (formData.weight && formData.unitPrice) {
        const weightNum = Number.parseFloat(formData.weight)
        const priceNum = Number.parseFloat(formData.unitPrice)
        if (!isNaN(weightNum) && !isNaN(priceNum)) {
          totalAmount = weightNum * priceNum
        }
      } else if (formData.quantity && formData.unitPrice) {
        const qtyNum = Number.parseInt(formData.quantity)
        const priceNum = Number.parseFloat(formData.unitPrice)
        if (!isNaN(qtyNum) && !isNaN(priceNum)) {
          totalAmount = qtyNum * priceNum
        }
      }
    } else if (
      formData.type === "cash_in" ||
      formData.type === "cash_out" ||
      formData.type === "expense" ||
      formData.type === "income"
    ) {
      totalAmount = Number.parseFloat(formData.amount)
    }

    if (editingTransaction) {
      let updatedTransactions = data.transactions.map((transaction) =>
        transaction.id === editingTransaction.id
          ? {
            ...transaction,
            type: formData.type,
            customerId: formData.customerId,
            amount: totalAmount,
            weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
            quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
            unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
            productTypeId: formData.productTypeId || undefined,
            description: formData.description,
            date: formData.date,
            currencyId: formData.currencyId,
            weightUnit: formData.weightUnit,
            accountId: formData.accountId || "default-cash-safe",
            // Preserve original createdAt
            createdAt: transaction.createdAt || transaction.date,
          }
          : transaction,
      )

      // اگر تراکنش مرتبط دارد و نوع cash_in یا cash_out است، تراکنش حساب را هم به‌روزرسانی کن
      if (editingTransaction.linkedTransactionId && (formData.type === "cash_in" || formData.type === "cash_out")) {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const accountType = formData.type === "cash_in" ? "cash_out" : "cash_in"

        updatedTransactions = updatedTransactions.map((transaction) =>
          transaction.id === editingTransaction.linkedTransactionId
            ? {
              ...transaction,
              type: accountType, // نوع معکوس
              amount: totalAmount, // مبلغ جدید
              description: `${formData.type === "cash_in" ? "دریافت از" : "پرداخت به"} ${customerName}`,
              date: formData.date, // تاریخ جدید
              currencyId: formData.currencyId, // ارز جدید
              customerId: formData.accountId, // حساب انتخابی
              accountId: formData.accountId,
            }
            : transaction,
        )
      }

      // اگر تراکنش مرتبط دارد و نوع product_in یا product_out است، تراکنش انبار را هم به‌روزرسانی کن
      if (editingTransaction.linkedTransactionId && (formData.type === "product_in" || formData.type === "product_out")) {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const warehouseType = formData.type === "product_in" ? "product_out" : "product_in"

        updatedTransactions = updatedTransactions.map((transaction) =>
          transaction.id === editingTransaction.linkedTransactionId
            ? {
              ...transaction,
              type: warehouseType, // نوع معکوس
              weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
              quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
              productTypeId: formData.productTypeId,
              description: `${formData.type === "product_in" ? "دریافت از" : "ارسال به"} ${customerName}`,
              date: formData.date, // تاریخ جدید
              weightUnit: formData.weightUnit,
            }
            : transaction,
        )
      }

      onDataChange({
        ...data,
        transactions: updatedTransactions,
      })
      setEditingTransaction(null)
    } else {
      const newTransaction: Transaction = {
        id: crypto.randomUUID(),
        documentNumber: generateDocumentNumber(data.transactions),
        type: formData.type,
        customerId: formData.customerId,
        amount: totalAmount,
        weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
        quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
        unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
        productTypeId: formData.productTypeId || undefined,
        description: formData.description,
        date: formData.date,
        createdAt: getLocalDateTime(), // ثبت ساعت دقیق بغداد
        currencyId: formData.currencyId,
        weightUnit: formData.weightUnit,
        accountId: formData.accountId,
      }

      let newTransactions = [newTransaction]

      // اگر نوع تراکنش cash_in یا cash_out است، یک تراکنش مرتبط برای حساب انتخابی ایجاد کن
      if (formData.type === "cash_in" || formData.type === "cash_out") {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const accountTransactionId = crypto.randomUUID()

        // نوع معکوس: اگر از مشتری cash_in گرفتیم، حساب cash_out می‌کند (پول پرداخت می‌کند به کاربر)
        const accountType = formData.type === "cash_in" ? "cash_out" : "cash_in"

        const accountTransaction: Transaction = {
          id: accountTransactionId,
          documentNumber: generateDocumentNumber([...data.transactions, newTransaction]),
          type: accountType, // نوع معکوس
          customerId: formData.accountId, // حساب انتخابی (Cash Safe یا Bank Account)
          amount: totalAmount,
          description: `${formData.type === "cash_in" ? "دریافت از" : "پرداخت به"} ${customerName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          currencyId: formData.currencyId,
          linkedTransactionId: newTransaction.id, // لینک به تراکنش اصلی
          accountId: formData.accountId,
        }

        // لینک تراکنش اصلی به تراکنش حساب
        newTransaction.linkedTransactionId = accountTransactionId
        newTransaction.accountId = formData.accountId // ذخیره حساب استفاده شده

        newTransactions.push(accountTransaction)
      }

      // اگر نوع تراکنش product_in یا product_out است، یک تراکنش مرتبط برای انبار ایجاد کن
      if (formData.type === "product_in" || formData.type === "product_out") {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const warehouseTransactionId = crypto.randomUUID()

        // نوع معکوس: اگر از مشتری product_in گرفتیم، انبار product_out می‌کند (کالا تحویل می‌دهد)
        const warehouseType = formData.type === "product_in" ? "product_out" : "product_in"

        const warehouseTransaction: Transaction = {
          id: warehouseTransactionId,
          documentNumber: generateDocumentNumber([...data.transactions, newTransaction]),
          type: warehouseType, // نوع معکوس
          customerId: "default-warehouse", // انبار
          amount: 0, // برای تراکنش‌های محصول مبلغ صفر است
          weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
          quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
          productTypeId: formData.productTypeId,
          description: `${formData.type === "product_in" ? "دریافت از" : "ارسال به"} ${customerName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          weightUnit: formData.weightUnit,
          linkedTransactionId: newTransaction.id, // لینک به تراکنش اصلی
        }

        // لینک تراکنش اصلی به تراکنش انبار
        newTransaction.linkedTransactionId = warehouseTransactionId

        newTransactions.push(warehouseTransaction)
      }

      onDataChange({
        ...data,
        transactions: [...data.transactions, ...newTransactions],
      })
    }

    setFormData({
      type: formData.type,
      customerId: "",
      amount: "",
      weight: "",
      quantity: "",
      unitPrice: "",
      productTypeId: "",
      description: "",
      date: getLocalDateTime(), // استفاده از تاریخ و ساعت محلی
      currencyId: formData.currencyId, // Keep current selection
      weightUnit: formData.weightUnit, // Keep current selection
      accountId: formData.accountId, // Keep current selection
    })
    setValidationError("")
  }

  const handleCancelEdit = () => {
    setEditingTransaction(null)
    setFormData({
      type: "product_in",
      customerId: "",
      amount: "",
      weight: "",
      quantity: "",
      unitPrice: "",
      productTypeId: "",
      description: "",
      date: getLocalDateTime(), // استفاده از تاریخ و ساعت محلی
      currencyId: data.settings?.baseCurrencyId || "",
      weightUnit: data.settings?.baseWeightUnit || "ton",
      accountId: "default-cash-safe",
    })
    setValidationError("")
  }

  const getCustomerName = (customerId: string) => {
    return data.customers.find((customer) => customer.id === customerId)?.name || t("unknown")
  }

  const transactionTypes = [
    { value: "product_in", label: t("productIn"), icon: Package, color: "text-green-600" },
    { value: "product_out", label: t("productOut"), icon: Package, color: "text-red-600" },
    { value: "product_purchase", label: t("productPurchase"), icon: Package, color: "text-blue-600" },
    { value: "product_sale", label: t("productSale"), icon: Package, color: "text-purple-600" },
    { value: "cash_in", label: t("cashIn"), icon: DollarSign, color: "text-green-600" },
    { value: "cash_out", label: t("cashOut"), icon: DollarSign, color: "text-red-600" },
    { value: "expense", label: t("expense"), icon: DollarSign, color: "text-orange-600" },
    { value: "income", label: t("income"), icon: DollarSign, color: "text-emerald-600" },
  ]

  const currentType = transactionTypes.find((t) => t.value === formData.type)
  const isFlourTransaction =
    formData.type === "product_in" ||
    formData.type === "product_out" ||
    formData.type === "product_purchase" ||
    formData.type === "product_sale"

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
                  {/* Amount field - only for transactions with monetary value */}
                  {(formData.type === "cash_in" || formData.type === "cash_out") && (
                    <div>
                      <Label htmlFor="amount">{t("amount")}</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="text-right"
                        required
                      />
                    </div>
                  )}

                  {/* Account Selector for Cash Transactions */}
                  {(formData.type === "cash_in" || formData.type === "cash_out") && (
                    <div>
                      <Label htmlFor="accountId">
                        {formData.type === "cash_in" ? t("depositTo") : t("withdrawFrom")}
                      </Label>
                      <Select
                        value={formData.accountId}
                        onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                        required
                      >
                        <SelectTrigger id="accountId" className={lang === "fa" ? "text-right" : "text-left"} dir={lang === "fa" ? "rtl" : "ltr"}>
                          <SelectValue placeholder={t("selectCashAccount")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default-cash-safe">
                            {lang === "fa" ? "صندوق من" : "Cash Safe"}
                          </SelectItem>
                          {(data.bankAccounts || []).map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.bankName} - {account.accountNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isFlourTransaction && (
                    <>
                      <div>
                        <Label htmlFor="productType">{t("productType")}</Label>
                        <Select
                          value={formData.productTypeId}
                          onValueChange={(value) => {
                            const selectedProduct = productTypes.find(f => f.id === value)
                            const updates: any = { productTypeId: value }

                            if (selectedProduct?.measurementType === "quantity") {
                              updates.weight = ""
                            } else if (selectedProduct?.measurementType === "weight") {
                              updates.quantity = ""
                            }

                            setFormData({ ...formData, ...updates })
                          }}
                        >
                          <SelectTrigger className={lang === "fa" ? "text-right" : "text-left"} dir={lang === "fa" ? "rtl" : "ltr"}>
                            <SelectValue placeholder={t("selectProductType")} />
                          </SelectTrigger>
                          <SelectContent>
                            {productTypes.map((productType) => (
                              <SelectItem key={productType.id} value={productType.id}>
                                {productType.name}
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
                          onChange={(e) => {
                            const quantity = e.target.value
                            setFormData({ ...formData, quantity })
                            if (
                              quantity &&
                              formData.unitPrice &&
                              (formData.type === "product_purchase" || formData.type === "product_sale")
                            ) {
                              const qtyNum = Number.parseInt(quantity)
                              const priceNum = Number.parseFloat(formData.unitPrice)
                              if (!isNaN(qtyNum) && !isNaN(priceNum)) {
                                const total = qtyNum * priceNum
                                setFormData((prev) => ({ ...prev, quantity, amount: total.toString() }))
                              }
                            }
                          }}
                          className={lang === "fa" ? "text-right" : "text-left"}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          onWheel={(e) => e.currentTarget.blur()}
                          required={formData.type === "product_purchase" || formData.type === "product_sale"}
                          disabled={productTypes.find(f => f.id === formData.productTypeId)?.measurementType === "weight"}
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
                              (formData.type === "product_purchase" || formData.type === "product_sale")
                            ) {
                              const weightNum = Number.parseFloat(weight)
                              const priceNum = Number.parseFloat(formData.unitPrice)
                              if (!isNaN(weightNum) && !isNaN(priceNum)) {
                                const total = weightNum * priceNum
                                setFormData((prev) => ({ ...prev, weight, amount: total.toString() }))
                              }
                            }
                          }}
                          className={lang === "fa" ? "text-right" : "text-left"}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          onWheel={(e) => e.currentTarget.blur()}
                          required={formData.type === "product_purchase" || formData.type === "product_sale"}
                          disabled={productTypes.find(f => f.id === formData.productTypeId)?.measurementType === "quantity"}
                        />
                      </div>

                      {(formData.type === "product_purchase" || formData.type === "product_sale") && (
                        <div>
                          <Label htmlFor="unitPrice">
                            {t("unitPrice")} ({data.currencies?.find(c => c.id === formData.currencyId)?.symbol || "$"}/
                            {productTypes.find(f => f.id === formData.productTypeId)?.measurementType === "quantity"
                              ? t("unit")
                              : (weightUnits.find(u => u.value === formData.weightUnit)?.label || formData.weightUnit)}
                            )
                          </Label>
                          <Input
                            id="unitPrice"
                            type="number"
                            step="0.01"
                            value={formData.unitPrice}
                            onChange={(e) => {
                              const unitPrice = e.target.value
                              setFormData({ ...formData, unitPrice })
                              if (unitPrice) {
                                const priceNum = Number.parseFloat(unitPrice)
                                if (!isNaN(priceNum)) {
                                  let total = 0
                                  if (formData.weight) {
                                    const weightNum = Number.parseFloat(formData.weight)
                                    if (!isNaN(weightNum)) {
                                      total = weightNum * priceNum
                                    }
                                  } else if (formData.quantity) {
                                    const qtyNum = Number.parseInt(formData.quantity)
                                    if (!isNaN(qtyNum)) {
                                      total = qtyNum * priceNum
                                    }
                                  }
                                  if (total > 0) {
                                    setFormData((prev) => ({ ...prev, unitPrice, amount: total.toString() }))
                                  }
                                }
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

                  {(formData.type === "product_purchase" ||
                    formData.type === "product_sale" ||
                    formData.type === "expense" ||
                    formData.type === "income") && (
                      <div className={isFlourTransaction ? "md:col-span-1" : ""}>
                        <Label htmlFor="amount">
                          {formData.type === "product_purchase" || formData.type === "product_sale"
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
                            (formData.type === "product_purchase" || formData.type === "product_sale") &&
                            (!!formData.weight || !!formData.quantity) &&
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
                  disabled={data.customers.length === 0 || (isFlourTransaction && productTypes.length === 0)}
                >
                  {data.customers.length === 0
                    ? t("defineCustomerFirst")
                    : isFlourTransaction && productTypes.length === 0
                      ? t("defineProductTypeFirst")
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
