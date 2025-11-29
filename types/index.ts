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
  productDebts: { [productTypeId: string]: number } // بدهی آردی (تن) - مثبت یعنی بدهکار، منفی یعنی بستانکار
  isProtected?: boolean // برای جلوگیری از حذف مشتریان سیستمی مثل حساب‌های هزینه
}

export interface ProductType {
  id: string
  name: string
  description?: string
  measurementType?: "quantity" | "weight"
  createdAt: string
}

export type TransactionType =
  | "product_in"
  | "product_out"
  | "product_purchase"
  | "product_sale"
  | "cash_in"
  | "cash_out"
  | "expense"
  | "income"

export interface Transaction {
  id: string
  documentNumber: string // شماره سند مختص به هر سند
  type: TransactionType
  customerId: string
  amount: number // مبلغ کل (دلار بسته به نوع تراکنش)
  weight?: number // In tons, for flour transactions
  quantity?: number // New field: Number of items
  unitPrice?: number // In USD per ton
  customerName?: string // Optional customer name for display or legacy support
  currencyId?: string // ارز معامله
  weightUnit?: string // واحد وزن (kg, ton, etc)
  productTypeId?: string // ارجاع به نوع محصول
  description: string
  date: string // تاریخ سند (از کاربر)
  createdAt: string // تاریخ ایجاد دقیق
  linkedTransactionId?: string // لینک به تراکنش مرتبط (برای Double-Entry)
  accountId?: string // حساب نقدی (Cash Safe یا Bank Account) برای cash_in و cash_out
}

export interface Currency {
  id: string
  name: string
  symbol: string
  isBase?: boolean
  createdAt: string
}

export interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountHolder: string
  initialBalance: number
  currencyId: string
  groupId?: string
  description?: string
  createdAt: string
}

export interface BulkTransaction {
  id: string
  date: string
  createdAt: string
  relatedTransactionIds: string[]

  // اطلاعات خرید
  purchaseCustomerId: string
  productTypeId: string
  purchaseWeight: number
  purchaseUnitPrice: number

  // فروش‌ها
  sales: Array<{
    id: string
    customerId: string
    weight: number
    unitPrice: number
  }>

  // هزینه‌ها
  russiaFreight: number
  russiaFreightFee?: number // هزینه کرایه روسیه
  transferFee?: number // هزینه حواله
  astaraFreight: number
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

export interface Document {
  id: string
  number: string
  date: string
  type: string
  customerId: string
  amount: number
  description: string
  createdAt: string
}

export interface AppData {
  customerGroups: CustomerGroup[]
  customers: Customer[]
  transactions: Transaction[]
  productTypes: ProductType[]
  currencies: Currency[] // اضافه کردن ارزها
  bankAccounts: BankAccount[]
  bulkTransactions: BulkTransaction[] // اضافه کردن bulkTransactions
  bulkTransactionsTehran?: any[] // اضافه کردن bulkTransactionsTehran
  documents: Document[] // اضافه کردن documents
  settings?: {
    baseCurrencyId?: string
    baseWeightUnit?: string
  }
}
