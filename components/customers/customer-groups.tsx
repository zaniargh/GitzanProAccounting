"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Shield } from "lucide-react"
import type { CustomerGroup, AppData } from "@/types"
import { useLang } from "@/components/language-provider"

interface CustomerGroupsProps {
  data: AppData
  onDataChange: (data: AppData) => void
}

export function CustomerGroups({ data, onDataChange }: CustomerGroupsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })
  const { t, lang } = useLang()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingGroup) {
      if (editingGroup.isProtected) {
        alert(t("editGroupProtected"))
        return
      }

      const updatedGroups = data.customerGroups.map((group) =>
        group.id === editingGroup.id ? { ...group, name: formData.name, description: formData.description } : group,
      )
      onDataChange({ ...data, customerGroups: updatedGroups })
    } else {
      const newGroup: CustomerGroup = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        createdAt: new Date().toISOString(),
      }
      onDataChange({
        ...data,
        customerGroups: [...(data.customerGroups || []), newGroup],
      })
    }

    setFormData({ name: "", description: "" })
    setEditingGroup(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (group: CustomerGroup) => {
    if (group.isProtected) {
      alert(t("editGroupProtected"))
      return
    }

    setEditingGroup(group)
    setFormData({ name: group.name, description: group.description || "" })
    setIsDialogOpen(true)
  }

  const handleDelete = (groupId: string) => {
    const group = data.customerGroups.find((g) => g.id === groupId)
    if (group?.isProtected) {
      alert(t("deleteGroupProtected"))
      return
    }

    if (confirm(t("deleteGroupConfirm"))) {
      const updatedGroups = data.customerGroups.filter((group) => group.id !== groupId)
      const updatedCustomers = data.customers.filter((customer) => customer.groupId !== groupId)
      onDataChange({
        ...data,
        customerGroups: updatedGroups,
        customers: updatedCustomers,
      })
    }
  }

  const openAddDialog = () => {
    setEditingGroup(null)
    setFormData({ name: "", description: "" })
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t("customerGroupsTitle")}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 ml-2" />
              {t("newGroup")}
            </Button>
          </DialogTrigger>
          <DialogContent dir={lang === "fa" ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{editingGroup ? t("editGroup") : t("newGroup")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">{t("groupName")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
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
                <Button type="submit">{editingGroup ? t("edit") : t("create")}</Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data.customerGroups || []).map((group) => (
          <Card key={group.id} className={`p-4 ${group.isProtected ? "border-orange-200 bg-orange-50" : ""}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{group.name}</h3>
                {group.isProtected && (
                  <div title={t("protectedGroupTitle")}>
                    <Shield className="h-4 w-4 text-orange-600" />
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(group)}
                  disabled={group.isProtected}
                  title={group.isProtected ? t("editGroupProtected") : t("editGroup")}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(group.id)}
                  disabled={group.isProtected}
                  title={group.isProtected ? t("deleteGroupProtected") : t("deleteGroup")}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {group.description && <p className="text-sm text-muted-foreground mb-2">{group.description}</p>}
            <p className="text-xs text-muted-foreground">
              {t("customerCount")}: {data.customers?.filter((c) => c.groupId === group.id).length || 0}
            </p>
          </Card>
        ))}
      </div>

      {(!data.customerGroups || data.customerGroups.length === 0) && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t("noGroupsDefined")}</p>
        </Card>
      )}
    </div>
  )
}
