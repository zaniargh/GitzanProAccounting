import { Currency, Customer, ProductType, Transaction } from "@/types"

interface BuildPrintProps {
  transactions: Transaction[]
  currencies: Currency[]
  productTypes: ProductType[]
  customers: Customer[]
  lang: "fa" | "en"
  company?: {
    nameFa: string
    managerPhone: string
    accountant1Phone: string
    accountant2Phone: string
    email: string
    addressFa?: string
    website?: string
  }
}

export function buildTemporaryDocsHTML({ transactions, currencies, productTypes, customers, lang, company }: BuildPrintProps) {
  const t = (key: string) => {
    const dict: any = {
      title: { fa: "لیست اسناد موقت", en: "Temporary Documents List" },
      docNum: { fa: "شماره سند", en: "Doc No" },
      type: { fa: "نوع", en: "Type" },
      customer: { fa: "مشتری", en: "Customer" },
      product: { fa: "کالا", en: "Product" },
      price: { fa: "قیمت", en: "Price" },
      goodsIn: { fa: "ورود کالا", en: "Goods In" },
      goodsOut: { fa: "خروج کالا", en: "Goods Out" },
      goodsRec: { fa: "طلب کالا", en: "Goods Rec." },
      goodsPay: { fa: "بدهی کالا", en: "Goods Pay." },
      moneyIn: { fa: "دریافت وجه", en: "Money In" },
      moneyOut: { fa: "پرداخت وجه", en: "Money Out" },
      moneyRec: { fa: "طلب وجه", en: "Money Rec." },
      moneyPay: { fa: "بدهی وجه", en: "Money Pay." },
      date: { fa: "تاریخ", en: "Date" },
      desc: { fa: "توضیحات", en: "Description" },
      totalSum: { fa: "جمع کل", en: "Total Sum" },
      generatedBy: { fa: "سیستم حسابداری گیتزن پرو (Gitzan Pro Accounting System)", en: "Generated automatically by Gitzan Pro Accounting System." }
    }
    return dict[key]?.[lang] || key
  }

  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(num)

  // Get customer name from the first transaction (assuming all temps belong to same customer)
  const firstTx = transactions[0]
  const mainCustomerName = firstTx ? customers.find(c => c.id === firstTx.customerId)?.name || "-" : "-"

  const rows = transactions.map(tx => {
    const customerName = customers.find(c => c.id === tx.customerId)?.name || "-"
    const productName = tx.productTypeId ? productTypes.find(p => p.id === tx.productTypeId)?.name || "-" : "-"
    const currencySymbol = currencies.find(c => c.id === tx.currencyId)?.symbol || "$"

    // Helper to format weighted values
    const formatGoods = (val: number | undefined, unit: string | undefined, isCount: boolean) => {
      if (!val) return "-"
      return `${formatNumber(Math.abs(val))} ${isCount ? "(Count)" : `(${unit || "ton"})`}`
    }

    // Goods Logic
    let gIn = "-", gOut = "-", gRec = "-", gPay = "-"
    if (tx.quantity || tx.weight) {
      const val = tx.quantity || tx.weight || 0
      const unit = tx.weightUnit
      const isCount = !!tx.quantity
      if (tx.type === "product_in" || tx.type === "income") gIn = formatGoods(val, unit, isCount)
      else if (tx.type === "product_out" || tx.type === "expense") gOut = formatGoods(val, unit, isCount)
      else if (tx.type === "product_purchase" || tx.type === "receivable") gRec = `<span style="color:#16a34a">${formatGoods(val, unit, isCount)}</span>`
      else if (tx.type === "product_sale" || tx.type === "payable") gPay = `<span style="color:#dc2626">${formatGoods(val, unit, isCount)}</span>`

      // Expense/Income visual cue handled by separate column in UI but here just text
    }

    // Money Logic
    let mIn = "-", mOut = "-", mRec = "-", mPay = "-"
    if (tx.amount) {
      const val = `${formatNumber(Math.abs(tx.amount))} ${currencySymbol}`
      if (tx.type === "cash_in" || tx.type === "income") mIn = val
      else if (tx.type === "cash_out" || tx.type === "expense") mOut = val
      else if (tx.type === "receivable" || tx.type === "product_sale") mRec = `<span style="color:#16a34a">${val}</span>`
      else if (tx.type === "payable" || tx.type === "product_purchase") mPay = `<span style="color:#dc2626">${val}</span>`
    }

    return `
      <tr>
        <td>${tx.documentNumber}</td>
        <td>${tx.type}</td>
        <td>${customerName}</td>
        <td>${productName}</td>
        <td>${(tx.type === "product_purchase" || tx.type === "product_sale") && tx.unitPrice ? formatNumber(tx.unitPrice) + " " + currencySymbol : "-"}</td>
        
        <td>${gIn}</td>
        <td>${gOut}</td>
        <td>${gRec}</td>
        <td>${gPay}</td>
        
        <td>${mIn}</td>
        <td>${mOut}</td>
        <td>${mRec}</td>
        <td>${mPay}</td>
        
        <td>${new Date(tx.date || tx.createdAt || "").toLocaleDateString(lang === "fa" ? "fa-IR" : "en-GB")}</td>
        <td class="desc">${tx.description || "-"}</td>
      </tr>
    `
  }).join("")

  // --- Summary Calculation Logic (Replicated from transaction-form.tsx) ---
  const calculateTotalCell = (
    predicate: (tx: Transaction) => boolean,
    specialType?: string,
    isMoney: boolean = false,
    textColor?: string
  ) => {
    const totals: { [key: string]: number } = {}
    const totalsSpecial: { [key: string]: number } = {}
    let count = 0
    let countSpecial = 0

    transactions.forEach(tx => {
      if (predicate(tx)) {
        const isSpecial = specialType && tx.type === specialType

        if (isMoney) {
          const amt = Math.abs(tx.amount || 0)
          const currency = currencies.find(c => c.id === tx.currencyId)?.symbol || "$"
          if (isSpecial) totalsSpecial[currency] = (totalsSpecial[currency] || 0) + amt
          else totals[currency] = (totals[currency] || 0) + amt
        } else {
          // Goods
          const qty = Math.abs(tx.quantity || 0)
          const wgt = Math.abs(tx.weight || 0)
          if (isSpecial) {
            if (qty) countSpecial += qty
            if (wgt) {
              const unit = tx.weightUnit || "ton"
              totalsSpecial[unit] = (totalsSpecial[unit] || 0) + wgt
            }
          } else {
            if (qty) count += qty
            if (wgt) {
              const unit = tx.weightUnit || "ton"
              totals[unit] = (totals[unit] || 0) + wgt
            }
          }
        }
      }
    })

    let html = ""
    const render = (c: number, t: { [k: string]: number }, label?: string, color?: string) => {
      let parts = []
      const style = textColor ? `color:${textColor}` : (color ? `color:${color}` : "")

      if (c > 0) parts.push(`<div style="${style}">${c.toLocaleString()} (Count) ${label ? `(${label})` : ""}</div>`)
      Object.entries(t).forEach(([k, v]) => {
        if (v > 0) parts.push(`<div style="${style}">${v.toLocaleString()} ${k} ${label ? `(${label})` : ""}</div>`)
      })
      return parts.join("")
    }

    const mainHtml = render(count, totals)
    const specialHtml = render(countSpecial, totalsSpecial, lang === "fa" && specialType === "income" ? "درآمد" : lang === "fa" && specialType === "expense" ? "هزینه" : specialType, "blue")

    if (mainHtml) html += mainHtml
    if (mainHtml && specialHtml) html += `<div style="border-top:1px solid #ccc; margin:2px 0;"></div>`
    if (specialHtml) html += specialHtml

    return html || "-"
  }

  // Define column predicates
  const goodsInTotal = calculateTotalCell(tx => (tx.type === "product_in" || tx.type === "income") && !!(tx.weight || tx.quantity), "income", false)
  const goodsOutTotal = calculateTotalCell(tx => (tx.type === "product_out" || tx.type === "expense") && !!(tx.weight || tx.quantity), "expense", false)
  const goodsRecTotal = calculateTotalCell(tx => (tx.type === "product_purchase" || tx.type === "receivable") && !!(tx.weight || tx.quantity), undefined, false, "#16a34a")
  const goodsPayTotal = calculateTotalCell(tx => (tx.type === "product_sale" || tx.type === "payable") && !!(tx.weight || tx.quantity), undefined, false, "#dc2626")

  const moneyInTotal = calculateTotalCell(tx => ((tx.type === "cash_in" || tx.type === "income") && !!tx.amount), "income", true)
  const moneyOutTotal = calculateTotalCell(tx => ((tx.type === "cash_out" || tx.type === "expense") && !!tx.amount), "expense", true)
  const moneyRecTotal = calculateTotalCell(tx => ((tx.type === "receivable" || tx.type === "product_sale") && !!tx.amount), undefined, true, "#16a34a")
  const moneyPayTotal = calculateTotalCell(tx => ((tx.type === "payable" || tx.type === "product_purchase") && !!tx.amount), undefined, true, "#dc2626")


  const cInfo = {
    nameFa: company?.nameFa || (lang === "fa" ? "شرکت بازرگانی آرد زانیار" : "Zaniar Flour Trading Co."),
    addressFa: company?.addressFa || (lang === "fa" ? "عراق - سلیمانیه - ته لاری شوشه - نهومی دو - شوقه چوار" : "Iraq, Sulaymaniyah, Talari Shusha, Floor 2, Apt 4"),
    phones: [
      company?.managerPhone ? `${lang === "fa" ? "مدیر" : "Manager"}: ${company.managerPhone}` : "",
      company?.accountant1Phone ? `${lang === "fa" ? "حسابدار ۱" : "Accountant 1"}: ${company.accountant1Phone}` : "",
      company?.accountant2Phone ? `${lang === "fa" ? "حسابدار ۲" : "Accountant 2"}: ${company.accountant2Phone}` : ""
    ].filter(Boolean),
    website: company?.website || "Www.AdromCo.com",
    email: company?.email || "info@adromco.com",
    logo: "/logo.png"
  }

  return `<!doctype html>
<html dir="${lang === "fa" ? "rtl" : "ltr"}" lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${t("title")}</title>
<style>
  @page { size: A4 landscape; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, IRANSans, Segoe UI, Tahoma, sans-serif; color:#0f172a; margin:0; padding:0; font-size: 10px; }
  table { width:100%; border-collapse: collapse; page-break-inside:auto; }

  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; }
  
  th, td { border:1px solid #cbd5e1; padding:4px; text-align:center; vertical-align: top; }
  th { background:#f1f5f9; font-weight:700; white-space:nowrap; }
  
  .desc { text-align:${lang === "fa" ? "right" : "left"}; max-width: 150px; }
  
  .brand { display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom: 2px solid #334155; margin-bottom: 10px; }
  .brand .title { font-size: 16px; font-weight: 800; display:flex; flex-direction:column; gap:4px; }
  .brand .title .sub { font-size: 12px; font-weight: normal; color: #475569; }
  .brand .meta { font-size: 10px; color:#475569; }
  .brand .logo img { height: 40px; object-fit: contain; }

  .summary-cell { font-weight: bold; font-size: 9px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* Summary Row Styling */
  .summary-row td { background:#fef9c3 !important; font-weight:bold; }
</style>
</head>
<body>

  <div class="brand">
    <div class="title">
        <div>${cInfo.nameFa}</div>
        <div class="sub">${t("customer")}: ${mainCustomerName}</div>
    </div>
    <div class="meta text-end">
        <div>${cInfo.email} • ${cInfo.phones.join(" • ")}</div>
        <div style="direction:ltr">${new Date().toLocaleString()}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2">${t("docNum")}</th>
        <th rowspan="2">${t("type")}</th>
        <th rowspan="2">${t("customer")}</th>
        <th rowspan="2">${t("product")}</th>
        <th rowspan="2">${t("price")}</th>
        
        <th colspan="4" style="background:#e0f2fe">${t("goodsIn")} / ${t("goodsOut")}</th>
        <th colspan="4" style="background:#dcfce7">${t("moneyIn")} / ${t("moneyOut")}</th>
        
        <th rowspan="2">${t("date")}</th>
        <th rowspan="2">${t("desc")}</th>
      </tr>
      <tr>
        <th style="font-size:9px; background:#f0f9ff">${t("goodsIn")}</th>
        <th style="font-size:9px; background:#f0f9ff">${t("goodsOut")}</th>
        <th style="font-size:9px; background:#f0f9ff">${t("goodsRec")}</th>
        <th style="font-size:9px; background:#f0f9ff">${t("goodsPay")}</th>
        
        <th style="font-size:9px; background:#dcfce7">${t("moneyIn")}</th>
        <th style="font-size:9px; background:#dcfce7">${t("moneyOut")}</th>
        <th style="font-size:9px; background:#dcfce7">${t("moneyRec")}</th>
        <th style="font-size:9px; background:#dcfce7">${t("moneyPay")}</th>
      </tr>
    </thead>

    <tbody>
      ${rows}
      
      <!-- Summary Row (Appended to end of body to show only on last page) -->
      <tr class="summary-row" style="background:#fef9c3">
        <td colspan="5" style="text-align:right; padding:8px">${t("totalSum")}</td>
        
        <td class="summary-cell">${goodsInTotal}</td>
        <td class="summary-cell">${goodsOutTotal}</td>
        <td class="summary-cell">${goodsRecTotal}</td>
        <td class="summary-cell">${goodsPayTotal}</td>
        
        <td class="summary-cell">${moneyInTotal}</td>
        <td class="summary-cell">${moneyOutTotal}</td>
        <td class="summary-cell">${moneyRecTotal}</td>
        <td class="summary-cell">${moneyPayTotal}</td>
        
        <td colspan="2"></td>
      </tr>
    </tbody>
    
    <tfoot>
       <tr>
        <td colspan="15" style="text-align:center; padding:10px; font-size:9px; color:#64748b; border:none;">
            ${t("generatedBy")}
        </td>
      </tr>
    </tfoot>
  </table>

  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
</body>
</html>`
}
