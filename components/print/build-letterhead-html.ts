export interface CompanyInfo {
  nameFa: string
  addressFa: string
  phones: string[]
  website: string
  email: string
}

export interface LetterheadRow {
  documentNumber?: string
  type: string
  customerName: string
  flourTypeName?: string
  weight?: string
  quantity?: number
  unitPrice?: string
  amount?: string
  datePersian: string
  description?: string
}

export function buildLetterheadHTML(rows: LetterheadRow[], company?: CompanyInfo) {
  const c = {
    nameFa: company?.nameFa ?? "Adrom Company",
    addressFa: company?.addressFa ?? "عراق - سلیمانیه - ته لاری شوشه - نهومی دو - شوقه چوار",
    phones: company?.phones ?? ["+964 770 155 9099", "+964 770 140 8575"],
    website: company?.website ?? "Www.AdromCo.com",
    email: company?.email ?? "info@adromco.com",
  }

  const bodyRows = rows.map((r) => `
    <tr>
      <td>${r.documentNumber ?? "-"}</td>
      <td>${r.type}</td>
      <td>${r.customerName}</td>
      <td>${r.flourTypeName ?? "-"}</td>
      <td>${r.weight != null ? r.weight : "-"}</td>
      <td>${r.unitPrice != null ? r.unitPrice : "-"}</td>
      <td class="green">${r.amount != null ? r.amount : "-"}</td>
      <td>${r.datePersian}</td>
      <td class="desc">${r.description ?? "-"}</td>
    </tr>
  `).join("")

  return `<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8" />
<title>چاپ اسناد روی سربرگ</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, IRANSans, Segoe UI, Tahoma, sans-serif; color:#0f172a; }
  table { width:100%; border-collapse: collapse; page-break-inside:auto; }

  /* تکرار هدر و فوتر در هر صفحه */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  tr { page-break-inside: avoid; }
  th, td { border:1px solid #e2e8f0; padding:6px 8px; font-size:12px; text-align:center; }
  th { background:#f8fafc; font-weight:700; }
  .desc { text-align:right; }
  .green { color:#16a34a; font-weight:700; }
  .red { color:#dc2626; font-weight:700; }

  /* استایل سربرگ/فوتر داخل thead/tfoot */
  .lh-head { border:none; padding:0; }
  .brand { display:flex; align-items:center; justify-content:space-between; padding:6px 8px 0; }
  .brand .title { font-size: 18px; font-weight: 800; color:#1f2937; }
  .brand .meta { font-size: 11px; color:#475569; text-align:left; direction:ltr }
  .brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand .logo img {
  height: 50px;        /* می‌تونی تغییر بدی مثلاً 40px یا 60px */
  object-fit: contain;
}
  .muted { color:#64748b; font-size:12px; padding: 0 8px 6px; text-align:right; }
  .stripe { height: 6px; background: linear-gradient(90deg,#111827 0%,#334155 50%,#64748b 100%); margin: 6px 8px 0; border-radius: 4px; }

  .lh-foot { border:none; padding:6px 8px; font-size:11px; color:#475569; text-align:right; }
</style>
</head>
<body>
  <table>
    <thead>
      <!-- ردیف سربرگ گرافیکی -->
      <tr>
        <th class="lh-head" colspan="11">
          <div class="brand">
            <div class="title">ADROM Company</div>
            <div class="meta">
              <div class="logo">
    <img src="/logo.png" alt="Logo" />
  </div>
              <div>${c.website}</div>
              <div>${c.email}</div>
              <div>${c.phones.join("  •  ")}</div>
            </div>
          </div>
          <div class="muted">${c.addressFa}</div>
          <div class="stripe"></div>
        </th>
      </tr>
      <!-- ردیف تیتر جدول -->
      <tr>
        <th>شماره سند</th><th>نوع</th><th>مشتری</th><th>نوع آرد</th>
        <th>مقدار</th><th>قیمت واحد</th><th>مبلغ (دلار)</th><th>تاریخ</th><th>توضیحات</th>
      </tr>
    </thead>

    <tbody>
      ${bodyRows}
    </tbody>

    <tfoot>
      <tr>
        <td class="lh-foot" colspan="11">این سند به‌صورت خودکار از سامانه حسابداری آرد زانیار (ادروم) چاپ شده است.</td>
      </tr>
    </tfoot>
  </table>

  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
</body>
</html>`
}
