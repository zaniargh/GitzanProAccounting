import type React from "react"
import type { Metadata } from "next"
import { Vazirmatn } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"

// ✅ اضافه شده: Provider زبان
import { LanguageProvider } from "@/components/language-provider"
import { ErrorBoundary } from "@/components/error-boundary"

const vazirmatn = Vazirmatn({
    subsets: ["arabic"],
    display: "swap",
    variable: "--font-vazirmatn",
})

export const metadata: Metadata = {
    title: "سیستم حسابداری آرد",
    description: "سیستم حسابداری خرید و فروش آرد",
    generator: "v0.app",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="fa" dir="rtl">
            <body className={`font-sans ${vazirmatn.variable} antialiased`}>
                {/* ✅ اینجا Provider اضافه شده تا همه صفحات به ترجمه دسترسی داشته باشن */}
                <ErrorBoundary>
                    <LanguageProvider>
                        <Suspense fallback={null}>{children}</Suspense>
                    </LanguageProvider>
                </ErrorBoundary>
                {/* Analytics component intentionally removed */}
            </body>
        </html>
    )
}
