"use client"
import React from "react"
import type { AppData } from "@/types"

type Props = {
    data: AppData
    rows: Array<{
        documentNumber?: string
        type: string
        customerName: string
        flourTypeName?: string
        weight?: number
        unitPrice?: number
        amount?: number
        datePersian: string
        dateGregorian?: string
        description?: string
    }>
    company?: {
        nameFa?: string
        addressFa?: string
        phones?: string[]
        website?: string
        email?: string
    }
}

export default function LetterheadPrint({ data, rows, company }: Props) {
    const c = {
        nameFa: company?.nameFa ?? "Adrom Company",
        addressFa: company?.addressFa ?? "ته لاری شوشه - نهوم ۲ - شوقه ۴",
        phones: company?.phones ?? ["+964 770 155 9099", "+964 770 140 8575"],
        website: company?.website ?? "Www.AdromCo.com",
        email: company?.email ?? "info@adromco.com",
    }

    return (
        <html dir="rtl" lang="fa">
            <head>
                <meta charSet="utf-8" />
                <title>چاپ اسناد روی سربرگ</title>
                <style>{`
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Vazirmatn, IRANSans, Segoe UI, Tahoma, sans-serif; color:#0f172a; }
          .header { position: fixed; top: 0; left: 0; right:0; height: 90px; padding: 6px 8px 0; }
          .footer { position: fixed; bottom: 0; left: 0; right:0; height: 70px; padding: 6px 8px; font-size: 11px; color:#475569; border-top:1px solid #e2e8f0;}
          .content { margin-top: 100px; margin-bottom: 80px; }
          .brand { display:flex; align-items:center; justify-content:space-between; }
          .brand .title { font-size: 18px; font-weight: 800; color:#1f2937; }
          .brand .meta { font-size: 11px; color:#475569; text-align:left; direction:ltr }
          .brand .logo img {
  height: 50px;        /* می‌تونی تغییر بدی مثلاً 40px یا 60px */
  object-fit: contain;
}
          .stripe { height: 6px; background: linear-gradient(90deg,#111827 0%,#334155 50%,#64748b 100%); margin-top:6px; border-radius: 4px; }
          table { width:100%; border-collapse: collapse; page-break-inside:auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th, td { border:1px solid #e2e8f0; padding:6px 8px; font-size:12px; text-align:center; }
          th { background:#f8fafc; font-weight:700; }
          .desc { text-align:right }
          .muted { color:#64748b }
          .green { color:#16a34a; font-weight:700; }
          .red { color:#dc2626; font-weight:700; }
        `}</style>
            </head>
            <body>
                <div className="header">
                    <div className="brand">
                        <div className="title">Adrom Company</div>
                        <div className="meta">
                            <div>{c.website}</div>
                            <div>{c.email}</div>
                            <div>{c.phones.join("  •  ")}</div>
                        </div>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{c.addressFa}</div>
                    <div className="stripe" />
                </div>

                <div className="content">
                    <table>
                        <thead>
                            <tr>
                                <th>شماره سند</th>
                                <th>نوع</th>
                                <th>مشتری</th>
                                <th>نوع آرد</th>
                                <th>مقدار</th>
                                <th>قیمت واحد</th>
                                <th>مبلغ (دلار)</th>
                                <th>تاریخ</th>
                                <th>میلادی</th>
                                <th>توضیحات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.documentNumber ?? "-"}</td>
                                    <td>{r.type}</td>
                                    <td>{r.customerName}</td>
                                    <td>{r.flourTypeName ?? "-"}</td>
                                    <td>{r.weight ? `${r.weight.toLocaleString("en-US")} تن` : "-"}</td>
                                    <td>{r.unitPrice != null ? r.unitPrice.toLocaleString("en-US") : "-"}</td>
                                    <td className="green">{r.amount != null ? r.amount.toLocaleString("en-US") : "-"}</td>
                                    <td>{r.datePersian}</td>
                                    <td>{r.dateGregorian}</td>
                                    <td className="desc">{r.description ?? "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="footer">
                    <div>این سند به‌صورت خودکار از سامانه حسابداری آرد (زانیار) اردروم چاپ شده است.</div>
                </div>

                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.onload=()=>{window.print();setTimeout(()=>window.close(), 300)};`,
                    }}
                />
            </body>
        </html>
    )
}
