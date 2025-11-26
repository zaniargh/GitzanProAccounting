"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Users,
    FileText,
    BarChart3,
    Settings,
    Menu,
    X,
    Home,
    Package,
    Wallet,
    TrendingUp,
    Coins,
} from "lucide-react"

// ✅ اضافه‌شده: هوک زبان
import { useLang } from "@/components/language-provider"

interface SidebarProps {
    activeSection: string
    onSectionChange: (section: string) => void
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { t, lang, setLang } = useLang()

    const menuItems = [
        { id: "dashboard", labelKey: "dashboard", icon: Home },
        { id: "customers", labelKey: "customers", icon: Users },
        { id: "currencies", labelKey: "currencies", icon: Coins },
        { id: "flour-types", labelKey: "flourTypes", icon: Package },
        { id: "transactions", labelKey: "documents", icon: FileText },
        { id: "documents-list", labelKey: "documentsList", icon: FileText },
        { id: "cash-inventory", labelKey: "cashInventory", icon: Wallet },
        { id: "reports", labelKey: "reports", icon: BarChart3 },
        { id: "settings", labelKey: "settings", icon: Settings },
    ] as const

    return (
        <>
            {/* Mobile menu button */}
            <Button
                variant="outline"
                size="icon"
                className={`fixed top-4 z-50 md:hidden bg-background/80 backdrop-blur-sm border-0 shadow-md ${lang === "fa" ? "right-4" : "left-4"}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>

            {/* Sidebar */}
            <Card
                className={`fixed top-0 w-64 z-40 transform transition-transform duration-300 md:relative md:transform-none border-0 border-e rounded-none shadow-lg md:shadow-none bg-card/90 backdrop-blur-2xl ${lang === "fa" ? "right-0" : "left-0"} ${isOpen ? "translate-x-0" : lang === "fa" ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"
                    }`}
            >
                <div className="p-4 md:p-5 h-full flex flex-col gap-4">
                    {/* عنوان و سوییچ زبان */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                            <h2 className="text-base md:text-lg font-bold text-primary leading-tight">
                                {t("appTitle")}
                            </h2>
                            <p className="text-[11px] md:text-xs text-muted-foreground">
                                {lang === "fa" ? "مدیریت ساده حسابداری آرد و وجه" : "Lightweight flour & cash ledger"}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLang(lang === "fa" ? "en" : "fa")}
                            className="shrink-0 text-xs px-2 py-1"
                        >
                            {lang === "fa" ? "EN" : "فا"}
                        </Button>
                    </div>

                    <div className="h-px bg-border/60 rounded-full" />

                    <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeSection === item.id
                            return (
                                <Button
                                    key={item.id}
                                    variant={isActive ? "default" : "ghost"}
                                    className={`w-full gap-3 transition-all duration-200 flex ${lang === "fa"
                                        ? "flex-row-reverse text-right justify-between"
                                        : "flex-row text-left justify-start"
                                        } ${isActive ? "shadow-md ltr:translate-x-1 rtl:-translate-x-1" : "hover:bg-primary/10"}`}
                                    onClick={() => {
                                        onSectionChange(item.id)
                                        setIsOpen(false)
                                    }}
                                >
                                    <Icon className="h-4 w-4" />
                                    {t(item.labelKey)}
                                </Button>
                            )
                        })}
                    </nav>
                </div>
            </Card>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    )
}
