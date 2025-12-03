"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLang } from "@/components/language-provider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AppData, ForeignTransactionDocument, ForeignTransactionItem } from "@/types"
import { Plus, Trash2, Printer, Search, Edit, X } from "lucide-react"

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

interface ForeignTransactionsProps {
    data: AppData
    onDataChange: (data: AppData) => void
}

interface PendingItem {
    id: string
    amount: number
    amountDinar?: number
    transactionDetails: string
    date: string
}

export function ForeignTransactions({ data, onDataChange }: ForeignTransactionsProps) {
    const { t, lang } = useLang()

    // Customer Info State
    const [customerName, setCustomerName] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")

    // Current Item State
    const [amount, setAmount] = useState("")
    const [amountDinar, setAmountDinar] = useState("")
    const [transactionDetails, setTransactionDetails] = useState("")
    const [date, setDate] = useState("")

    // Pending Items State
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([])

    // Search State
    const [searchTerm, setSearchTerm] = useState("")

    // Edit State
    const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null)

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault()
        if ((!amount && !amountDinar) || !date) return

        const newItem: PendingItem = {
            id: generateId(),
            amount: amount ? Number(amount) : 0,
            amountDinar: amountDinar ? Number(amountDinar) : 0,
            transactionDetails,
            date,
        }

        setPendingItems([...pendingItems, newItem])

        // Reset item fields
        setAmount("")
        setAmountDinar("")
        setTransactionDetails("")
        setDate("")
    }

    const handleRemoveItem = (id: string) => {
        setPendingItems(pendingItems.filter(item => item.id !== id))
    }

    const handleSubmitAll = () => {
        if (!customerName || pendingItems.length === 0) return

        if (editingDocumentId) {
            // Update existing document
            const updatedDocuments = (data.foreignTransactions || []).map(doc => {
                if (doc.id === editingDocumentId) {
                    return {
                        ...doc,
                        customerName,
                        phoneNumber,
                        items: pendingItems.map(item => ({
                            id: item.id,
                            amount: item.amount,
                            amountDinar: item.amountDinar,
                            transactionDetails: item.transactionDetails,
                            date: item.date
                        }))
                    }
                }
                return doc
            })

            onDataChange({
                ...data,
                foreignTransactions: updatedDocuments,
            })

            // Reset edit mode
            setEditingDocumentId(null)
        } else {
            // Create new document
            const newDocument: ForeignTransactionDocument = {
                id: generateId(),
                customerName,
                phoneNumber,
                createdAt: new Date().toISOString(),
                items: pendingItems.map(item => ({
                    id: item.id,
                    amount: item.amount,
                    amountDinar: item.amountDinar,
                    transactionDetails: item.transactionDetails,
                    date: item.date
                }))
            }

            const updatedDocuments = [...(data.foreignTransactions || []), newDocument]

            onDataChange({
                ...data,
                foreignTransactions: updatedDocuments,
            })
        }

        // Reset form
        setCustomerName("")
        setPhoneNumber("")
        setPendingItems([])
    }

    const handleEditDocument = (doc: ForeignTransactionDocument) => {
        setEditingDocumentId(doc.id)
        setCustomerName(doc.customerName)
        setPhoneNumber(doc.phoneNumber)
        setPendingItems(doc.items.map(item => ({
            id: item.id,
            amount: item.amount,
            amountDinar: item.amountDinar,
            transactionDetails: item.transactionDetails,
            date: item.date
        })))

        // Scroll to top to see form
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleCancelEdit = () => {
        setEditingDocumentId(null)
        setCustomerName("")
        setPhoneNumber("")
        setPendingItems([])
    }

    const handleDeleteDocument = (id: string) => {
        if (confirm(t("deleteConfirmation"))) {
            const updatedDocuments = (data.foreignTransactions || []).filter((doc) => doc.id !== id)
            onDataChange({
                ...data,
                foreignTransactions: updatedDocuments,
            })

            // If deleting the document currently being edited, cancel edit mode
            if (editingDocumentId === id) {
                handleCancelEdit()
            }
        }
    }

    // Filter Documents
    const filteredDocuments = (data.foreignTransactions || []).filter(doc =>
        doc.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const printContent = (customerName: string, phoneNumber: string, items: ForeignTransactionItem[]) => {
        const currentDate = new Date()
        const persianDate = currentDate.toLocaleDateString("fa-IR")
        const gregorianDate = currentDate.toLocaleDateString("en-US")
        const totalSum = items.reduce((sum, item) => sum + item.amount, 0)
        const totalSumDinar = items.reduce((sum, item) => sum + (item.amountDinar || 0), 0)

        const hasDollar = items.some(item => item.amount !== 0)
        const hasDinar = items.some(item => item.amountDinar && item.amountDinar !== 0)

        return `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>${customerName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Vazirmatn', sans-serif; font-size: 20px; line-height: 1.4; color: #333; direction: rtl; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { font-size: 29px; font-weight: 700; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: center; font-size: 20px; }
          th { background-color: #f5f5f5; font-weight: 600; }
          .total-row { font-weight: bold; background-color: #eee; }
          .footer { margin-top: 20px; text-align: center; font-size: 16px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${customerName}</h1>
          ${phoneNumber ? `<div style="font-size: 24px; margin-top: 5px;">ره قم موبایل: ${phoneNumber}</div>` : ""}
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              ${hasDollar ? `<th style="width: 25%">پاره دولار</th>` : ""}
              ${hasDinar ? `<th style="width: 25%">پاره دینار</th>` : ""}
              <th style="width: ${hasDollar && hasDinar ? "30%" : "40%"}">معامله</th>
              <th style="width: 15%">${t("date")}</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                ${hasDollar ? `<td>${item.amount.toLocaleString()} دولار</td>` : ""}
                ${hasDinar ? `<td>${(item.amountDinar || 0).toLocaleString()} دینار</td>` : ""}
                <td>${item.transactionDetails || "-"}</td>
                <td>${item.date}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="1">کوی گشتی</td>
              ${hasDollar ? `<td>${totalSum.toLocaleString()} دولار</td>` : ""}
              ${hasDinar ? `<td>${totalSumDinar.toLocaleString()} دینار</td>` : ""}
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `
    }

    const handlePrintDocument = (doc: ForeignTransactionDocument) => {
        const printWindow = window.open("", "_blank")
        if (!printWindow) return
        printWindow.document.write(printContent(doc.customerName, doc.phoneNumber, doc.items))
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
    }

    const handleGlobalPrint = () => {
        if (!searchTerm) return

        // Aggregate items from all filtered documents
        const aggregatedItems: ForeignTransactionItem[] = []
        let firstDocPhone = ""

        filteredDocuments.forEach(doc => {
            if (!firstDocPhone) firstDocPhone = doc.phoneNumber
            if (doc.items) {
                aggregatedItems.push(...doc.items)
            }
        })

        // Sort aggregated items by date
        aggregatedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        const printWindow = window.open("", "_blank")
        if (!printWindow) return
        printWindow.document.write(printContent(searchTerm, firstDocPhone, aggregatedItems))
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
    }

    return (
        <div className="space-y-6">
            <Card className={editingDocumentId ? "border-2 border-primary" : ""}>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>{editingDocumentId ? t("edit") : t("foreignTransactions")}</CardTitle>
                        {editingDocumentId && (
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 mr-2" />
                                {t("cancelEdit")}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Section 1: Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                        <div className="space-y-2">
                            <Label htmlFor="customerName">{t("customerName")}</Label>
                            <Input
                                id="customerName"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder={t("customerName")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">{t("phoneNumber")}</Label>
                            <Input
                                id="phoneNumber"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder={t("phoneNumber")}
                            />
                        </div>
                    </div>

                    {/* Section 2: New Item Entry */}
                    <form onSubmit={handleAddItem} className="space-y-4 p-4 border rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">{t("amountDollar")}</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amountDinar">{t("amountDinar")}</Label>
                                <Input
                                    id="amountDinar"
                                    type="number"
                                    value={amountDinar}
                                    onChange={(e) => setAmountDinar(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">{t("date")}</Label>
                                <Input
                                    id="date"
                                    type="text"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    placeholder="YYYY/MM/DD"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="transactionDetails">{t("transactionDetails")}</Label>
                                <Input
                                    id="transactionDetails"
                                    value={transactionDetails}
                                    onChange={(e) => setTransactionDetails(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button type="submit" variant="secondary" className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            {t("addItem")}
                        </Button>
                    </form>

                    {/* Section 3: Pending Items List */}
                    {pendingItems.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm">{t("pendingItems")}</h3>
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t("amountDollar")}</TableHead>
                                            <TableHead>{t("amountDinar")}</TableHead>
                                            <TableHead>{t("transactionDetails")}</TableHead>
                                            <TableHead>{t("date")}</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.amount.toLocaleString()}</TableCell>
                                                <TableCell>{(item.amountDinar || 0).toLocaleString()}</TableCell>
                                                <TableCell>{item.transactionDetails || "-"}</TableCell>
                                                <TableCell>{item.date}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <Button
                                    className="flex-1"
                                    size="lg"
                                    onClick={handleSubmitAll}
                                    disabled={!customerName}
                                >
                                    {editingDocumentId ? t("updateDocument") : `${t("submitAll")} (${pendingItems.length})`}
                                </Button>
                                {editingDocumentId && (
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={handleCancelEdit}
                                    >
                                        {t("cancel")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>{t("lastRegisteredDocuments")}</CardTitle>
                        <div className="flex gap-2">
                            <div className="relative w-64">
                                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t("searchCustomer")}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-10 h-9"
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={handleGlobalPrint} disabled={!searchTerm}>
                                <Printer className="h-4 w-4 ml-2" />
                                {t("print")}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("customerName")}</TableHead>
                                    <TableHead>{t("phoneNumber")}</TableHead>
                                    <TableHead>{t("itemCount")}</TableHead>
                                    <TableHead>{t("totalAmount")}</TableHead>
                                    <TableHead>{t("actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDocuments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            {t("noForeignTransactions")}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredDocuments.map((doc) => {
                                        const totalDollar = (doc.items || []).reduce((sum, item) => sum + item.amount, 0)
                                        const totalDinar = (doc.items || []).reduce((sum, item) => sum + (item.amountDinar || 0), 0)
                                        return (
                                            <TableRow key={doc.id} className={editingDocumentId === doc.id ? "bg-muted/50" : ""}>
                                                <TableCell>{doc.customerName}</TableCell>
                                                <TableCell>{doc.phoneNumber || "-"}</TableCell>
                                                <TableCell>{(doc.items || []).length}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span>${totalDollar.toLocaleString()}</span>
                                                        <span className="text-xs text-muted-foreground">{totalDinar.toLocaleString()} IQD</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEditDocument(doc)}
                                                            disabled={!!editingDocumentId}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handlePrintDocument(doc)}
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
