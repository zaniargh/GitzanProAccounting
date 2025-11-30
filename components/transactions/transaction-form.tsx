"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
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

    // Validation: Check if bank account currency matches selected currency
    if (formData.accountId && !formData.accountId.startsWith("default-")) {
      const bankAccount = data.bankAccounts?.find((acc) => acc.id === formData.accountId)
      if (bankAccount && bankAccount.currencyId !== formData.currencyId) {
        const accountCurrency = data.currencies?.find((c) => c.id === bankAccount.currencyId)?.name || "Unknown"
        const selectedCurrency = data.currencies?.find((c) => c.id === formData.currencyId)?.name || "Unknown"
        setValidationError(
          t("currencyMismatchError")
            .replace("{accountCurrency}", accountCurrency)
            .replace("{selectedCurrency}", selectedCurrency)
        )
        return
      }
    }

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

    // Validation: Product Type must be selected for product transactions
    if (isFlourTransaction && !formData.productTypeId) {
      setValidationError(t("productTypeRequired"))
      return
    }

    // Validation for product_purchase and product_sale
    if (formData.type === "product_purchase" || formData.type === "product_sale") {
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

      // اگر سند اصلی است، زیرسندهای آن را هم به‌روزرسانی کن
      if (editingTransaction.isMainDocument) {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"

        // پیدا کردن نام حساب
        let accountName = ""
        if (formData.accountId === "default-cash-safe") {
          accountName = lang === "fa" ? "صندوق" : "Cash Box"
        } else {
          const bankAccount = data.bankAccounts?.find(b => b.id === formData.accountId)
          accountName = bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountNumber}` : "Unknown"
        }

        updatedTransactions = updatedTransactions.map((t) => {
          // اگر خود سند اصلی است (که قبلاً آپدیت شده، اما اینجا دوباره چک می‌کنیم یا رد می‌شویم)
          // در واقع map قبلی خود سند اصلی را آپدیت کرده. اینجا باید زیرسندها را پیدا کنیم.

          if (t.parentDocumentId === editingTransaction.id) {
            // تشخیص اینکه کدام زیرسند است (1 یا 2) بر اساس documentNumber
            const isSubDoc1 = t.documentNumber?.endsWith("-1")
            const isSubDoc2 = t.documentNumber?.endsWith("-2")

            if (isSubDoc1) {
              // زیرسند 1: مشتری
              return {
                ...t,
                type: formData.type,
                customerId: formData.customerId,
                amount: formData.type === "cash_in" ? -totalAmount : totalAmount, // مبلغ منفی/مثبت
                description: formData.description,
                date: formData.date,
                currencyId: formData.currencyId,
                accountId: formData.accountId || "default-cash-safe",
              }
            } else if (isSubDoc2) {
              // زیرسند 2: بانک
              return {
                ...t,
                type: formData.type,
                customerId: formData.accountId || "default-cash-safe",
                amount: formData.type === "cash_in" ? totalAmount : -totalAmount, // مبلغ مثبت/منفی
                description: `${formData.type === "cash_in" ? (lang === "fa" ? "واریز به" : "Deposit to") : (lang === "fa" ? "برداشت از" : "Withdrawal from")} ${accountName}`,
                date: formData.date,
                currencyId: formData.currencyId,
                accountId: formData.accountId || "default-cash-safe",
              }
            }
          }
          return t
        })
      }

      // اگر تراکنش مرتبط دارد (روش قدیمی)
      if (editingTransaction.linkedTransactionId && (formData.type === "cash_in" || formData.type === "cash_out")) {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const accountType = formData.type // نوع یکسان

        // پیدا کردن نام حساب
        let accountName = ""
        if (formData.accountId === "default-cash-safe") {
          accountName = lang === "fa" ? "صندوق" : "Cash Box"
        } else {
          const bankAccount = data.bankAccounts?.find(b => b.id === formData.accountId)
          accountName = bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountNumber}` : "Unknown"
        }

        updatedTransactions = updatedTransactions.map((transaction) =>
          transaction.id === editingTransaction.linkedTransactionId
            ? {
              ...transaction,
              type: accountType, // نوع یکسان
              amount: totalAmount, // مبلغ جدید
              description: `${formData.type === "cash_in" ? (lang === "fa" ? "واریز به" : "Deposit to") : (lang === "fa" ? "برداشت از" : "Withdrawal from")} ${accountName}`,
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

        updatedTransactions = updatedTransactions.map((transaction) =>
          transaction.id === editingTransaction.linkedTransactionId
            ? {
              ...transaction,
              type: formData.type, // نوع یکسان
              weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
              quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
              productTypeId: formData.productTypeId,
              description: `${formData.type === "product_in" ? (lang === "fa" ? "دریافت از" : "Received from") : (lang === "fa" ? "ارسال به" : "Sent to")} ${customerName}`,
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
        createdAt: getLocalDateTime(),
        currencyId: formData.currencyId,
        weightUnit: formData.weightUnit,
        accountId: formData.accountId,
      }

      let newTransactions = []

      // اگر نوع تراکنش cash_in یا cash_out است، یک سند اصلی با دو زیرسند ایجاد کن
      if (formData.type === "cash_in" || formData.type === "cash_out") {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const mainDocId = crypto.randomUUID()
        const subDoc1Id = crypto.randomUUID()
        const subDoc2Id = crypto.randomUUID()

        const targetAccountId = formData.accountId || "default-cash-safe"

        // پیدا کردن نام حساب
        let accountName = ""
        if (targetAccountId === "default-cash-safe") {
          accountName = lang === "fa" ? "صندوق" : "Cash Box"
        } else {
          const bankAccount = data.bankAccounts?.find(b => b.id === targetAccountId)
          accountName = bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountNumber}` : "Unknown"
        }

        // سند اصلی (قرمز)
        const mainDocument: Transaction = {
          id: mainDocId,
          documentNumber: generateDocumentNumber(data.transactions),
          type: formData.type,
          customerId: formData.customerId,
          amount: formData.type === "cash_in" ? -totalAmount : totalAmount,
          description: `${formData.type === "cash_in" ? (lang === "fa" ? "دریافت از" : "Received from") : (lang === "fa" ? "پرداخت به" : "Paid to")} ${customerName} → ${accountName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          currencyId: formData.currencyId,
          accountId: targetAccountId,
          isMainDocument: true,
        }

        // زیرسند 1: دریافت از مشتری (قرمز)
        const subDocument1: Transaction = {
          id: subDoc1Id,
          documentNumber: `${mainDocument.documentNumber}-1`,
          type: formData.type,
          customerId: formData.customerId,
          amount: formData.type === "cash_in" ? -totalAmount : totalAmount,
          description: formData.description,
          date: formData.date,
          createdAt: getLocalDateTime(),
          currencyId: formData.currencyId,
          accountId: targetAccountId,
          parentDocumentId: mainDocId,
        }

        // زیرسند 2: واریز به بانک (سبز)
        const subDocument2: Transaction = {
          id: subDoc2Id,
          documentNumber: `${mainDocument.documentNumber}-2`,
          type: formData.type,
          customerId: targetAccountId,
          amount: formData.type === "cash_in" ? totalAmount : -totalAmount,
          description: `${formData.type === "cash_in" ? (lang === "fa" ? "واریز به" : "Deposit to") : (lang === "fa" ? "برداشت از" : "Withdrawal from")} ${accountName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          currencyId: formData.currencyId,
          accountId: targetAccountId,
          parentDocumentId: mainDocId,
        }

        newTransactions = [mainDocument, subDocument1, subDocument2]
      } else if (formData.type === "product_in" || formData.type === "product_out") {
        // برای محصولات، همان روال قبلی warehouse
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const warehouseTransactionId = crypto.randomUUID()

        const warehouseTransaction: Transaction = {
          id: warehouseTransactionId,
          documentNumber: generateDocumentNumber([...data.transactions, newTransaction]),
          type: formData.type,
          customerId: "default-warehouse",
          amount: 0,
          weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
          quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
          productTypeId: formData.productTypeId,
          description: `${formData.type === "product_in" ? (lang === "fa" ? "دریافت از" : "Received from") : (lang === "fa" ? "ارسال به" : "Sent to")} ${customerName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          weightUnit: formData.weightUnit,
          linkedTransactionId: newTransaction.id,
        }

        newTransaction.linkedTransactionId = warehouseTransactionId
        newTransactions = [newTransaction, warehouseTransaction]
      } else {
        newTransactions = [newTransaction]
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Customer Selection - Spans 4 columns */}
                  <div className="md:col-span-4">
                    <Label htmlFor="customer" className="text-xs mb-1 block">{formData.type === "expense" ? t("expenseType") : t("customer")}</Label>
                    <SearchableSelect
                      value={formData.customerId}
                      onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                      options={getFilteredCustomers().map((customer) => {
                        let displayName = customer.name
                        if (customer.id === "default-cash-safe") {
                          displayName = lang === "fa" ? "صندوق" : "Cash Box"
                        } else if (customer.id === "default-warehouse") {
                          displayName = lang === "fa" ? "موجودی" : "Inventory"
                        }
                        const code = customer.customerCode ? `${customer.customerCode} - ` : ""
                        const label = customer.phone !== "هزینه" ? `${code}${displayName}` : displayName
                        return {
                          value: customer.id,
                          label: label,
                          keywords: [customer.customerCode || "", displayName, customer.phone, label]
                        }
                      })}
                      placeholder={formData.type === "expense" ? t("selectExpenseType") : t("selectCustomer")}
                      searchPlaceholder={lang === "fa" ? "جستجو..." : "Search..."}
                      emptyText={lang === "fa" ? "نتیجه‌ای یافت نشد" : "No results found"}
                      className={lang === "fa" ? "text-right h-9 text-sm" : "text-left h-9 text-sm"}
                    />
                  </div>

                  {/* Date - Spans 3 columns */}
                  <div className="md:col-span-3">
                    <Label htmlFor="date" className="text-xs mb-1 block">{t("dateTime")}</Label>
                    <Input
                      id="date"
                      type="datetime-local"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="text-right h-9 text-sm"
                      required
                    />
                  </div>

                  {/* Amount - Spans 3 columns (if applicable) */}
                  {(formData.type === "cash_in" || formData.type === "cash_out" || formData.type === "expense" || formData.type === "income") && (
                    <div className="md:col-span-3">
                      <Label htmlFor="amount" className="text-xs mb-1 block">{t("amount")}</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="text-right h-9 text-sm"
                        required
                      />
                    </div>
                  )}

                  {/* Account Selector - Spans 2 columns (if applicable) */}
                  {(formData.type === "cash_in" || formData.type === "cash_out") && (
                    <div className="md:col-span-2">
                      <Label htmlFor="accountId" className="text-xs mb-1 block">
                        {formData.type === "cash_in" ? t("depositTo") : t("withdrawFrom")}
                      </Label>
                      <SearchableSelect
                        value={formData.accountId}
                        onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                        options={[
                          { value: "default-cash-safe", label: lang === "fa" ? "صندوق" : "Cash Box" },
                          ...(data.bankAccounts || []).map((account) => ({
                            value: account.id,
                            label: `${account.bankName} - ${account.accountNumber}`
                          }))
                        ]}
                        placeholder={t("selectCashAccount")}
                        searchPlaceholder={lang === "fa" ? "جستجو..." : "Search..."}
                        emptyText={lang === "fa" ? "نتیجه‌ای یافت نشد" : "No results found"}
                        className={lang === "fa" ? "text-right h-9 text-sm" : "text-left h-9 text-sm"}
                      />
                    </div>
                  )}

                  {/* Product Fields */}
                  {isFlourTransaction && (
                    <>
                      <div className="md:col-span-3">
                        <Label htmlFor="productType" className="text-xs mb-1 block">{t("productType")}</Label>
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
                          <SelectTrigger className={`h-9 text-sm ${lang === "fa" ? "text-right" : "text-left"}`} dir={lang === "fa" ? "rtl" : "ltr"}>
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

                      {(() => {
                        const selectedProduct = productTypes.find(p => p.id === formData.productTypeId)
                        const isQuantity = selectedProduct?.measurementType === "quantity"
                        const isWeight = selectedProduct?.measurementType === "weight" || !selectedProduct

                        return (
                          <>
                            {isWeight && (
                              <div className="md:col-span-2">
                                <Label htmlFor="weight" className="text-xs mb-1 block">{t("weight")}</Label>
                                <Input
                                  id="weight"
                                  type="number"
                                  step="0.001"
                                  value={formData.weight}
                                  onChange={(e) => {
                                    const weight = e.target.value
                                    setFormData(prev => {
                                      const newData = { ...prev, weight }
                                      if (weight && prev.unitPrice && (prev.type === "product_purchase" || prev.type === "product_sale")) {
                                        const weightNum = Number.parseFloat(weight)
                                        const priceNum = Number.parseFloat(prev.unitPrice)
                                        if (!isNaN(weightNum) && !isNaN(priceNum)) {
                                          newData.amount = (weightNum * priceNum).toString()
                                        }
                                      }
                                      return newData
                                    })
                                  }}
                                  className="text-right h-9 text-sm"
                                  placeholder={t("weightPlaceholder")}
                                />
                              </div>
                            )}
                            {isQuantity && (
                              <div className="md:col-span-2">
                                <Label htmlFor="quantity" className="text-xs mb-1 block">{t("quantity")}</Label>
                                <Input
                                  id="quantity"
                                  type="number"
                                  step="1"
                                  value={formData.quantity}
                                  onChange={(e) => {
                                    const quantity = e.target.value
                                    setFormData(prev => {
                                      const newData = { ...prev, quantity }
                                      if (quantity && prev.unitPrice && (prev.type === "product_purchase" || prev.type === "product_sale")) {
                                        const qtyNum = Number.parseInt(quantity)
                                        const priceNum = Number.parseFloat(prev.unitPrice)
                                        if (!isNaN(qtyNum) && !isNaN(priceNum)) {
                                          newData.amount = (qtyNum * priceNum).toString()
                                        }
                                      }
                                      return newData
                                    })
                                  }}
                                  className="text-right h-9 text-sm"
                                  placeholder={t("quantityPlaceholder")}
                                />
                              </div>
                            )}
                          </>
                        )
                      })()}

                      {(formData.type === "product_purchase" || formData.type === "product_sale") && (
                        <div className="md:col-span-3">
                          <Label htmlFor="unitPrice" className="text-xs mb-1 block">{t("unitPrice")}</Label>
                          <div className="relative">
                            <Input
                              id="unitPrice"
                              type="number"
                              step="0.01"
                              value={formData.unitPrice}
                              onChange={(e) => {
                                const unitPrice = e.target.value
                                setFormData(prev => {
                                  const newData = { ...prev, unitPrice }
                                  if (unitPrice) {
                                    const priceNum = Number.parseFloat(unitPrice)
                                    if (!isNaN(priceNum)) {
                                      let total = 0
                                      if (prev.weight) {
                                        const weightNum = Number.parseFloat(prev.weight)
                                        if (!isNaN(weightNum)) total = weightNum * priceNum
                                      } else if (prev.quantity) {
                                        const qtyNum = Number.parseInt(prev.quantity)
                                        if (!isNaN(qtyNum)) total = qtyNum * priceNum
                                      }
                                      if (total > 0) newData.amount = total.toString()
                                    }
                                  }
                                  return newData
                                })
                              }}
                              className="text-right h-9 text-sm pl-8"
                              placeholder="0.00"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                              {data.currencies?.find(c => c.id === formData.currencyId)?.symbol || "$"}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {(formData.type === "product_purchase" ||
                    formData.type === "product_sale" ||
                    formData.type === "expense" ||
                    formData.type === "income") && (
                      <div className={isFlourTransaction ? "md:col-span-2" : "md:col-span-3"}>
                        <Label htmlFor="amount" className="text-xs mb-1 block">
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
                          className="text-right h-9 text-sm"
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

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-12">
                    <Label htmlFor="description" className="text-xs mb-1 block">{t("descriptionOptional")}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="text-right h-16 text-sm resize-none"
                      placeholder={t("descriptionPlaceholder")}
                    />
                  </div>
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
