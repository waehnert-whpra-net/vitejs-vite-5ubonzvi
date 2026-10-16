import { useState } from 'react'
import { useAccountTypes, useSaveAccountType, useDeleteAccountType } from '@/hooks/useAccounting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Save, X, Building2 } from 'lucide-react'
import type { AccountType } from '@/hooks/useAccounting'

const emptyForm = () => ({ id: undefined as string | undefined, kuerzel: '', name: '', skr_kontonummer: '' })

export default function AccountTypesPage() {
  const { data: accountTypes, isLoading } = useAccountTypes()
  const save = useSaveAccountType()
  const del = useDeleteAccountType()

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const startNew = () => { setForm(emptyForm()); setEditingId('new'); setError(null) }
  const startEdit = (at: AccountType) => {
    setForm({ id: at.id, kuerzel: at.kuerzel, name: at.name, skr_kontonummer: at.skr_kontonummer ?? '' })
    setEditingId(at.id)
    setError(null)
  }
  const cancel = () => { setEditingId(null); setForm(emptyForm()); setError(null) }

  const handleSave = async () => {
    if (!form.kuerzel || !form.name) { setError('Kürzel und Name sind Pflichtfelder'); return }
    setSaving(true); setError(null)
    try {
      await save.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        kuerzel: form.kuerzel,
        name: form.name,
        skr_kontonummer: form.skr_kontonummer || null,
      })
      cancel()
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Kontoart "${name}" wirklich löschen?`)) await del.mutateAsync(id)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontoarten</h1>
          <p className="text-gray-500 mt-1">Geldkontoarten verwalten</p>
        </div>
        {editingId === null && (
          <Button onClick={startNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Neue Kontoart
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {/* Formular */}
        {editingId !== null && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader><CardTitle className="text-base">{editingId === 'new' ? 'Neue Kontoart' : 'Kontoart bearbeiten'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kürzel *</Label>
                  <Input className="mt-1 bg-white" placeholder="z.B. GK" value={form.kuerzel} onChange={e => set('kuerzel', e.target.value)} />
                </div>
                <div>
                  <Label>SKR-Kontonummer</Label>
                  <Input className="mt-1 bg-white" placeholder="z.B. 1200" value={form.skr_kontonummer} onChange={e => set('skr_kontonummer', e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Name *</Label>
                <Input className="mt-1 bg-white" placeholder="z.B. Girokonto" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
                  <Save className="h-4 w-4" />{saving ? 'Speichern...' : 'Speichern'}
                </Button>
                <Button onClick={cancel} variant="outline" size="sm" className="gap-2">
                  <X className="h-4 w-4" />Abbrechen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liste */}
        {isLoading && [1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}

        {!isLoading && accountTypes?.length === 0 && editingId === null && (
          <Card><CardContent className="py-10 text-center text-gray-400">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Noch keine Kontoarten angelegt</p>
          </CardContent></Card>
        )}

        {accountTypes?.map(at => (
          <Card key={at.id} className={editingId === at.id ? 'opacity-40' : 'hover:shadow-sm'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-700">{at.kuerzel}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{at.name}</span>
                {at.skr_kontonummer && <span className="text-xs text-gray-400 ml-2">SKR {at.skr_kontonummer}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => startEdit(at)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(at.id, at.name)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
