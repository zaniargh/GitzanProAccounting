"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Package, DollarSign, Trash2 } from "lucide-react"
import type { Transaction, AppData, TransactionType } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import type { ProductType } from "@/types"
import { TransactionList } from "./transaction-list"
import { useLang } from "@/components/language-provider"
import { formatBothDatesWithTime } from "@/lib/date-utils"

interface TransactionFormProps {
  data: AppData
  onDataChange: (data: AppData) => void
  productTypes?: ProductType[]
}

const generateDocumentNumber = (transactions: Transaction[]): string => {
  const currentYear = new Date().getFullYear()

  // فقط Main Documents رو بگیر (یا اسنادی که parentDocumentId ندارند)
  const mainDocuments = transactions.filter((t) => !t.parentDocumentId)

  // از بین Main Documents فقط اونایی که سال جاریند
  const yearMainDocs = mainDocuments.filter((t) => {
    const docYear = t.documentNumber?.split('-')[0]
    return docYear === currentYear.toString()
  })

  // بیشترین شماره رو پیدا کن
  let maxNumber = 0
  yearMainDocs.forEach((t) => {
    if (t.documentNumber) {
      const parts = t.documentNumber.split('-')
      if (parts.length >= 2) {
        const num = parseInt(parts[1])
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num
        }
      }
    }
  })

  const nextNumber = maxNumber + 1
  return `${currentYear}-${nextNumber.toString().padStart(4, "0")}`
}

// Helper functions for number formatting with commas
const formatNumberWithCommas = (value: string): string => {
  // Remove all non-digit characters except decimal point
  const cleanValue = value.replace(/[^\d.]/g, "")

  // Split by decimal point
  const parts = cleanValue.split(".")

  // Add commas to integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  return parts.join(".")
}

const parseFormattedNumber = (value: string): string => {
  // Remove commas and return clean number
  return value.replace(/,/g, "")
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
    accountId: "default-cash-safe", // Added accountId to formData initialization
  })

  const [temporaryTransactions, setTemporaryTransactions] = useLocalStorageGeneric<Transaction[]>("temp-transactions", [])
  const [customerChangeDialog, setCustomerChangeDialog] = useState<{ show: boolean; newCustomerId: string; previousCustomerName: string }>({ show: false, newCustomerId: "", previousCustomerName: "" })

  // محاسبه شماره سند بعدی
  const nextDocumentNumber = useMemo(() => editingTransaction?.documentNumber || generateDocumentNumber(data.transactions), [editingTransaction?.documentNumber, data.transactions])

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

  // Auto-select customer from temporary transactions
  useEffect(() => {
    // If we have temporary transactions and no customer is selected yet
    if (temporaryTransactions.length > 0 && !formData.customerId) {
      const firstTempCustomerId = temporaryTransactions[0].customerId
      if (firstTempCustomerId) {
        setFormData(prev => ({ ...prev, customerId: firstTempCustomerId }))
      }
    }
  }, [temporaryTransactions, formData.customerId])

  // Auto-populate description for cash/bank transactions
  useEffect(() => {
    // Only auto-populate for cash transactions
    if (formData.type !== "cash_in" && formData.type !== "cash_out") {
      return
    }

    // Get account name
    let accountName = ""
    if (formData.accountId === "default-cash-safe") {
      accountName = lang === "fa" ? "صندوق" : "Cash Box"
    } else if (formData.accountId) {
      const bankAccount = data.bankAccounts?.find(b => b.id === formData.accountId)
      if (bankAccount) {
        accountName = `${bankAccount.bankName} - ${bankAccount.accountNumber}`
      }
    }

    if (accountName) {
      let autoDescription = ""
      if (formData.type === "cash_in") {
        // واریز به (صندوق / حساب بانکی)
        autoDescription = lang === "fa" ? `واریز به ${accountName}` : `Transfer to ${accountName}`
      } else if (formData.type === "cash_out") {
        // برداشت از (صندوق / حساب بانکی)
        autoDescription = lang === "fa" ? `برداشت از ${accountName}` : `Withdrawal from ${accountName}`
      }

      setFormData(prev => ({ ...prev, description: autoDescription }))
    }
  }, [formData.type, formData.accountId, data.bankAccounts, lang])

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
    // اگر سند اصلی است، همه زیرسندها را به موقت ببر
    if (transaction.isMainDocument) {
      // پیدا کردن همه زیرسندها
      const subdocs = data.transactions.filter(t => t.parentDocumentId === transaction.id)

      // اضافه کردن زیرسندها به لیست موقت
      const tempSubdocs = subdocs.map(subdoc => ({
        ...subdoc,
        id: crypto.randomUUID(), // ID جدید برای موقت
      }))

      setTemporaryTransactions([...temporaryTransactions, ...tempSubdocs])

      // حذف سند اصلی و زیرسندها از transactions
      const updatedTransactions = data.transactions.filter(t =>
        t.id !== transaction.id && t.parentDocumentId !== transaction.id
      )

      onDataChange({
        ...data,
        transactions: updatedTransactions
      })

      // فرم را reset کن
      setFormData({
        type: "product_in",
        customerId: transaction.customerId, // نگه داشتن مشتری
        amount: "",
        weight: "",
        quantity: "",
        unitPrice: "",
        productTypeId: "",
        description: "",
        date: getLocalDateTime(),
        currencyId: data.settings?.baseCurrencyId || "",
        weightUnit: data.settings?.baseWeightUnit || "ton",
        accountId: "default-cash-safe",
      })

      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    // اگر زیرسند عادی است، مثل قبل ویرایش شود
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

  const handleTemporarySubmit = (e: React.FormEvent) => {
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

    // Check if customer matches existing temporary transactions
    if (temporaryTransactions.length > 0) {
      const firstTemp = temporaryTransactions[0]
      if (firstTemp.customerId !== formData.customerId) {
        setValidationError(t("customerMismatchError"))
        return
      }
    }

    // Basic form validation (similar to handleSubmit)
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

    if (isFlourTransaction && !formData.productTypeId) {
      // For receivable/payable, if we have an amount, we don't strictly need a product type
      // unless the user has started entering weight/quantity
      const isReceivablePayable = formData.type === "receivable" || formData.type === "payable";
      const hasAmount = formData.amount && formData.amount.trim() !== "";
      const hasProductDetails = (formData.weight && formData.weight.trim() !== "") || (formData.quantity && formData.quantity.trim() !== "");

      if (isReceivablePayable && hasAmount && !hasProductDetails) {
        // Valid case: Amount only, no product details
      } else {
        setValidationError(t("productTypeRequired"))
        return
      }
    }

    // Calculate amount if needed
    let totalAmount = 0
    if (formData.type === "product_purchase" || formData.type === "product_sale") {
      if (formData.weight && formData.unitPrice) {
        totalAmount = Number.parseFloat(formData.weight) * Number.parseFloat(formData.unitPrice)
      } else if (formData.quantity && formData.unitPrice) {
        totalAmount = Number.parseInt(formData.quantity) * Number.parseFloat(formData.unitPrice)
      }
    } else if (["cash_in", "cash_out", "expense", "income", "receivable", "payable"].includes(formData.type)) {
      totalAmount = Number.parseFloat(formData.amount)
    }

    // Auto-generate description for expense/income with account info
    let finalDescription = formData.description
    if ((formData.type === "expense" || formData.type === "income") && formData.accountId) {
      // Get customer name
      const customer = data.customers.find(c => c.id === formData.customerId)
      const customerName = customer?.name || ""

      // Get account name
      let accountName = ""
      if (formData.accountId === "default-cash-safe") {
        accountName = lang === "fa" ? "صندوق" : "Cash Box"
      } else {
        const bankAccount = data.bankAccounts?.find(acc => acc.id === formData.accountId)
        if (bankAccount) {
          accountName = `${bankAccount.bankName} - ${bankAccount.accountNumber}`
        }
      }

      const action = formData.type === "expense"
        ? (lang === "fa" ? "پرداخت از" : "Paid from")
        : (lang === "fa" ? "دریافت در" : "Received in")

      // Include customer name if available
      const customerPart = customerName ? `${lang === "fa" ? "مربوط به" : "Related to"}: ${customerName}` : ""
      const autoDesc = customerPart
        ? `${customerPart} - ${action}: ${accountName}`
        : `${action}: ${accountName}`

      finalDescription = finalDescription ? `${finalDescription} - ${autoDesc}` : autoDesc
    }

    const tempTransaction: Transaction = {
      id: crypto.randomUUID(),
      documentNumber: `${nextDocumentNumber}-${temporaryTransactions.length + 1}`, // Temporary number
      type: formData.type,
      customerId: formData.customerId, // نام مشتری اصلی نمایش داده می‌شود
      amount: totalAmount,
      weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
      quantity: formData.quantity ? Number.parseInt(formData.quantity) : undefined,
      unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
      productTypeId: formData.productTypeId || undefined,
      description: finalDescription,
      date: formData.date,
      createdAt: getLocalDateTime(),
      currencyId: formData.currencyId,
      weightUnit: formData.weightUnit,
      accountId: formData.accountId, // برای expense/income، accountId مشخص می‌کند موجودی کدام حساب باید به‌روز شود
    }

    setTemporaryTransactions([...temporaryTransactions, tempTransaction])

    // Clear form but keep customer and date
    setFormData({
      ...formData,
      amount: "",
      weight: "",
      quantity: "",
      unitPrice: "",
      productTypeId: "",
      description: "",
      // Keep customerId, date, currencyId, weightUnit, accountId
    })
  }

  const handleDeleteTemporary = (id: string) => {
    if (confirm(t("confirmDeleteTemporary"))) {
      setTemporaryTransactions(temporaryTransactions.filter(t => t.id !== id))
    }
  }

  const handleEditTemporary = (tx: Transaction) => {
    // Load the temporary transaction into the form for editing
    setFormData({
      type: tx.type,
      customerId: tx.customerId,
      amount: tx.amount.toString(),
      weight: tx.weight?.toString() || "",
      quantity: tx.quantity?.toString() || "",
      unitPrice: tx.unitPrice?.toString() || "",
      productTypeId: tx.productTypeId || "",
      description: tx.description,
      date: tx.date.includes("T") ? tx.date.slice(0, 16) : tx.date + "T00:00",
      currencyId: tx.currencyId || data.settings?.baseCurrencyId || "",
      weightUnit: tx.weightUnit || data.settings?.baseWeightUnit || "ton",
      accountId: tx.accountId || "default-cash-safe",
    })

    // Remove this transaction from the temporary list
    setTemporaryTransactions(temporaryTransactions.filter(t => t.id !== tx.id))

    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleBatchSubmit = () => {
    if (temporaryTransactions.length === 0) return

    const mainDocId = crypto.randomUUID()
    const mainDocNumber = generateDocumentNumber(data.transactions)
    const customerName = getCustomerName(temporaryTransactions[0].customerId)
    const mainType = temporaryTransactions[0].type

    const mainDocument: Transaction = {
      id: mainDocId,
      documentNumber: mainDocNumber,
      type: mainType,
      customerId: temporaryTransactions[0].customerId,
      amount: 0,
      description: `${t("temporaryDocuments")} - ${customerName} (${temporaryTransactions.length} ${t("items")})`,
      date: formData.date,
      createdAt: getLocalDateTime(),
      currencyId: temporaryTransactions[0].currencyId,
      weightUnit: temporaryTransactions[0].weightUnit,
      accountId: "default-cash-safe",
      isMainDocument: true,
    }

    const subDocuments = temporaryTransactions.map((temp, index) => {
      let finalAmount = temp.amount;
      let finalWeight = temp.weight;
      let finalQuantity = temp.quantity;

      if (temp.type === "payable") {
        finalAmount = -Math.abs(finalAmount);
        if (finalWeight) finalWeight = -Math.abs(finalWeight);
        if (finalQuantity) finalQuantity = -Math.abs(finalQuantity);
      } else if (temp.type === "receivable") {
        finalAmount = Math.abs(finalAmount);
        if (finalWeight) finalWeight = Math.abs(finalWeight);
        if (finalQuantity) finalQuantity = Math.abs(finalQuantity);
      }

      return {
        ...temp,
        id: crypto.randomUUID(), // New ID for permanent storage
        documentNumber: `${mainDocNumber}-${index + 1}`,
        parentDocumentId: mainDocId,
        isMainDocument: false,
        date: formData.date, // Sync date with main doc
        createdAt: getLocalDateTime(),
        amount: finalAmount,
        weight: finalWeight,
        quantity: finalQuantity,
      }
    })

    onDataChange({
      ...data,
      transactions: [...data.transactions, mainDocument, ...subDocuments],
    })
    setTemporaryTransactions([])

    setFormData({
      ...formData,
      amount: "",
      weight: "",
      quantity: "",
      unitPrice: "",
      productTypeId: "",
      description: "",
    })
    setValidationError("")
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
    // Exception: receivable/payable don't need product type if they are amount-only
    if (isFlourTransaction && !formData.productTypeId) {
      // For receivable/payable, if we have an amount, we don't strictly need a product type
      // unless the user has started entering weight/quantity
      const isReceivablePayable = formData.type === "receivable" || formData.type === "payable";
      const hasAmount = formData.amount && formData.amount.trim() !== "";
      const hasProductDetails = (formData.weight && formData.weight.trim() !== "") || (formData.quantity && formData.quantity.trim() !== "");

      if (isReceivablePayable && hasAmount && !hasProductDetails) {
        // Valid case: Amount only, no product details
      } else {
        setValidationError(t("productTypeRequired"))
        return
      }
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

    // Validation for receivable and payable
    if (formData.type === "receivable" || formData.type === "payable") {
      const hasProduct = formData.productTypeId && (
        (formData.weight && formData.weight.trim() !== "") ||
        (formData.quantity && formData.quantity.trim() !== "")
      )
      const hasAmount = formData.amount && formData.amount.trim() !== ""

      if (!hasProduct && !hasAmount) {
        setValidationError(t("productOrAmountRequired"))
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
      formData.type === "income" ||
      formData.type === "receivable" ||
      formData.type === "payable"
    ) {
      if (formData.amount) {
        totalAmount = Number.parseFloat(formData.amount)
      } else if ((formData.type === "receivable" || formData.type === "payable") && formData.unitPrice) {
        // Auto-calculate amount if missing but unit price exists (for mixed entries)
        if (formData.weight) {
          totalAmount = Number.parseFloat(formData.weight) * Number.parseFloat(formData.unitPrice)
        } else if (formData.quantity) {
          totalAmount = Number.parseInt(formData.quantity) * Number.parseFloat(formData.unitPrice)
        }
      }
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
                description: `${formData.type === "cash_in" ? (lang === "fa" ? "واریز به" : "Deposit to") : (lang === "fa" ? "برداشت از" : "Withdrawal from")} ${accountName} ${formData.type === "cash_in" ? (lang === "fa" ? "از" : "from") : (lang === "fa" ? "به" : "to")} ${customerName}`,
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
              description: `${formData.type === "cash_in" ? (lang === "fa" ? "واریز به" : "Deposit to") : (lang === "fa" ? "برداشت از" : "Withdrawal from")} ${accountName} ${formData.type === "cash_in" ? (lang === "fa" ? "از" : "from") : (lang === "fa" ? "به" : "to")} ${customerName}`,
              date: formData.date, // تاریخ جدید
              currencyId: formData.currencyId, // ارز جدید
              customerId: formData.accountId, // حساب انتخابی
              accountId: formData.accountId,
            }
            : transaction,
        )
      }

      // به‌روزرسانی زیرسندهای product_in و product_out (اگر سند اصلی است)
      if (editingTransaction.isMainDocument && (formData.type === "product_in" || formData.type === "product_out")) {
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"
        const weight = formData.weight ? Number.parseFloat(formData.weight) : undefined
        const quantity = formData.quantity ? Number.parseInt(formData.quantity) : undefined

        updatedTransactions = updatedTransactions.map((t) => {
          if (t.parentDocumentId === editingTransaction.id) {
            const isSubDoc1 = t.documentNumber?.endsWith("-1")
            const isSubDoc2 = t.documentNumber?.endsWith("-2")

            if (isSubDoc1) {
              // زیرسند 1: مشتری
              return {
                ...t,
                type: formData.type,
                customerId: formData.customerId,
                weight: formData.type === "product_in" ? (weight ? -weight : undefined) : weight,
                quantity: formData.type === "product_in" ? (quantity ? -quantity : undefined) : quantity,
                productTypeId: formData.productTypeId,
                description: formData.description,
                date: formData.date,
                weightUnit: formData.weightUnit,
              }
            } else if (isSubDoc2) {
              // زیرسند 2: انبار
              return {
                ...t,
                type: formData.type,
                customerId: "default-warehouse",
                weight: formData.type === "product_in" ? weight : (weight ? -weight : undefined),
                quantity: formData.type === "product_in" ? quantity : (quantity ? -quantity : undefined),
                productTypeId: formData.productTypeId,
                description: `${formData.type === "product_in" ? (lang === "fa" ? "دریافت از" : "Received from") : (lang === "fa" ? "ارسال به" : "Sent to")} ${customerName}`,
                date: formData.date,
                weightUnit: formData.weightUnit,
              }
            }
          }
          return t
        })
      }

      onDataChange({
        ...data,
        transactions: updatedTransactions,
      })
      setEditingTransaction(null)
    } else {
      // Check for temporary transactions first - logic moved to handleBatchSubmit
      // but kept here as fallback if form is filled and submitted
      if (temporaryTransactions.length > 0) {
        handleBatchSubmit()
        return
      }

      const totalAmount = Number.parseFloat(formData.amount)

      // Determine signs based on transaction type
      let finalAmount = totalAmount;
      let finalWeight = formData.weight ? Number.parseFloat(formData.weight) : undefined;
      let finalQuantity = formData.quantity ? Number.parseInt(formData.quantity) : undefined;

      if (formData.type === "payable") {
        finalAmount = -Math.abs(finalAmount);
        if (finalWeight) finalWeight = -Math.abs(finalWeight);
        if (finalQuantity) finalQuantity = -Math.abs(finalQuantity);
      } else if (formData.type === "receivable") {
        finalAmount = Math.abs(finalAmount);
        if (finalWeight) finalWeight = Math.abs(finalWeight);
        if (finalQuantity) finalQuantity = Math.abs(finalQuantity);
      }

      const newTransaction: Transaction = {
        id: crypto.randomUUID(),
        documentNumber: generateDocumentNumber(data.transactions),
        type: formData.type,
        customerId: formData.customerId,
        amount: finalAmount,
        weight: finalWeight,
        quantity: finalQuantity,
        unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
        productTypeId: formData.productTypeId || undefined,
        description: formData.description,
        date: formData.date,
        createdAt: getLocalDateTime(),
        currencyId: formData.currencyId,
        weightUnit: formData.weightUnit,
        accountId: (formData.type === "receivable" || formData.type === "payable") ? undefined : formData.accountId,
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
          description: `${formData.type === "cash_in" ? (lang === "fa" ? "واریز به" : "Deposit to") : (lang === "fa" ? "برداشت از" : "Withdrawal from")} ${accountName} ${formData.type === "cash_in" ? (lang === "fa" ? "از" : "from") : (lang === "fa" ? "به" : "to")} ${customerName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          currencyId: formData.currencyId,
          accountId: targetAccountId,
          parentDocumentId: mainDocId,
        }

        newTransactions = [mainDocument, subDocument1, subDocument2]
      } else if (formData.type === "product_in" || formData.type === "product_out") {
        // سیستم سند اصلی + 2 زیرسند برای محصولات
        const customerName = data.customers.find(c => c.id === formData.customerId)?.name || "Unknown"

        const mainDocId = crypto.randomUUID()
        const subDoc1Id = crypto.randomUUID()
        const subDoc2Id = crypto.randomUUID()

        const weight = formData.weight ? Number.parseFloat(formData.weight) : undefined
        const quantity = formData.quantity ? Number.parseInt(formData.quantity) : undefined

        // سند اصلی (خلاصه)
        const mainDocument: Transaction = {
          id: mainDocId,
          documentNumber: generateDocumentNumber(data.transactions),
          type: formData.type,
          customerId: formData.customerId,
          amount: 0,
          weight: formData.type === "product_in" ? (weight ? -weight : undefined) : weight,
          quantity: formData.type === "product_in" ? (quantity ? -quantity : undefined) : quantity,
          productTypeId: formData.productTypeId,
          description: `${formData.type === "product_in" ? (lang === "fa" ? "دریافت از" : "Received from") : (lang === "fa" ? "ارسال به" : "Sent to")} ${customerName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          weightUnit: formData.weightUnit,
          isMainDocument: true,
        }

        // زیرسند 1: سمت مشتری
        const subDocument1: Transaction = {
          id: subDoc1Id,
          documentNumber: `${mainDocument.documentNumber}-1`,
          type: formData.type,
          customerId: formData.customerId,
          amount: 0,
          weight: formData.type === "product_in" ? (weight ? -weight : undefined) : weight,
          quantity: formData.type === "product_in" ? (quantity ? -quantity : undefined) : quantity,
          productTypeId: formData.productTypeId,
          description: formData.description,
          date: formData.date,
          createdAt: getLocalDateTime(),
          weightUnit: formData.weightUnit,
          parentDocumentId: mainDocId,
        }

        // زیرسند 2: سمت انبار
        const subDocument2: Transaction = {
          id: subDoc2Id,
          documentNumber: `${mainDocument.documentNumber}-2`,
          type: formData.type,
          customerId: "default-warehouse",
          amount: 0,
          weight: formData.type === "product_in" ? weight : (weight ? -weight : undefined),
          quantity: formData.type === "product_in" ? quantity : (quantity ? -quantity : undefined),
          productTypeId: formData.productTypeId,
          description: `${formData.type === "product_in" ? (lang === "fa" ? "دریافت از" : "Received from") : (lang === "fa" ? "ارسال به" : "Sent to")} ${customerName}`,
          date: formData.date,
          createdAt: getLocalDateTime(),
          weightUnit: formData.weightUnit,
          parentDocumentId: mainDocId,
        }

        newTransactions = [mainDocument, subDocument1, subDocument2]
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

  const transactionTypes = [
    { value: "product_in", label: t("productIn"), icon: Package, color: "text-red-600" },
    { value: "product_out", label: t("productOut"), icon: Package, color: "text-green-600" },
    { value: "product_purchase", label: t("productPurchase"), icon: Package, color: "text-blue-600" },
    { value: "product_sale", label: t("productSale"), icon: Package, color: "text-purple-600" },
    { value: "cash_in", label: t("cashIn"), icon: DollarSign, color: "text-green-600" },
    { value: "cash_out", label: t("cashOut"), icon: DollarSign, color: "text-red-600" },
    { value: "expense", label: t("expense"), icon: DollarSign, color: "text-orange-600" },
    { value: "income", label: t("income"), icon: DollarSign, color: "text-emerald-600" },
    { value: "receivable", label: t("receivable"), icon: DollarSign, color: "text-green-600" },
    { value: "payable", label: t("payable"), icon: DollarSign, color: "text-red-600" },
  ]

  const currentType = transactionTypes.find((t) => t.value === formData.type)
  const isFlourTransaction =
    formData.type === "product_in" ||
    formData.type === "product_out" ||
    formData.type === "product_purchase" ||
    formData.type === "product_sale" ||
    formData.type === "receivable" ||
    formData.type === "payable"

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

        {/* Customer Change Confirmation Dialog */}
        <Dialog open={customerChangeDialog.show} onOpenChange={(open) => !open && setCustomerChangeDialog({ show: false, newCustomerId: "", previousCustomerName: "" })}>
          <DialogContent className={lang === "fa" ? "text-right" : "text-left"}>
            <DialogHeader>
              <DialogTitle>{t("tempDocsExistWarningTitle")}</DialogTitle>
              <DialogDescription>
                {t("tempDocsExistWarningMessage").replace("{customerName}", customerChangeDialog.previousCustomerName)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setCustomerChangeDialog({ show: false, newCustomerId: "", previousCustomerName: "" })
                }}
              >
                {t("returnToTempDocs").replace("{customerName}", customerChangeDialog.previousCustomerName)}
              </Button>
              <Button
                onClick={() => {
                  // Change customer and keep the temporary documents as-is
                  setFormData({ ...formData, customerId: customerChangeDialog.newCustomerId })
                  setCustomerChangeDialog({ show: false, newCustomerId: "", previousCustomerName: "" })
                }}
              >
                {t("changeCustomerKeepTempDocs").replace("{customerName}", customerChangeDialog.previousCustomerName)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
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

        <form onSubmit={handleSubmit}>
          {/* Customer, Date & Document Number - Above Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <div>
              <Label htmlFor="customer" className="text-xs mb-0.5 block">{t("customer")}</Label>
              <SearchableSelect
                value={formData.customerId}
                onValueChange={(value) => {
                  // Check if trying to change customer while having temporary documents for another customer
                  if (temporaryTransactions.length > 0 && temporaryTransactions[0].customerId !== value) {
                    const existingCustomerName = getCustomerName(temporaryTransactions[0].customerId)
                    // Show dialog for confirmation
                    setCustomerChangeDialog({
                      show: true,
                      newCustomerId: value,
                      previousCustomerName: existingCustomerName
                    })
                    return
                  }
                  setFormData({ ...formData, customerId: value })
                }}
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
                placeholder={t("selectCustomer")}
                searchPlaceholder={lang === "fa" ? "جستجو..." : "Search..."}
                emptyText={lang === "fa" ? "نتیجه‌ای یافت نشد" : "No results found"}
                className={lang === "fa" ? "text-right h-9 text-sm" : "text-left h-9 text-sm"}
              />
            </div>

            <div>
              <Label htmlFor="date" className="text-xs mb-0.5 block">{t("dateTime")}</Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="text-right h-9 text-sm"
                required
              />
            </div>

            <div>
              <Label htmlFor="documentNumber" className="text-xs mb-0.5 block">{lang === "fa" ? "شماره سند" : "Document Number"}</Label>
              <Input
                id="documentNumber"
                type="text"
                value={nextDocumentNumber}
                readOnly
                className="text-center h-9 text-sm bg-muted font-mono font-semibold"
                title={lang === "fa" ? "شماره سند به صورت خودکار تولید می‌شود" : "Document number is auto-generated"}
              />
            </div>
          </div>

          <Tabs
            value={formData.type}
            onValueChange={(value) => {
              // Keep the customer and date when changing tabs
              setFormData({ ...formData, type: value as TransactionType })
            }}
            className="mb-2"
          >
            <TabsList className="flex flex-wrap w-full h-auto gap-1 justify-center bg-muted/50 p-1">
              {transactionTypes.map((type) => {
                const Icon = type.icon
                return (
                  <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-1 px-2 py-1">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="text-xs whitespace-nowrap">{type.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Amount - Only for cash_in and cash_out (expense and income use the field below with currency display) */}
              {(formData.type === "cash_in" || formData.type === "cash_out") && (
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
              {(formData.type === "cash_in" || formData.type === "cash_out" || formData.type === "expense" || formData.type === "income") && (
                <div className="md:col-span-2">
                  <Label htmlFor="accountId" className="text-xs mb-1 block">
                    {formData.type === "cash_in" || formData.type === "income"
                      ? (lang === "fa" ? "واریز به" : "Deposit To")
                      : (lang === "fa" ? "برداشت از" : "Withdraw From")}
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
                    <SearchableSelect
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
                      options={productTypes.map((productType) => {
                        const code = productType.productCode ? `${productType.productCode} - ` : ""
                        const label = `${code}${productType.name}`
                        return {
                          value: productType.id,
                          label: label,
                          keywords: [productType.productCode || "", productType.name, label]
                        }
                      })}
                      placeholder={t("selectProductType")}
                      searchPlaceholder={lang === "fa" ? "جستجو..." : "Search..."}
                      emptyText={lang === "fa" ? "نتیجه‌ای یافت نشد" : "No results found"}
                      className={lang === "fa" ? "text-right h-9 text-sm" : "text-left h-9 text-sm"}
                    />
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
                          type="text"
                          value={formData.unitPrice ? formatNumberWithCommas(formData.unitPrice) : ""}
                          onChange={(e) => {
                            const cleaned = parseFormattedNumber(e.target.value)
                            setFormData(prev => {
                              const newData = { ...prev, unitPrice: cleaned }

                              // Auto-calculate amount if weight/quantity available
                              if (cleaned && (prev.weight || prev.quantity)) {
                                const priceNum = Number.parseFloat(cleaned)
                                if (!isNaN(priceNum)) {
                                  if (prev.weight) {
                                    const weightNum = Number.parseFloat(prev.weight)
                                    if (!isNaN(weightNum)) {
                                      newData.amount = (weightNum * priceNum).toString()
                                    }
                                  } else if (prev.quantity) {
                                    const qtyNum = Number.parseInt(prev.quantity)
                                    if (!isNaN(qtyNum)) {
                                      newData.amount = (qtyNum * priceNum).toString()
                                    }
                                  }
                                }
                              }
                              return newData
                            })
                          }}
                          className="text-right h-9 text-sm pr-12"
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
                formData.type === "income" ||
                formData.type === "receivable" ||
                formData.type === "payable") && (
                  <div className={isFlourTransaction ? "md:col-span-2" : "md:col-span-3"}>
                    <Label htmlFor="amount" className="text-xs mb-1 block">
                      {formData.type === "product_purchase" || formData.type === "product_sale"
                        ? `${t("totalAmount")} (${data.currencies?.find(c => c.id === formData.currencyId)?.name || "Currency"})`
                        : `${t("amount")} (${data.currencies?.find(c => c.id === formData.currencyId)?.name || "Currency"})`}
                    </Label>
                    <Input
                      id="amount"
                      type="text"
                      value={formData.amount ? formatNumberWithCommas(formData.amount) : ""}
                      onChange={(e) => setFormData({ ...formData, amount: parseFormattedNumber(e.target.value) })}
                      className="text-right h-9 text-sm"
                      required={
                        formData.type !== "receivable" && formData.type !== "payable"
                      }
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
                  className={`h-16 text-sm resize-none ${lang === "fa" ? "text-right" : "text-left"}`}
                  dir={lang === "fa" ? "rtl" : "ltr"}
                />
              </div>
            </div>

            {validationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{validationError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 text-sm"
                onClick={handleTemporarySubmit}
                disabled={data.customers.length === 0 || (isFlourTransaction && productTypes.length === 0)}
              >
                {t("temporarySubmit")}
              </Button>
              {temporaryTransactions.length > 0 && (
                <Button
                  type="button"
                  className="flex-1 text-sm"
                  onClick={handleBatchSubmit}
                  disabled={data.customers.length === 0 || (isFlourTransaction && productTypes.length === 0)}
                >
                  {t("finalizeSubmission")}
                </Button>
              )}
            </div>

            {/* Temporary Documents Table */}
            {temporaryTransactions.length > 0 && (
              <div className="mt-6 border rounded-md overflow-hidden">
                <div className="bg-muted px-4 py-2 font-semibold text-sm flex justify-between items-center">
                  <span>{t("temporaryDocuments")}</span>
                  <span className="text-xs font-normal text-muted-foreground">{t("temporaryDocDescription")}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("documentNumber")}</th>
                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("type")}</th>
                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("customer")}</th>
                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("productType")}</th>
                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("price")}</th>

                        {/* Goods Section Header */}
                        <th className="text-center text-xs p-1 border-r border-b bg-blue-50/50" colSpan={4}>
                          <span className="font-bold text-blue-700">{t("goodsSection")}</span>
                        </th>

                        {/* Money Section Header */}
                        <th className="text-center text-xs p-1 border-r border-b bg-green-50/50" colSpan={4}>
                          <span className="font-bold text-green-700">{t("moneySection")}</span>
                        </th>

                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("date")}</th>
                        <th className="text-center text-xs p-1 border-r" rowSpan={2}>{t("description")}</th>
                        <th className="text-center text-xs p-1 w-[80px] sticky right-0 bg-muted/50 z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]" rowSpan={2}>{t("operations")}</th>
                      </tr>
                      <tr className="border-b bg-muted/50">
                        {/* Goods Sub-headers */}
                        <th className="text-center text-[10px] p-1 border-r bg-blue-50/30">{t("colIn")}</th>
                        <th className="text-center text-[10px] p-1 border-r bg-blue-50/30">{t("colOut")}</th>
                        <th className="text-center text-[10px] p-1 border-r bg-blue-50/30">{t("colReceivable")}</th>
                        <th className="text-center text-[10px] p-1 border-r bg-blue-50/30">{t("colPayable")}</th>

                        {/* Money Sub-headers */}
                        <th className="text-center text-[10px] p-1 border-r bg-green-50/30">{t("colIn")}</th>
                        <th className="text-center text-[10px] p-1 border-r bg-green-50/30">{t("colOut")}</th>
                        <th className="text-center text-[10px] p-1 border-r bg-green-50/30">{t("colReceivable")}</th>
                        <th className="text-center text-[10px] p-1 border-r bg-green-50/30">{t("colPayable")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {temporaryTransactions.map((tx) => {
                        const typeInfo = transactionTypes.find(t => t.value === tx.type)
                        const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(num)

                        // Get color class based on transaction type (not just amount sign)
                        const getAmountClass = () => {
                          switch (tx.type) {
                            case "product_in":    // ورود کالا - ما بدهکار = قرمز
                            case "cash_in":       // دریافت وجه - بدهی مشتری کم میشه = قرمز
                            case "income":        // درآمد/دریافتی = قرمز
                            case "payable":        // بدهی = قرمز
                              return "text-red-600"
                            case "product_out":   // خروج کالا - مشتری بدهکار = سبز
                            case "cash_out":      // پرداخت وجه - بدهی مشتری زیاد میشه = سبز
                            case "expense":       // هزینه/پرداختی = سبز
                            case "receivable":         // طلب = سبز
                              return "text-green-600"
                            case "product_purchase": // خرید - بستگی به مقدار دارد
                            case "product_sale":     // فروش - بستگی به مقدار دارد
                              return tx.amount > 0 ? "text-green-600" : "text-red-600"
                            default:
                              return ""
                          }
                        }

                        // Get Badge color based on transaction type
                        const getBadgeColor = (txType: string) => {
                          switch (txType) {
                            case "product_in": return "bg-red-100 text-red-800"
                            case "product_out": return "bg-green-100 text-green-800"
                            case "product_purchase": return "bg-blue-100 text-blue-800"
                            case "product_sale": return "bg-purple-100 text-purple-800"
                            case "cash_in": return "bg-green-100 text-green-800"
                            case "cash_out": return "bg-red-100 text-red-800"
                            case "expense": return "bg-green-100 text-green-800"
                            case "income": return "bg-red-100 text-red-800"
                            case "receivable": return "bg-green-100 text-green-800"
                            case "payable": return "bg-red-100 text-red-800"
                            default: return "bg-gray-100 text-gray-800"
                          }
                        }

                        return (
                          <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="text-center font-mono p-2 text-[10px]">{tx.documentNumber}</td>
                            <td className="text-center p-2">
                              <Badge className={`${getBadgeColor(tx.type)} text-[9px] px-1 py-0`}>
                                {typeInfo?.label}
                              </Badge>
                            </td>
                            <td className="text-center p-2 max-w-[100px] text-xs truncate">
                              {getCustomerName(tx.customerId)}
                            </td>
                            <td className="text-center p-2 max-w-[80px] text-xs truncate">
                              {tx.productTypeId ? productTypes.find(p => p.id === tx.productTypeId)?.name || "-" : "-"}
                            </td>
                            {/* Price Column */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "product_purchase" || tx.type === "product_sale") && tx.unitPrice ? (
                                <>
                                  {formatNumber(tx.unitPrice)}
                                  <span className="text-[10px] text-gray-500 ml-1">
                                    {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                  </span>
                                </>
                              ) : "-"}
                            </td>
                            {/* Goods Receipt (Product In) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "product_in") && (tx.weight || tx.quantity) ? (
                                <span className="font-medium text-red-600">
                                  {tx.quantity ? (
                                    <>
                                      {formatNumber(Math.abs(tx.quantity))}
                                      <span className="text-[10px] text-gray-500 ml-1">(Count)</span>
                                    </>
                                  ) : ""}
                                  {tx.quantity && tx.weight ? " / " : ""}
                                  {tx.weight ? (
                                    <>
                                      {formatNumber(Math.abs(tx.weight))}
                                      <span className="text-[10px] text-gray-500 ml-1">({tx.weightUnit || "ton"})</span>
                                    </>
                                  ) : ""}
                                </span>
                              ) : "-"}
                            </td>

                            {/* Goods Issue (Product Out) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "product_out") && (tx.weight || tx.quantity) ? (
                                <span className="font-medium text-green-600">
                                  {tx.quantity ? (
                                    <>
                                      {formatNumber(Math.abs(tx.quantity))}
                                      <span className="text-[10px] text-gray-500 ml-1">(Count)</span>
                                    </>
                                  ) : ""}
                                  {tx.quantity && tx.weight ? " / " : ""}
                                  {tx.weight ? (
                                    <>
                                      {formatNumber(Math.abs(tx.weight))}
                                      <span className="text-[10px] text-gray-500 ml-1">({tx.weightUnit || "ton"})</span>
                                    </>
                                  ) : ""}
                                </span>
                              ) : "-"}
                            </td>

                            {/* Goods Credit (Payable/Payable) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(() => {
                                if ((tx.type === "product_purchase" || tx.type === "payable") && (tx.quantity || tx.weight)) {
                                  const val = tx.quantity || tx.weight || 0;
                                  return (
                                    <span className="font-medium text-red-600">
                                      {formatNumber(Math.abs(val))}
                                      <span className="text-[10px] text-gray-500 ml-1">
                                        ({tx.weight ? (tx.weightUnit || "ton") : "Count"})
                                      </span>
                                    </span>
                                  )
                                }
                                return "-"
                              })()}
                            </td>

                            {/* Goods Debit (Receivable/Receivable) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(() => {
                                if ((tx.type === "product_sale" || tx.type === "receivable") && (tx.quantity || tx.weight)) {
                                  const val = tx.quantity || tx.weight || 0;
                                  return (
                                    <span className="font-medium text-green-600">
                                      {formatNumber(Math.abs(val))}
                                      <span className="text-[10px] text-gray-500 ml-1">
                                        ({tx.weight ? (tx.weightUnit || "ton") : "Count"})
                                      </span>
                                    </span>
                                  )
                                }
                                return "-"
                              })()}
                            </td>

                            {/* Money Receipt (Cash In) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "cash_in" || tx.type === "income") && tx.amount ? (
                                <span className="font-bold text-red-600">
                                  {formatNumber(Math.abs(tx.amount))}
                                  <span className="text-[10px] text-gray-500 ml-1">
                                    {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                  </span>
                                </span>
                              ) : "-"}
                            </td>

                            {/* Money Payment (Cash Out) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "cash_out" || tx.type === "expense") && tx.amount ? (
                                <span className="font-bold text-green-600">
                                  {formatNumber(Math.abs(tx.amount))}
                                  <span className="text-[10px] text-gray-500 ml-1">
                                    {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                  </span>
                                </span>
                              ) : "-"}
                            </td>

                            {/* Money Credit (Payable/Payable) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "payable") && tx.amount ? (
                                <span className="font-bold text-red-600">
                                  {formatNumber(Math.abs(tx.amount))}
                                  <span className="text-[10px] text-gray-500 ml-1">
                                    {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                  </span>
                                </span>
                              ) : "-"}
                            </td>

                            {/* Money Debit (Receivable/Receivable) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(tx.type === "receivable") && tx.amount ? (
                                <span className="font-bold text-green-600">
                                  {formatNumber(Math.abs(tx.amount))}
                                  <span className="text-[10px] text-gray-500 ml-1">
                                    {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                  </span>
                                </span>
                              ) : "-"}
                            </td>

                            {/* Money Receivable (Receivable) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(() => {
                                // Product Sale -> Green
                                if (tx.type === "product_sale" && tx.amount) {
                                  return (
                                    <span className="font-bold text-green-600">
                                      {formatNumber(Math.abs(tx.amount))}
                                      <span className="text-[10px] text-gray-500 ml-1">
                                        {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                      </span>
                                    </span>
                                  )
                                }
                                return "-"
                              })()}
                            </td>

                            {/* Money Bedehi (Payable) */}
                            <td className="text-center p-2 whitespace-nowrap text-xs">
                              {(() => {
                                // Product Purchase -> Red
                                if (tx.type === "product_purchase" && tx.amount) {
                                  return (
                                    <span className="font-bold text-red-600">
                                      {formatNumber(Math.abs(tx.amount))}
                                      <span className="text-[10px] text-gray-500 ml-1">
                                        {data.currencies?.find(c => c.id === tx.currencyId)?.symbol || "$"}
                                      </span>
                                    </span>
                                  )
                                }
                                return "-"
                              })()}
                            </td>
                            <td className="text-center p-2 text-[10px] sticky right-0 bg-background z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                              {lang === "fa" ? (
                                <div>
                                  <div className="font-medium">
                                    {formatDate(tx.date || tx.createdAt || "").persian}
                                  </div>
                                  <div className="text-muted-foreground text-[9px]">
                                    {formatDate(tx.date || tx.createdAt || "").gregorian}
                                  </div>
                                </div>
                              ) : (
                                <div className="font-medium">
                                  {formatDate(tx.date || tx.createdAt || "").gregorian}
                                </div>
                              )}
                            </td>
                            <td className="text-center p-2 max-w-[120px] truncate text-xs" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="text-center p-2">
                              <div className="flex gap-0.5 justify-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleEditTemporary(tx)}
                                >
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleDeleteTemporary(tx.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </form>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">{t("lastRegisteredDocuments")}</h3>
        <TransactionList data={data} onDataChange={onDataChange} onEdit={handleEdit} />
      </div>
    </div >
  )
}
