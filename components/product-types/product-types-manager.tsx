"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit2, Trash2, Search, Filter } from "lucide-react"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import type { ProductType, Transaction } from "@/types"
import { useLang } from "@/components/language-provider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ProductTypesManagerProps {
  productTypes: ProductType[]
  transactions: Transaction[]
  onProductTypesChange: (types: ProductType[]) => void
}

export function ProductTypesManager({ productTypes, transactions = [], onProductTypesChange }: ProductTypesManagerProps) {
  // const [productTypes, setProductTypes] = useLocalStorageGeneric<ProductType[]>("productTypes", [])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    productCode: "",
    description: "",
    measurementType: "weight" as "quantity" | "weight",
  })
  const [productCodeError, setProductCodeError] = useState("")
  const [filterMeasurement, setFilterMeasurement] = useState<"all" | "quantity" | "weight">("all")
  const [sortOrder, setSortOrder] = useState<"newest" | "inventory-desc" | "inventory-asc" | "name-asc" | "name-desc" | "type-asc" | "type-desc">("newest")
  const [selectedWeightUnit, setSelectedWeightUnit] = useState<"ton" | "kg" | "g" | "mg" | "lb">("ton")
  const { t, lang } = useLang()

  const WEIGHT_CONVERSION = {
    ton: 1000,
    kg: 1,
    g: 0.001,
    mg: 0.000001,
    lb: 0.453592
  }

  const calculateInventory = (product: ProductType) => {
    let inventory = 0
    transactions.forEach((t) => {
      if (t.productTypeId === product.id && t.customerId === "default-warehouse") {
        let amount = 0
        if (product.measurementType === "quantity") {
          amount = Number(t.quantity) || 0
        } else {
          // Convert transaction weight to kg first (base unit)
          const weightInKg = (Number(t.weight) || 0) * (WEIGHT_CONVERSION[(t.weightUnit as keyof typeof WEIGHT_CONVERSION) || "ton"] || 1000)
          // Then convert to selected unit
          amount = weightInKg / WEIGHT_CONVERSION[selectedWeightUnit]
        }

        // Fallback for data inconsistency (e.g. type changed)
        if (amount === 0) {
          if (product.measurementType === "quantity" && (Number(t.weight) || 0) > 0) {
            // Treat weight as quantity if type mismatch (fallback)
            amount = Number(t.weight) || 0
          }
          else if (product.measurementType !== "quantity" && (Number(t.quantity) || 0) > 0) {
            // Treat quantity as weight (fallback, assume 1 unit = 1 selected unit)
            amount = Number(t.quantity) || 0
          }
        }

        if (t.type === "product_in" || t.type === "product_purchase") {
          inventory += amount
        } else if (t.type === "product_out" || t.type === "product_sale") {
          inventory -= amount
        }
      }
    })
    return inventory
  }

  const filteredProductTypes = productTypes.filter((type) => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (type.productCode && type.productCode.includes(searchTerm))
    const matchesFilter = filterMeasurement === "all" || type.measurementType === filterMeasurement
    return matchesSearch && matchesFilter
  }).sort((a, b) => {
    if (sortOrder === "newest") {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      return 0
    }

    if (sortOrder === "name-asc") {
      return a.name.localeCompare(b.name)
    }
    if (sortOrder === "name-desc") {
      return b.name.localeCompare(a.name)
    }

    if (sortOrder === "type-asc") {
      return (a.measurementType || "").localeCompare(b.measurementType || "")
    }
    if (sortOrder === "type-desc") {
      return (b.measurementType || "").localeCompare(a.measurementType || "")
    }

    const inventoryA = calculateInventory(a)
    const inventoryB = calculateInventory(b)

    if (sortOrder === "inventory-desc") {
      return inventoryB - inventoryA
    } else if (sortOrder === "inventory-asc") {
      return inventoryA - inventoryB
    }

    return 0
  })

  const handleSort = (column: "name" | "inventory" | "type") => {
    if (column === "name") {
      setSortOrder(sortOrder === "name-asc" ? "name-desc" : "name-asc")
    } else if (column === "inventory") {
      setSortOrder(sortOrder === "inventory-desc" ? "inventory-asc" : "inventory-desc")
    } else if (column === "type") {
      setSortOrder(sortOrder === "type-asc" ? "type-desc" : "type-asc")
    }
  }

  const generateNextProductCode = () => {
    if (productTypes.length === 0) return "1001"
    const codes = productTypes
      .map((p) => Number.parseInt(p.productCode || "0"))
      .filter((c) => !isNaN(c))
    if (codes.length === 0) return "1001"
    return (Math.max(...codes) + 1).toString()
  }

  const validateProductCode = (code: string, currentId?: string) => {
    if (!code) return t("productCodeRequired")
    const duplicate = productTypes.find((p) => p.productCode === code && p.id !== currentId)
    if (duplicate) return t("productCodeDuplicate")
    return ""
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const codeError = validateProductCode(formData.productCode, editingId || undefined)
    if (codeError) {
      setProductCodeError(codeError)
      return
    }

    if (editingId) {
      onProductTypesChange(
        productTypes.map((type) =>
          type.id === editingId
            ? {
              ...type,
              name: formData.name,
              productCode: formData.productCode,
              description: formData.description,
              measurementType: formData.measurementType,
            }
            : type,
        ),
      )
      setEditingId(null)
    } else {
      const newProductType: ProductType = {
        id: crypto.randomUUID(),
        name: formData.name,
        productCode: formData.productCode,
        description: formData.description,
        measurementType: formData.measurementType,
        createdAt: new Date().toISOString(),
      }
      onProductTypesChange([...productTypes, newProductType])
    }

    setFormData({ name: "", productCode: "", description: "", measurementType: "weight" })
    setIsAdding(false)
    setProductCodeError("")
  }

  const handleEdit = (type: ProductType) => {
    setFormData({
      name: type.name,
      productCode: type.productCode || "",
      description: type.description || "",
      measurementType: type.measurementType || "weight",
    })
    setProductCodeError("")
    setEditingId(type.id)
    setIsAdding(true)
  }

  const openAddDialog = () => {
    setFormData({
      name: "",
      productCode: generateNextProductCode(),
      description: "",
      measurementType: "weight",
    })
    setProductCodeError("")
    setEditingId(null)
    setIsAdding(true)
  }

  const handleDelete = (id: string) => {
    if (confirm(t("deleteConfirmation"))) {
      onProductTypesChange(productTypes.filter((type) => type.id !== id))
    }
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: "", productCode: "", description: "", measurementType: "weight" })
    setProductCodeError("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("productManagerTitle")}</h2>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("productAddButton")}
        </Button>
      </div>

      {/* ‫فرم افزودن/ویرایش‬ */}
      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t("productEditTitle") : t("productAddTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("productCode")}
                  </label>
                  <Input
                    value={formData.productCode}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, productCode: e.target.value }))
                      setProductCodeError("")
                    }}
                    placeholder={t("productCodePlaceholder")}
                    className={productCodeError ? "border-red-500" : ""}
                    required
                  />
                  {productCodeError && <p className="text-red-500 text-xs mt-1">{productCodeError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("productNameLabel")}
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={t("productNamePlaceholder")}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("productMeasurementType")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="measurementType"
                      value="weight"
                      checked={formData.measurementType === "weight"}
                      onChange={() => setFormData((prev) => ({ ...prev, measurementType: "weight" }))}
                      className="accent-primary"
                    />
                    <span>{t("measurementWeight")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="measurementType"
                      value="quantity"
                      checked={formData.measurementType === "quantity"}
                      onChange={() => setFormData((prev) => ({ ...prev, measurementType: "quantity" }))}
                      className="accent-primary"
                    />
                    <span>{t("measurementQuantity")}</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("productDescriptionLabel")}
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t("productDescriptionPlaceholder")}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? t("productUpdate") : t("productSave")}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t("productCancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ‫فیلترها و جستجو‬ */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={t("productSearchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterMeasurement} onValueChange={(v: any) => setFilterMeasurement(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filterByMeasurement")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="weight">{t("measurementWeight")}</SelectItem>
              <SelectItem value="quantity">{t("measurementQuantity")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedWeightUnit} onValueChange={(v: any) => setSelectedWeightUnit(v)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ton">Ton</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="mg">mg</SelectItem>
              <SelectItem value="lb">lb</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("sortNewest")}</SelectItem>
              <SelectItem value="inventory-desc">{t("sortInventoryHigh")}</SelectItem>
              <SelectItem value="inventory-asc">{t("sortInventoryLow")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ‫جدول کالاها‬ */}
      <div className="border rounded-lg overflow-hidden bg-card" dir={lang === "fa" ? "rtl" : "ltr"}>
        <Table>
          <TableHeader className="bg-primary/5">
            <TableRow>
              <TableHead className={`text-right font-bold ${lang === "fa" ? "text-right" : "text-left"}`}>{t("productCode")}</TableHead>
              <TableHead
                className={`text-right font-bold cursor-pointer hover:bg-muted/50 ${lang === "fa" ? "text-right" : "text-left"}`}
                onClick={() => handleSort("name")}
              >
                {t("productNameLabel")} {sortOrder === "name-asc" ? "↑" : sortOrder === "name-desc" ? "↓" : ""}
              </TableHead>
              <TableHead
                className={`text-right font-bold cursor-pointer hover:bg-muted/50 ${lang === "fa" ? "text-right" : "text-left"}`}
                onClick={() => handleSort("type")}
              >
                {t("productMeasurementType")} {sortOrder === "type-asc" ? "↑" : sortOrder === "type-desc" ? "↓" : ""}
              </TableHead>
              <TableHead
                className={`text-right font-bold cursor-pointer hover:bg-muted/50 ${lang === "fa" ? "text-right" : "text-left"}`}
                onClick={() => handleSort("inventory")}
              >
                {t("inventory")} {sortOrder === "inventory-asc" ? "↑" : sortOrder === "inventory-desc" ? "↓" : ""}
              </TableHead>
              <TableHead className={`text-right font-bold ${lang === "fa" ? "text-right" : "text-left"}`}>{t("description")}</TableHead>
              <TableHead className={`text-right font-bold ${lang === "fa" ? "text-right" : "text-left"}`}>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProductTypes.map((type) => {
              const inventory = calculateInventory(type)
              return (
                <TableRow key={type.id}>
                  <TableCell className="font-mono">{type.productCode || "-"}</TableCell>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {type.measurementType === "quantity" ? t("measurementQuantity") : t("measurementWeight")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={inventory < 0 ? "text-red-600 font-bold" : "font-bold"}>
                      {new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 3 }).format(inventory)}
                      {" "}
                      {type.measurementType === "quantity" ? t("unit") : selectedWeightUnit}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {type.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(type)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(type.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredProductTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? t("productEmptySearch") : t("productEmpty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredProductTypes.length === 0 && searchTerm && (
        <div className="text-center py-8 text-muted-foreground">{t("productEmptySearch")}</div>
      )}
      {filteredProductTypes.length === 0 && !searchTerm && (
        <div className="text-center py-8 text-muted-foreground">{t("productEmpty")}</div>
      )}
    </div>
  )
}
