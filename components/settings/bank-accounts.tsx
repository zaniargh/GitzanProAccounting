"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2 } from "lucide-react"
import type { BankAccount, AppData } from "@/types"
import { useLang } from "@/components/language-provider"

interface BankAccountsProps {
    data: AppData
    onDataChange: (data: AppData) => void
}

export function BankAccounts({ data, onDataChange }: BankAccountsProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
    const [formData, setFormData] = useState({
        bankName: "",
        accountNumber: "",
        accountHolder: "",
        initialBalance: "",
        currencyId: "",
        description: ""
    })
    const { t, lang } = useLang()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (editingAccount) {
            const updatedAccounts = data.bankAccounts.map((account) =>
                account.id === editingAccount.id
                    ? {
                        ...account,
                        bankName: formData.bankName,
                        accountNumber: formData.accountNumber,
                        accountHolder: formData.accountHolder,
                        initialBalance: Number.parseFloat(formData.initialBalance),
                        currencyId: formData.currencyId,
                        description: formData.description,
                    }
                    : account,
            )
            onDataChange({ ...data, bankAccounts: updatedAccounts })
        } else {
            // Find Main group
            const mainGroup = data.customerGroups.find(g => g.id === "main-group")

            const newAccount: BankAccount = {
                id: crypto.randomUUID(),
                bankName: formData.bankName,
                accountNumber: formData.accountNumber,
                accountHolder: formData.accountHolder,
                initialBalance: Number.parseFloat(formData.initialBalance) || 0,
                currencyId: formData.currencyId,
                groupId: mainGroup?.id || "",
                description: formData.description,
                createdAt: new Date().toISOString(),
            }
            onDataChange({
                ...data,
                bankAccounts: [...(data.bankAccounts || []), newAccount],
            })
        }

        setFormData({ bankName: "", accountNumber: "", accountHolder: "", initialBalance: "", currencyId: "", description: "" })
        setEditingAccount(null)
        setIsDialogOpen(false)
    }

    const handleEdit = (account: BankAccount) => {
        setEditingAccount(account)
        setFormData({
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            accountHolder: account.accountHolder,
            initialBalance: (account.initialBalance || 0).toString(),
            currencyId: account.currencyId || "",
            description: account.description || ""
        })
        setIsDialogOpen(true)
    }

    const handleDelete = (accountId: string) => {
        if (confirm(t("deleteBankAccountConfirm"))) {
            const updatedAccounts = data.bankAccounts.filter((account) => account.id !== accountId)
            onDataChange({
                ...data,
                bankAccounts: updatedAccounts,
            })
        }
    }

    const openAddDialog = () => {
        setEditingAccount(null)
        setFormData({
            bankName: "",
            accountNumber: "",
            accountHolder: "",
            initialBalance: "0",
            currencyId: data.settings?.baseCurrencyId || data.currencies[0]?.id || "",
            description: ""
        })
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">{t("bankAccountsTitle")}</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 ml-2" />
                            {t("newBankAccount")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent dir={lang === "fa" ? "rtl" : "ltr"}>
                        <DialogHeader>
                            <DialogTitle>{editingAccount ? t("editBankAccount") : t("newBankAccount")}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="bankName">{t("bankName")}</Label>
                                <Input
                                    id="bankName"
                                    value={formData.bankName}
                                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="accountNumber">{t("accountNumber")}</Label>
                                <Input
                                    id="accountNumber"
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="accountHolder">{t("accountHolder")}</Label>
                                <Input
                                    id="accountHolder"
                                    value={formData.accountHolder}
                                    onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="initialBalance">{t("initialBalance")}</Label>
                                <Input
                                    id="initialBalance"
                                    type="number"
                                    step="0.01"
                                    value={formData.initialBalance}
                                    onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="currency">{t("selectCurrency")}</Label>
                                <Select
                                    value={formData.currencyId}
                                    onValueChange={(value) => setFormData({ ...formData, currencyId: value })}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("selectCurrency")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data.currencies.map((currency) => (
                                            <SelectItem key={currency.id} value={currency.id}>
                                                {currency.name} ({currency.symbol})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="description">{t("description")}</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit">{editingAccount ? t("edit") : t("create")}</Button>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    {t("cancel")}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.bankAccounts || []).map((account) => {
                    const currency = data.currencies.find(c => c.id === account.currencyId)
                    return (
                        <Card key={account.id} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold">{account.bankName}</h3>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEdit(account)}
                                        title={t("editBankAccount")}
                                    >
                                        <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(account.id)}
                                        title={t("deleteBankAccount")}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1 text-sm">
                                <p className="text-muted-foreground">
                                    <span className="font-medium">{t("accountNumber")}:</span> {account.accountNumber}
                                </p>
                                <p className="text-muted-foreground">
                                    <span className="font-medium">{t("accountHolder")}:</span> {account.accountHolder}
                                </p>
                                <p className="text-muted-foreground">
                                    <span className="font-medium">{t("currency")}:</span> {currency?.name} ({currency?.symbol})
                                </p>
                                <p className="text-green-600 font-semibold">
                                    {t("initialBalance")}: {(account.initialBalance || 0).toLocaleString()} {currency?.symbol || ""}
                                </p>
                                {account.description && (
                                    <p className="text-muted-foreground text-xs mt-2">{account.description}</p>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>

            {(!data.bankAccounts || data.bankAccounts.length === 0) && (
                <Card className="p-8 text-center">
                    <p className="text-muted-foreground">{t("noBankAccountsDefined")}</p>
                </Card>
            )}
        </div>
    )
}
