"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Search, ChevronUp, ChevronDown, Printer, Shield } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { Customer, AppData, ProductType } from "@/types"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import { useLang } from "@/components/language-provider"

interface CustomerListProps {
  data: AppData
  onDataChange: (data: AppData) => void
}

type SortField = "name" | "phone" | "group" | "cashDebts" | "productDebts"
type SortDirection = "asc" | "desc"

export function CustomerList({ data, onDataChange }: CustomerListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({ name: "", phone: "", groupId: "", customerCode: "" })
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [customerCodeError, setCustomerCodeError] = useState("")
  const [showWarehouse, setShowWarehouse] = useState(true)
  const [showCashSafe, setShowCashSafe] = useState(true)
  const [productTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])
  const { t, lang } = useLang()
  const [weightDisplayUnit, setWeightDisplayUnit] = useState<"ton" | "kg" | "g" | "mg" | "lb">("ton")

  // تابع کمکی برای نمایش نام‌های ترجمه‌شده برای حساب‌های پیش‌فرض
  const getDisplayName = (customer: Customer) => {
    if (customer.id === "default-cash-safe") {
      return "Cash Box"
    } else if (customer.id === "default-warehouse") {
      return lang === "fa" ? "موجودی" : "Inventory"
    }
    return customer.name
  }

  const getGroupName = (groupId: string) => {
    const group = data.customerGroups.find((g) => g.id === groupId)
    if (!group) return "-"

    // ترجمه گروه اصلی
    if (group.id === "main-group") {
      return lang === "fa" ? "اصلی" : "Main"
    }

    return group.name
  }

  const getProductTypeName = (productTypeId: string) => {
    return productTypes.find((type) => type.id === productTypeId)?.name || "نامشخص"
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </div>
    </TableHead>
  )

  const calculateCustomerDebts = (customerId: string) => {
    const cashDebts: { [currencyId: string]: number } = {}
    const productDebts: { [key: string]: number } = {}

    // محاسبه بدهی‌ها فقط از subdocuments (نه main documents)
    data.transactions.forEach((transaction) => {
      // Skip main documents - فقط subdocuments را حساب کن
      if (transaction.isMainDocument) return

      if (transaction.customerId === customerId) {
        // Debug log for bank accounts
        if (customerId.includes("bank") || customerId === "default-cash-safe") {
          console.log("Found transaction for account:", customerId, transaction)
        }

        const currencyId = transaction.currencyId || "default" // ارز پیش‌فرض اگر نبود
        const currentDebt = cashDebts[currencyId] || 0

        switch (transaction.type) {
          case "product_purchase":
            if (transaction.productTypeId) {
              let amount = transaction.quantity || transaction.weight || 0
              if (transaction.weight) {
                switch (transaction.weightUnit) {
                  case "mg": amount /= 1_000_000_000; break;
                  case "g": amount /= 1_000_000; break;
                  case "kg": amount /= 1_000; break;
                  case "lb": amount /= 2204.62; break;
                }
              }
              productDebts[transaction.productTypeId] =
                (productDebts[transaction.productTypeId] || 0) + amount
            }
            cashDebts[currencyId] = currentDebt - (transaction.amount || 0)
            break
          case "product_sale":
            if (transaction.productTypeId) {
              let amount = transaction.quantity || transaction.weight || 0
              if (transaction.weight) {
                switch (transaction.weightUnit) {
                  case "mg": amount /= 1_000_000_000; break;
                  case "g": amount /= 1_000_000; break;
                  case "kg": amount /= 1_000; break;
                  case "lb": amount /= 2204.62; break;
                }
              }
              productDebts[transaction.productTypeId] =
                (productDebts[transaction.productTypeId] || 0) - amount
            }
            cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
            break
          case "product_in":
            if (transaction.productTypeId) {
              let amount = transaction.quantity || transaction.weight || 0
              if (transaction.weight) {
                switch (transaction.weightUnit) {
                  case "mg": amount /= 1_000_000_000; break;
                  case "g": amount /= 1_000_000; break;
                  case "kg": amount /= 1_000; break;
                  case "lb": amount /= 2204.62; break;
                }
              }
              productDebts[transaction.productTypeId] =
                (productDebts[transaction.productTypeId] || 0) - amount
            }
            break
          case "product_out":
            if (transaction.productTypeId) {
              let amount = transaction.quantity || transaction.weight || 0
              if (transaction.weight) {
                switch (transaction.weightUnit) {
                  case "mg": amount /= 1_000_000_000; break;
                  case "g": amount /= 1_000_000; break;
                  case "kg": amount /= 1_000; break;
                  case "lb": amount /= 2204.62; break;
                }
              }
              productDebts[transaction.productTypeId] =
                (productDebts[transaction.productTypeId] || 0) + amount
            }
            break
          case "cash_in": // ورود وجه: بدهی نقدی مشتری کم میشود (مقدار منفی است، پس جمع می‌کنیم)
            if (customerId === transaction.customerId) {
              console.log("Calc Debt for", customerId, "Type:", transaction.type, "Amount:", transaction.amount, "Current Debt:", currentDebt)
            }
            cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
            break
          case "cash_out": // خروج وجه: بدهی نقدی مشتری زیاد میشود
            cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
            break
          case "expense": // هزینه: من بدهکار آن حساب می‌شوم
            cashDebts[currencyId] = currentDebt - (transaction.amount || 0)
            break
        }
      }
    })

    return { cashDebts, productDebts }
  }

  const customersWithDebts = data.customers.map((customer) => {
    const debts = calculateCustomerDebts(customer.id)
    return {
      ...customer,
      cashDebts: debts.cashDebts,
      productDebts: debts.productDebts,
    }
  })

  const sortedAndFilteredCustomers = useMemo(() => {
    const filtered = customersWithDebts.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || customer.phone.includes(searchTerm),
    )

    return filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "phone":
          aValue = a.phone
          bValue = b.phone
          break
        case "group":
          aValue = getGroupName(a.groupId).toLowerCase()
          bValue = getGroupName(b.groupId).toLowerCase()
          break
        case "cashDebts":
          const getDebtSum = (debts: { [key: string]: number }) => Object.values(debts).reduce((sum, val) => sum + val, 0)
          aValue = getDebtSum(a.cashDebts)
          bValue = getDebtSum(b.cashDebts)
          break
        case "productDebts":
          // برای محصول، مجموع مطلق بدهی‌ها را در نظر می‌گیریم
          aValue = Object.values(a.productDebts).reduce((sum, debt) => sum + Math.abs(debt), 0)
          bValue = Object.values(b.productDebts).reduce((sum, debt) => sum + Math.abs(debt), 0)
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue, "fa") : bValue.localeCompare(aValue, "fa")
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [customersWithDebts, searchTerm, sortField, sortDirection])

  // Apply warehouse and cash safe filters
  const finalFilteredCustomers = useMemo(() => {
    return sortedAndFilteredCustomers.filter(customer => {
      if (customer.id === "default-warehouse" && !showWarehouse) return false
      if (customer.id === "default-cash-safe" && !showCashSafe) return false
      return true
    })
  }, [sortedAndFilteredCustomers, showWarehouse, showCashSafe])

  const generateNextCustomerCode = () => {
    const existingCodes = data.customers
      .map(c => c.customerCode)
      .filter((code): code is string => !!code)
      .map(code => parseInt(code))
      .filter(num => !isNaN(num))

    if (existingCodes.length === 0) return "1"
    return (Math.max(...existingCodes) + 1).toString()
  }

  const validateCustomerCode = (code: string, excludeCustomerId?: string): boolean => {
    if (!code) {
      setCustomerCodeError(lang === "fa" ? "کد مشتری الزامی است" : "Customer code is required")
      return false
    }

    const isDuplicate = data.customers.some(
      c => c.customerCode === code && c.id !== excludeCustomerId
    )

    if (isDuplicate) {
      setCustomerCodeError(lang === "fa" ? "این کد قبلاً استفاده شده است" : "This code is already in use")
      return false
    }

    setCustomerCodeError("")
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate customer code
    if (!validateCustomerCode(formData.customerCode, editingCustomer?.id)) {
      return
    }

    if (editingCustomer) {
      // ویرایش مشتری موجود
      const updatedCustomers = data.customers.map((customer) =>
        customer.id === editingCustomer.id
          ? { ...customer, name: formData.name, phone: formData.phone, groupId: formData.groupId, customerCode: formData.customerCode }
          : customer,
      )
      onDataChange({ ...data, customers: updatedCustomers })
    } else {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        name: formData.name,
        phone: formData.phone,
        customerCode: formData.customerCode,
        groupId: formData.groupId,
        createdAt: new Date().toISOString(),
        cashDebt: 0,
        productDebts: {},
      }
      onDataChange({
        ...data,
        customers: [...data.customers, newCustomer],
      })
    }

    setFormData({ name: "", phone: "", groupId: "", customerCode: "" })
    setCustomerCodeError("")
    setEditingCustomer(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({ name: customer.name, phone: customer.phone, groupId: customer.groupId, customerCode: customer.customerCode || "" })
    setCustomerCodeError("")
    setIsDialogOpen(true)
  }

  const handleDelete = (customerId: string) => {
    const customer = data.customers.find((c) => c.id === customerId)
    if (customer?.isProtected) {
      alert("این مشتری قابل حذف نیست!")
      return
    }

    if (confirm(t("deleteConfirmation"))) {
      const updatedCustomers = data.customers.filter((customer) => customer.id !== customerId)
      // حذف تراکنش‌های مربوط به این مشتری
      const updatedTransactions = data.transactions.filter((transaction) => transaction.customerId !== customerId)
      onDataChange({
        ...data,
        customers: updatedCustomers,
        transactions: updatedTransactions,
      })
    }
  }

  const openAddDialog = () => {
    setEditingCustomer(null)
    const nextCode = generateNextCustomerCode()
    setFormData({ name: "", phone: "", groupId: data.customerGroups[0]?.id || "", customerCode: nextCode })
    setCustomerCodeError("")
    setIsDialogOpen(true)
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const currentDate = new Date()
    const persianDate = currentDate.toLocaleDateString("fa-IR")
    const gregorianDate = currentDate.toLocaleDateString("en-US")

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>لیست مشتریان</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Vazirmatn', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            direction: rtl;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          
          .header h1 {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 5px;
          }
          
          .header .date {
            font-size: 12px;
            color: #666;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          th, td {
            border: 1px solid #333;
            padding: 4px;
            text-align: center;
            font-size: 12px;
          }
          
          th {
            background-color: #f5f5f5;
            font-weight: 600;
          }
          
          .customer-name {
            text-align: right;
            font-weight: 500;
          }
          
          .debt-positive {
            color: #16a34a;
            font-weight: 500;
          }
          
          .debt-negative {
            color: #dc2626;
            font-weight: 500;
          }
          
          .product-debts {
            font-size: 12px;
            line-height: 1.2;
          }
          
          .summary {
            margin-top: 20px;
            padding: 10px;
            background-color: #f9f9f9;
            border: 1px solid #ddd;
          }
          
          .summary h3 {
            font-size: 12px;
            margin-bottom: 10px;
          }
          
          .footer {
            position: fixed;
            bottom: 10px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 8px;
            color: #666;
          }
          
          @media print {
            body { font-size: 12px; }
            .header h1 { font-size: 14px; }
            th, td { font-size: 11px; padding: 3px; }
            .product-debts { font-size: 11px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>لیست مشتریان</h1>
          <div class="date">
            تاریخ چاپ: ${persianDate} - ${gregorianDate}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 5%">ردیف</th>
              <th style="width: 25%">نام مشتری</th>
              <th style="width: 15%">تلفن</th>
              <th style="width: 15%">گروه</th>
              <th style="width: 40%">وضعیت حساب</th>
            </tr>
          </thead>
          <tbody>
            ${finalFilteredCustomers
        .map(
          (customer, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="customer-name">${customer.name}</td>
                <td>${customer.phone}</td>
                <td>${getGroupName(customer.groupId)}</td>
                <td class="debt-cell">
                  ${Object.entries(customer.cashDebts).map(([currencyId, amount]) => {
            if (amount === 0) return ""
            const currency = data.currencies?.find(c => c.id === currencyId)
            const symbol = currency?.symbol || "$"
            return `
                      <div class="${amount > 0 ? "debt-positive" : "debt-negative"}">
                        ${formatNumber(Math.abs(amount))} ${symbol} ${amount > 0 ? "لایه تی" : "هه یه تی"}
                      </div>
                    `
          }).join("")}
                  
                  ${Object.entries(customer.productDebts)
              .map(([productTypeId, amount]) => {
                if (amount === 0) return ""
                const productType = productTypes.find(pt => pt.id === productTypeId)
                const isQuantityBased = productType?.measurementType === "quantity"

                let displayAmount = Math.abs(amount)
                let unit = ""

                if (isQuantityBased) {
                  unit = lang === "fa" ? "عدد" : "Qty"
                } else {
                  if (weightDisplayUnit === "mg") {
                    displayAmount *= 1_000_000_000
                    unit = lang === "fa" ? "میلی‌گرم" : "mg"
                  } else if (weightDisplayUnit === "g") {
                    displayAmount *= 1_000_000
                    unit = lang === "fa" ? "گرم" : "g"
                  } else if (weightDisplayUnit === "kg") {
                    displayAmount *= 1_000
                    unit = lang === "fa" ? "کیلوگرم" : "Kg"
                  } else if (weightDisplayUnit === "lb") {
                    displayAmount *= 2204.62
                    unit = lang === "fa" ? "پوند" : "lb"
                  } else {
                    unit = lang === "fa" ? "تن" : "Tons"
                  }
                }

                return `
                      <div class="${amount > 0 ? "debt-positive" : "debt-negative"}">
                        ${getProductTypeName(productTypeId)}: ${formatNumber(displayAmount)} ${unit} ${amount > 0 ? "لایه تی" : "هه یه تی"}
                      </div>
                    `
              })
              .join("")}

                  ${Object.values(customer.cashDebts).every(a => a === 0) && Object.values(customer.productDebts).every(a => a === 0) ? "-" : ""}
                </td>
              </tr>
            `,
        )
        .join("")}
          </tbody>
        </table>
        
        <div class="summary">
          <h3>خلاصه کل:</h3>
          <p>تعداد کل مشتریان: ${formatNumber(sortedAndFilteredCustomers.length)} نفر</p>
          <p>تعداد گروه‌های مشتری: ${formatNumber(data.customerGroups.length)} گروه</p>
        </div>
        
        <div class="footer">
          این گزارش به صورت خودکار توسط سیستم حسابداری زانیار تولید شده است
        </div>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex-1 max-w-sm min-w-[200px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchCustomers")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">{lang === "fa" ? "واحد وزن:" : "Weight Unit:"}</Label>
            <Select value={weightDisplayUnit} onValueChange={(v) => setWeightDisplayUnit(v as any)}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ton">{lang === "fa" ? "تن" : "Ton"}</SelectItem>
                <SelectItem value="kg">{lang === "fa" ? "کیلوگرم" : "Kg"}</SelectItem>
                <SelectItem value="g">{lang === "fa" ? "گرم" : "g"}</SelectItem>
                <SelectItem value="mg">{lang === "fa" ? "میلی‌گرم" : "mg"}</SelectItem>
                <SelectItem value="lb">{lang === "fa" ? "پوند" : "lb"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Checkbox
              id="showCashSafe"
              checked={showCashSafe}
              onCheckedChange={(checked) => setShowCashSafe(checked as boolean)}
            />
            <Label htmlFor="showCashSafe" className="text-sm cursor-pointer">
              {lang === "fa" ? "نمایش صندوق" : "Show Cash Box"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="showWarehouse"
              checked={showWarehouse}
              onCheckedChange={(checked) => setShowWarehouse(checked as boolean)}
            />
            <Label htmlFor="showWarehouse" className="text-sm cursor-pointer">
              {lang === "fa" ? "نمایش موجودی" : "Show Inventory"}
            </Label>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handlePrint} disabled={finalFilteredCustomers.length === 0}>
          <Printer className="h-4 w-4 ml-2" />
          {t("printList")}
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} disabled={data.customerGroups.length === 0}>
              <Plus className="h-4 w-4 ml-2" />
              {t("newCustomer")}
            </Button>
          </DialogTrigger>
          <DialogContent dir={lang === "fa" ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? t("editCustomer") : t("newCustomer")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">{t("customerName")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">{t("phoneNumber")}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerCode">{lang === "fa" ? "کد مشتری" : "Customer Code"}</Label>
                <Input
                  id="customerCode"
                  value={formData.customerCode}
                  onChange={(e) => {
                    setFormData({ ...formData, customerCode: e.target.value })
                    setCustomerCodeError("")
                  }}
                  required
                  placeholder={lang === "fa" ? "کد یکتا برای مشتری" : "Unique code for customer"}
                />
                {customerCodeError && (
                  <p className="text-xs text-red-600 mt-1">{customerCodeError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "fa"
                    ? "کد مشتری باید یکتا باشد. سیستم به صورت خودکار شماره بعدی را پیشنهاد می‌دهد."
                    : "Customer code must be unique. System auto-suggests the next number."}
                </p>
              </div>
              <div>
                <Label htmlFor="group">{t("group")}</Label>
                <Select
                  value={formData.groupId}
                  onValueChange={(value) => setFormData({ ...formData, groupId: value })}
                  disabled={editingCustomer?.isProtected}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectGroup")} />
                  </SelectTrigger>
                  <SelectContent>
                    {data.customerGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.id === "main-group" ? (lang === "fa" ? "اصلی" : "Main") : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingCustomer?.isProtected && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("protectedAccountGroupFixed")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingCustomer ? t("edit") : t("create")}</Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>


      {
        data.customerGroups.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">{t("defineGroupFirst")}</p>
          </Card>
        )
      }

      {
        data.customerGroups.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="name">{lang === "fa" ? "کد" : "Code"}</SortableHeader>
                  <SortableHeader field="name">{t("name")}</SortableHeader>
                  <SortableHeader field="phone">{t("phone")}</SortableHeader>
                  <SortableHeader field="group">{t("group")}</SortableHeader>
                  <SortableHeader field="cashDebts">{t("balance")}</SortableHeader>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalFilteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className={customer.isProtected ? "bg-orange-50" : ""}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {customer.customerCode || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getDisplayName(customer)}
                        {customer.isProtected && (
                          <div title="مشتری محافظت شده - غیرقابل حذف">
                            <Shield className="h-4 w-4 text-orange-600" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{getGroupName(customer.groupId)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {/* Cash Debts */}
                        {Object.entries(customer.cashDebts).map(([currencyId, amount]) => {
                          if (amount === 0) return null
                          const currency = data.currencies?.find(c => c.id === currencyId)
                          const symbol = currency?.symbol || "$"

                          return (
                            <div key={currencyId} className={
                              amount > 0
                                ? "text-green-600 font-medium"
                                : amount < 0
                                  ? "text-red-600 font-medium"
                                  : "text-muted-foreground"
                            }>
                              {formatNumber(Math.abs(amount))} {symbol} {amount > 0 ? t("debtor") : amount < 0 ? t("creditor") : ""}
                            </div>
                          )
                        })}

                        {/* Product Debts */}
                        {Object.entries(customer.productDebts).map(
                          ([productTypeId, amount]) => {
                            if (amount === 0) return null
                            const productType = productTypes.find(pt => pt.id === productTypeId)
                            const isQuantityBased = productType?.measurementType === "quantity"

                            let displayAmount = Math.abs(amount)
                            let unit = ""

                            if (isQuantityBased) {
                              unit = lang === "fa" ? "عدد" : "Qty"
                            } else {
                              // Weight based (amount is in Tons)
                              if (weightDisplayUnit === "mg") {
                                displayAmount *= 1_000_000_000
                                unit = lang === "fa" ? "میلی‌گرم" : "mg"
                              } else if (weightDisplayUnit === "g") {
                                displayAmount *= 1_000_000
                                unit = lang === "fa" ? "گرم" : "g"
                              } else if (weightDisplayUnit === "kg") {
                                displayAmount *= 1_000
                                unit = lang === "fa" ? "کیلوگرم" : "Kg"
                              } else if (weightDisplayUnit === "lb") {
                                displayAmount *= 2204.62
                                unit = lang === "fa" ? "پوند" : "lb"
                              } else {
                                unit = lang === "fa" ? "تن" : "Tons"
                              }
                            }

                            return (
                              <div key={productTypeId} className={
                                amount > 0
                                  ? "text-green-600 font-medium"
                                  : amount < 0
                                    ? "text-red-600 font-medium"
                                    : "text-muted-foreground"
                              }>
                                {getProductTypeName(productTypeId)}: {formatNumber(displayAmount)} {unit} {amount > 0 ? (lang === "fa" ? "بدهکار" : "Dr") : (lang === "fa" ? "بستانکار" : "Cr")}
                              </div>
                            )
                          }
                        )}

                        {Object.values(customer.cashDebts).every(a => a === 0) && Object.values(customer.productDebts).every(a => a === 0) && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(customer)}
                          title="ویرایش نام و اطلاعات مشتری"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(customer.id)}
                          disabled={customer.isProtected}
                          title={customer.isProtected ? "این مشتری قابل حذف نیست" : "حذف مشتری"}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {finalFilteredCustomers.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchTerm ? "مشتری مورد نظر یافت نشد" : "هیچ مشتری تعریف نشده است"}
                </p>
              </div>
            )}
          </Card>
        )
      }

      {/* Bank Accounts Section */}
      {
        (data.bankAccounts && data.bankAccounts.length > 0) && (
          <Card className="mt-6">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">{t("bankAccounts")}</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("bankName")}</TableHead>
                  <TableHead>{t("accountNumber")}</TableHead>
                  <TableHead>{t("accountHolder")}</TableHead>
                  <TableHead>{t("currency")}</TableHead>
                  <TableHead>{t("initialBalance")}</TableHead>
                  <TableHead>{t("currentBalance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bankAccounts.map((account) => {
                  const currency = data.currencies.find(c => c.id === account.currencyId)

                  // محاسبه موجودی فعلی بر اساس تراکنش‌ها
                  // محاسبه موجودی فعلی بر اساس تراکنش‌ها
                  const accountDebts = calculateCustomerDebts(account.id)
                  const currencyId = account.currencyId || "default"
                  const currentBalance = (account.initialBalance || 0) + (accountDebts.cashDebts[currencyId] || 0)

                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.bankName}</TableCell>
                      <TableCell>{account.accountNumber}</TableCell>
                      <TableCell>{account.accountHolder}</TableCell>
                      <TableCell>{currency?.name} ({currency?.symbol})</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(account.initialBalance || 0).toLocaleString()} {currency?.symbol || ""}
                      </TableCell>
                      <TableCell className={currentBalance >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {currentBalance.toLocaleString()} {currency?.symbol || ""}
                        {currentBalance >= 0 ? " " + t("debtor") : " " + t("creditor")}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )
      }
    </div >
  )
}
