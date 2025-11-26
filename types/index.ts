export interface CustomerGroup {
  id: string
  name: string
  description?: string
  createdAt: string
  isProtected?: boolean // برای جلوگیری از حذف گروه‌های سیستمی
}

export interface Customer {
  id: string
  name: string
  phone: string
  groupId: string
  createdAt: string
  // بدهی‌ها و بستانکاری‌ها
  cashDebt: number // بدهی نقدی (دلار) - مثبت یعنی بدهکار، منفی یعنی بستانکار
  tomanDebt?: number // اضافه کردن بدهی تومنی - مثبت یعنی بدهکار، منفی یعنی بستانکار
  flourDebts: { [flourTypeId: string]: number } // بدهی آردی (تن) - مثبت یعنی بدهکار، منفی یعنی بستانکار
  isProtected?: boolean // برای جلوگیری از حذف مشتریان سیستمی مثل حساب‌های هزینه
}

export interface FlourType {
  id: string
  name: string
  description?: string
  createdAt: string
}

export type TransactionType =
  | "flour_in"
  | "flour_out"
  | "flour_purchase"
  | "flour_sale"
  | "cash_in"
  | "cash_out"
  | "toman_in"
  | "toman_out"
  | "expense"

export interface Transaction {
  id: string
  documentNumber: string // شماره سند مختص به هر سند
  type: TransactionType
  customerId: string
  amount: number // مبلغ کل (دلار یا تومن بسته به نوع تراکنش)
  weight?: number // In tons, for flour transactions
  quantity?: number // New field: Number of items
  unitPrice?: number // In USD per ton
  currencyId?: string // ارز معامله
  weightUnit?: string // واحد وزن (kg, ton, etc)
  flourTypeId?: string // برای اسناد مربوط به آرد
  description: string
  date: string
  createdAt: string
}

export interface Currency {
  id: string
  name: string
  symbol: string
  isBase?: boolean
}

export interface BulkTransaction {
  id: string
  date: string
  createdAt: string
  relatedTransactionIds: string[]

  // اطلاعات خرید
  purchaseCustomerId: string
  flourTypeId: string
  purchaseWeight: number
  purchaseUnitPrice: number

  // فروش‌ها
  sales: Array<{
    id: string
    customerId: string
    weight: any
    unitPrice: any
  }>

  // هزینه‌ها
  russiaFreight: number
  russiaFreightFee?: number // هزینه کرایه روسیه
  transferFee?: number // هزینه حواله
  astaraFreight: number
  astaraTomanAmount?: number
  dollarRate?: number
  customsClearance: number
  manzariyehCustoms?: number // گمرک منظریه
  miscExpenses: number
  shortage?: number

  // محاسبات
  finalProfit: number
  iraqShare: number
  iranShare: number

  // کد بار
  cargoCode?: string
}

export interface AppData {
  customerGroups: CustomerGroup[]
  customers: Customer[]
  transactions: Transaction[]
  flourTypes: FlourType[]
  currencies: Currency[] // اضافه کردن ارزها
  bulkTransactions: BulkTransaction[] // اضافه کردن bulkTransactions
  settings?: {
    baseCurrencyId?: string
    baseWeightUnit?: string
  }
}
