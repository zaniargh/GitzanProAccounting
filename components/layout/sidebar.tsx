import { useState, useEffect } from "react"
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
    Globe,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"

// ✅ اضافه‌شده: هوک زبان
import { useLang } from "@/components/language-provider"

interface SidebarProps {
    activeSection: string
    onSectionChange: (section: string) => void
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)
    const { t, lang, setLang } = useLang()

    // Auto-collapse on mobile/small screens if needed, but mainly manual
    // Persist collapsed state if desired? For now, local state is fine.

    const menuItems = [
        { id: "dashboard", labelKey: "dashboard", icon: Home },
        { id: "transactions", labelKey: "documents", icon: FileText },
        { id: "documents-list", labelKey: "documentsList", icon: FileText },
        { id: "customers", labelKey: "customers", icon: Users },
        { id: "bank-accounts", labelKey: "bankAccounts", icon: Wallet },
        { id: "currencies", labelKey: "currencies", icon: Coins },
        { id: "product-types", labelKey: "productTypes", icon: Package },
        { id: "cash-inventory", labelKey: "cashInventory", icon: Wallet },
        { id: "foreign-transactions", labelKey: "foreignTransactions", icon: Globe },
        { id: "reports", labelKey: "reports", icon: BarChart3 },
        { id: "settings", labelKey: "settings", icon: Settings },
    ] as const

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed)
    }

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
                className={`fixed top-0 h-screen z-40 transform transition-all duration-300 ease-in-out md:relative md:transform-none border-0 border-e rounded-none shadow-lg md:shadow-none bg-card/90 backdrop-blur-2xl 
                    ${lang === "fa" ? "right-0" : "left-0"} 
                    ${isOpen ? "translate-x-0" : lang === "fa" ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"}
                    ${isCollapsed ? "w-[70px]" : "w-64"}
                `}
            >
                <div className={`p-4 h-full flex flex-col gap-4 ${isCollapsed ? "items-center px-2" : ""}`}>
                    {/* عنوان و سوییچ زبان */}
                    <div className={`flex items-center gap-2 ${isCollapsed ? "flex-col justify-center" : "justify-between"}`}>
                        {!isCollapsed && (
                            <div className="flex flex-col gap-0.5 overflow-hidden transition-all duration-300">
                                <h2 className="text-base md:text-lg font-bold text-primary leading-tight whitespace-nowrap">
                                    {lang === "fa" ? "گیتزان پرو" : "Gitzan Pro"}
                                </h2>
                                <p className="text-[11px] md:text-xs text-muted-foreground whitespace-nowrap truncate">
                                    {lang === "fa" ? "حسابداری پیشرفته" : "Accounting Sys"}
                                </p>
                            </div>
                        )}

                        {/* Collapse Button (shown only on desktop usually) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleCollapse}
                            className={`hidden md:flex h-8 w-8 ${isCollapsed ? "mb-2" : ""}`}
                            title={isCollapsed ? "Expand" : "Collapse"}
                        >
                            {lang === "fa"
                                ? (isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)
                                : (isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />)
                            }
                        </Button>

                        {!isCollapsed && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLang(lang === "fa" ? "en" : "fa")}
                                className="shrink-0 text-xs px-2 py-1 h-7"
                            >
                                {lang === "fa" ? "EN" : "فا"}
                            </Button>
                        )}
                    </div>

                    <div className="h-px w-full bg-border/60 rounded-full" />

                    <nav className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden w-full no-scrollbar">
                        {menuItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeSection === item.id
                            return (
                                <Button
                                    key={item.id}
                                    variant={isActive ? "default" : "ghost"}
                                    title={isCollapsed ? t(item.labelKey) : ""}
                                    className={`
                                        w-full transition-all duration-200 flex items-center relative group
                                        ${isCollapsed ? "justify-center p-2 h-10 aspect-square" : "gap-3 px-3 py-2"}
                                        ${isActive ? "shadow-md" : "hover:bg-primary/10"}
                                        ${!isCollapsed && lang === "fa" ? "flex-row-reverse text-right justify-between" : ""}
                                        ${!isCollapsed && lang !== "fa" ? "flex-row text-left justify-start" : ""}
                                    `}
                                    onClick={() => {
                                        onSectionChange(item.id)
                                        setIsOpen(false)
                                    }}
                                >
                                    <Icon className={`${isCollapsed ? "h-5 w-5" : "h-4 w-4"} shrink-0`} />

                                    {!isCollapsed && (
                                        <span className={`truncate text-sm ${isActive ? "font-medium" : ""}`}>
                                            {t(item.labelKey)}
                                        </span>
                                    )}

                                    {/* Tooltip-like popup on hover when collapsed */}
                                    {isCollapsed && (
                                        <div className={`
                                            absolute z-50 invisible opacity-0 lg:group-hover:visible lg:group-hover:opacity-100 
                                            bg-popover text-popover-foreground text-xs rounded-md shadow-md py-1 px-2 
                                            transition-all duration-200 whitespace-nowrap
                                            ${lang === "fa" ? "right-full mr-2" : "left-full ml-2"}
                                        `}>
                                            {t(item.labelKey)}
                                        </div>
                                    )}
                                </Button>
                            )
                        })}
                    </nav>

                    {/* Language switch when collapsed (bottom) */}
                    {isCollapsed && (
                        <div className="mt-auto pt-2 flex justify-center border-t border-border/30">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLang(lang === "fa" ? "en" : "fa")}
                                className="h-8 w-8 p-0 rounded-full font-bold text-xs"
                            >
                                {lang === "fa" ? "EN" : "فا"}
                            </Button>
                        </div>
                    )}
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
