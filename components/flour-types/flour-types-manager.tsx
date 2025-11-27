"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit2, Trash2, Search } from "lucide-react"
import { useLocalStorageGeneric } from "@/hooks/use-local-storage-generic"
import type { FlourType } from "@/types"
import { useLang } from "@/components/language-provider"

export function FlourTypesManager() {
  const [flourTypes, setFlourTypes] = useLocalStorageGeneric<FlourType[]>("flourTypes", [])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    measurementType: "weight" as "quantity" | "weight",
  })
  const { t, lang } = useLang()

  const filteredFlourTypes = flourTypes.filter((type) => type.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    if (editingId) {
      setFlourTypes((prev) =>
        prev.map((type) =>
          type.id === editingId
            ? {
              ...type,
              name: formData.name,
              description: formData.description,
              measurementType: formData.measurementType,
            }
            : type,
        ),
      )
      setEditingId(null)
    } else {
      const newFlourType: FlourType = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        measurementType: formData.measurementType,
        createdAt: new Date().toISOString(),
      }
      setFlourTypes((prev) => [...prev, newFlourType])
    }

    setFormData({ name: "", description: "", measurementType: "weight" })
    setIsAdding(false)
  }

  const handleEdit = (type: FlourType) => {
    setFormData({
      name: type.name,
      description: type.description || "",
      measurementType: type.measurementType || "weight",
    })
    setEditingId(type.id)
    setIsAdding(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("آیا از حذف این نوع آرد اطمینان دارید؟")) {
      setFlourTypes((prev) => prev.filter((type) => type.id !== id))
    }
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: "", description: "", measurementType: "weight" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("productManagerTitle")}</h2>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("productAddButton")}
        </Button>
      </div>

      {/* فرم افزودن/ویرایش */}
      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t("productEditTitle") : t("productAddTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* جستجو */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={t("productSearchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* لیست کالاها */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredFlourTypes.map((type) => (
          <Card key={type.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{type.name}</h3>
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
              </div>
              {type.description && <p className="text-sm text-gray-600 mb-3">{type.description}</p>}
              <Badge variant="secondary" className="text-xs">
                {lang === "fa"
                  ? new Date(type.createdAt).toLocaleDateString("fa-IR")
                  : new Date(type.createdAt).toLocaleDateString("en-GB")}
              </Badge>
              <Badge variant="outline" className="text-xs mr-2">
                {type.measurementType === "quantity" ? t("measurementQuantity") : t("measurementWeight")}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFlourTypes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              {searchTerm ? t("productEmptySearch") : t("productEmpty")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
