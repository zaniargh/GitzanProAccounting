"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Coins } from "lucide-react"
import type { Currency, AppData } from "@/types"
import { useLang } from "@/components/language-provider"

interface CurrenciesProps {
    data: AppData
    onDataChange: (data: AppData) => void
}

export function Currencies({ data, onDataChange }: CurrenciesProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null)
    const [formData, setFormData] = useState({ name: "", symbol: "" })
    const { t, lang } = useLang()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (editingCurrency) {
            const updatedCurrencies = (data.currencies || []).map((currency) =>
                currency.id === editingCurrency.id
                    ? { ...currency, name: formData.name, symbol: formData.symbol }
                    : currency,
            )
            onDataChange({ ...data, currencies: updatedCurrencies })
        } else {
            const newCurrency: Currency = {
                id: Date.now().toString(),
                name: formData.name,
                symbol: formData.symbol,
            }
            onDataChange({
                ...data,
                currencies: [...(data.currencies || []), newCurrency],
            })
        }

        setFormData({ name: "", symbol: "" })
        setEditingCurrency(null)
        setIsDialogOpen(false)
    }

    const handleEdit = (currency: Currency) => {
        setEditingCurrency(currency)
        setFormData({
            name: currency.name,
            symbol: currency.symbol,
        })
        setIsDialogOpen(true)
    }

    const handleDelete = (currencyId: string) => {
        if (confirm(t("deleteCurrencyConfirm"))) {
            const updatedCurrencies = (data.currencies || []).filter((currency) => currency.id !== currencyId)
            onDataChange({
                ...data,
                currencies: updatedCurrencies,
            })
        }
    }

    const openAddDialog = () => {
        setEditingCurrency(null)
        setFormData({ name: "", symbol: "" })
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">{t("currenciesTitle")}</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 ml-2" />
                            {t("newCurrency")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent dir={lang === "fa" ? "rtl" : "ltr"}>
                        <DialogHeader>
                            <DialogTitle>{editingCurrency ? t("editCurrency") : t("newCurrency")}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="name">{t("currencyName")}</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t("currencyNamePlaceholder")}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="symbol">{t("currencySymbol")}</Label>
                                <Input
                                    id="symbol"
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                                    placeholder="$"
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit">{editingCurrency ? t("edit") : t("create")}</Button>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    {t("cancel")}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.currencies || []).map((currency) => (
                    <Card key={currency.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-primary/10 rounded-full">
                                    <Coins className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">{currency.name}</h3>
                                    <p className="text-xs text-muted-foreground">{currency.symbol}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(currency)} title={t("editCurrency")}>
                                    <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(currency.id)} title={t("deleteCurrency")}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {(!data.currencies || data.currencies.length === 0) && (
                <Card className="p-8 text-center">
                    <p className="text-muted-foreground">{t("noCurrenciesDefined")}</p>
                </Card>
            )}
        </div>
    )
}
