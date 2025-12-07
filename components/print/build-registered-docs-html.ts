
import { Transaction, CompanyInfo } from "@/types"
import { formatNumber } from "@/lib/number-utils"

export interface PrintColumnConfig {
    number: boolean
    type: boolean
    customer: boolean
    productType: boolean
    price: boolean
    goodsIn: boolean
    goodsOut: boolean
    goodsReceivable: boolean
    goodsPayable: boolean
    moneyIn: boolean
    moneyOut: boolean
    moneyReceivable: boolean
    moneyPayable: boolean
    date: boolean
    description: boolean
}

export const buildRegisteredDocsHTML = (
    transactions: Transaction[],
    companyInfo: CompanyInfo,
    columns: PrintColumnConfig,
    lang: "fa" | "en" = "fa",
    getProductTypeName: (id: string) => string,
    getCustomerName: (id: string) => string
) => {
    const isRtl = lang === "fa"
    const title = lang === "fa" ? "لیست اسناد ثبت شده" : "Registered Documents List"
    const dateStr = new Date().toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US")

    // Helper to safely get nested properties or format
    const safeFormat = (val: number | undefined) => (val ? formatNumber(val) : "-")

    let headers = ""
    if (columns.number) headers += `<th>${lang === "fa" ? "شماره" : "Number"}</th>`
    if (columns.type) headers += `<th>${lang === "fa" ? "نوع" : "Type"}</th>`
    if (columns.customer) headers += `<th>${lang === "fa" ? "مشتری" : "Customer"}</th>`
    if (columns.productType) headers += `<th>${lang === "fa" ? "نوع کالا" : "Product Type"}</th>`
    if (columns.price) headers += `<th>${lang === "fa" ? "قیمت" : "Price"}</th>`

    // Goods Group
    if (columns.goodsIn || columns.goodsOut || columns.goodsReceivable || columns.goodsPayable) {
        if (columns.goodsIn) headers += `<th>${lang === "fa" ? "ورود کالا" : "Goods In"}</th>`
        if (columns.goodsOut) headers += `<th>${lang === "fa" ? "خروج کالا" : "Goods Out"}</th>`
        if (columns.goodsReceivable) headers += `<th>${lang === "fa" ? "طلب کالا" : "Goods Rec."}</th>`
        if (columns.goodsPayable) headers += `<th>${lang === "fa" ? "بدهی کالا" : "Goods Pay."}</th>`
    }

    // Money Group
    if (columns.moneyIn || columns.moneyOut || columns.moneyReceivable || columns.moneyPayable) {
        if (columns.moneyIn) headers += `<th>${lang === "fa" ? "ورود وجه" : "Money In"}</th>`
        if (columns.moneyOut) headers += `<th>${lang === "fa" ? "خروج وجه" : "Money Out"}</th>`
        if (columns.moneyReceivable) headers += `<th>${lang === "fa" ? "طلب وجه" : "Money Rec."}</th>`
        if (columns.moneyPayable) headers += `<th>${lang === "fa" ? "بدهی وجه" : "Money Pay."}</th>`
    }

    if (columns.date) headers += `<th>${lang === "fa" ? "تاریخ" : "Date"}</th>`
    if (columns.description) headers += `<th>${lang === "fa" ? "توضیحات" : "Description"}</th>`


    const rows = transactions.map((t, index) => {
        let row = "<tr>"
        if (columns.number) row += `<td>${t.documentNumber || "-"}</td>`

        if (columns.type) {
            let typeLabel = t.type
            // Simple translation check (can be improved with proper t function if passed)
            if (lang === "fa") {
                const typeMap: any = {
                    product_in: "ورود کالا", product_out: "خروج کالا",
                    product_purchase: "خرید", product_sale: "فروش",
                    goods_opening: "اول دوره کالا",
                    cash_in: "دریافت وجه", cash_out: "پرداخت وجه",
                    expense: "هزینه", income: "درآمد",
                    receivable: "طلب", payable: "بدهی",
                    goods_receipt: "رسید کالا", goods_issue: "حواله کالا"
                }
                typeLabel = typeMap[t.type] || t.type
            }
            row += `<td><span class="badge">${typeLabel}</span></td>`
        }

        if (columns.customer) row += `<td>${getCustomerName(t.customerId || "")}</td>`
        if (columns.productType) row += `<td>${t.productTypeId ? getProductTypeName(t.productTypeId) : "-"}</td>`
        if (columns.price) row += `<td>${safeFormat(t.unitPrice)}</td>`

        // Goods Logic (Mirrors TransactionList logic)
        // We assume the passed transactions are already processed or we do raw check
        // Here we do raw check similar to TransactionList table

        const isGoodsIn = t.type === "product_in" || t.type === "goods_receipt" || t.type === "goods_opening"
        const isGoodsOut = t.type === "product_out" || t.type === "goods_issue"
        const isPurchase = t.type === "product_purchase"
        const isSale = t.type === "product_sale"
        // Receivable/Payable can be goods if productTypeId exists
        const isRecGoods = t.type === "receivable" && t.productTypeId
        const isPayGoods = t.type === "payable" && t.productTypeId

        const goodsAmount = t.quantity || t.weight

        if (columns.goodsIn) row += `<td>${isGoodsIn ? safeFormat(goodsAmount) : "-"}</td>`
        if (columns.goodsOut) row += `<td>${isGoodsOut ? safeFormat(goodsAmount) : "-"}</td>`
        if (columns.goodsReceivable) row += `<td>${isPurchase || isRecGoods ? safeFormat(goodsAmount) : "-"}</td>`
        if (columns.goodsPayable) row += `<td>${isSale || isPayGoods ? safeFormat(goodsAmount) : "-"}</td>`

        // Money Logic
        const isMoneyIn = t.type === "cash_in" || t.type === "income"
        const isMoneyOut = t.type === "cash_out" || t.type === "expense"
        // Sale -> Money In? NO, Sale tracks Money Receivable/Payable in Money columns?
        // In TransactionList:
        // Money In/Out are for Cash transactions.
        // Money Receivable/Payable are for Credit transactions (Sale/Purchase).
        // Purchase -> Money Payable. Sale -> Money Receivable.
        const isMoneyRec = (t.type === "product_sale" || (t.type === "receivable" && t.amount))
        const isMoneyPay = (t.type === "product_purchase" || (t.type === "payable" && t.amount))

        // Actually TransactionList logic is slightly more complex with "hasAmount" checks, 
        // but effectively:
        // In: cash_in, income
        // Out: cash_out, expense
        // Rec: product_sale, receivable(amount)
        // Pay: product_purchase, payable(amount)

        if (columns.moneyIn) row += `<td>${isMoneyIn ? safeFormat(t.amount) : "-"}</td>`
        if (columns.moneyOut) row += `<td>${isMoneyOut ? safeFormat(t.amount) : "-"}</td>`
        if (columns.moneyReceivable) row += `<td>${isMoneyRec ? safeFormat(t.amount) : "-"}</td>`
        if (columns.moneyPayable) row += `<td>${isMoneyPay ? safeFormat(t.amount) : "-"}</td>`

        if (columns.date) {
            // Simple date format
            const d = new Date(t.date || "")
            row += `<td>${d.toLocaleDateString('fa-IR')} ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</td>`
        }
        if (columns.description) row += `<td>${t.description || "-"}</td>`

        row += "</tr>"
        return row
    }).join("")

    return `
    <!DOCTYPE html>
    <html dir="${isRtl ? "rtl" : "ltr"}" lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Vazirmatn', 'Tahoma', sans-serif; margin: 0; padding: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header p { margin: 5px 0; color: #666; }
        .badge { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
        @media print {
          .no-print { display: none; }
          body { padding: 0; }
          table { font-size: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${companyInfo?.name || title}</h1>
        <p>${dateStr}</p>
        ${companyInfo?.phone ? `<p>${companyInfo.phone}</p>` : ""}
      </div>
      
      <table>
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
    </html>
  `
}
