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
  customerCode?: string // کد مشتری - یکتا
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
  productCode?: string // کد محصول - یکتا
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
  | "income"
  | "receivable"
  | "payable"

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
  accountId?: string // حساب نقدی (Cash Box یا Bank Account) برای cash_in و cash_out
  isMainDocument?: boolean // آیا این سند اصلی است (دارای زیرسندها)
  parentDocumentId?: string // شناسه سند اصلی (فقط برای زیرسندها)
  moneyIn?: number // مجموع درآمد/دریافتی از زیرسندها (فقط برای main documents)
  moneyOut?: number // مجموع هزینه/پرداختی از زیرسندها (فقط برای main documents)
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

export interface ForeignTransactionItem {
  id: string
  amount: number
  amountDinar?: number
  transactionDetails: string
  date: string
}

export interface ForeignTransactionDocument {
  id: string
  customerName: string
  phoneNumber: string
  createdAt: string
  items: ForeignTransactionItem[]
}

export interface ExtraTransactionItem {
  id: string
  name: string
  debt: number
  deduction: number
  // remainingDebt is calculated: debt - deduction
}

export interface ExtraTransactionDocument {
  id: string
  createdAt: string
  items: ExtraTransactionItem[]
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
  foreignTransactions?: ForeignTransactionDocument[] // معاملات خارجی
  extraTransactions?: ExtraTransactionDocument[] // معاملات جدید (بدهی/کسری)
  settings?: {
    baseCurrencyId?: string
    baseWeightUnit?: string
    companyInfo?: {
      nameFa: string
      managerPhone: string
      accountant1Phone: string
      accountant2Phone: string
      email: string
      addressFa?: string
      website?: string
    }
  }
  lastUpdated?: number // Timestamp of last modification
}
export interface CompanyInfo {
  nameFa: string
  addressFa: string
  phones: string[]
  website: string
  email: string
}
