import { useState } from 'react'
import { useDocumentTemplates, useSaveDocumentTemplate, useDeleteDocumentTemplate } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Save, X, FileText, FolderOpen } from 'lucide-react'

type TemplateForm = {
  id?: string
  name: string
  description: string
  onedrive_path: string
  category: string
  sort_order: string
}

const emptyForm = (): TemplateForm => ({
  name: '',
  description: '',
  onedrive_path: '',
  category: '',
  sort_order: '0',
})

export default function OptionsPage() {
  const { data: templates, isLoading } = useDocumentTemplates()
  const saveTemplate = useSaveDocumentTemplate()
  const deleteTemplate = useDeleteDocumentTemplate()

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const startNew = () => {
    setForm(emptyForm())
    setEditingId('new')
    setError(null)
  }

  const startEdit = (t: any) => {
    setForm({
      id: t.id,
      name: t.name,
      description: t.description ?? '',
      onedrive_path: t.onedrive_path,
      category: t.category ?? '',
      sort_order: t.sort_order?.toString() ?? '0',
    })
    setEditingId(t.id)
    setError(null)
  }

  const cancel = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  const handleSave = async () => {
    if (!form.name || !form.onedrive_path) {
      setError('Name und OneDrive-Pfad sind Pflichtfelder')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveTemplate.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        description: form.description || null,
        onedrive_path: form.onedrive_path,
        category: form.category || null,
        sort_order: parseInt(form.sort_order) || 0,
      })
      cancel()
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Template "${name}" wirklich löschen?`)) {
      await deleteTemplate.mutateAsync(id)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Optionen</h1>

      {/* Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Dokument-Templates
            </CardTitle>
            {editingId === null && (
              <Button onClick={startNew} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Neues Template
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Hinweis zum Pfad-Format */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">OneDrive-Pfad-Format:</p>
            <p className="font-mono text-xs">/FLOX/Templates/Mietvertrag.docx</p>
            <p className="mt-1 text-xs">
              Pfad relativ zum Stammverzeichnis des OneDrive-Accounts von {' '}
              <span className="font-medium">waehnert@whp-rae.de</span>.
              Ordner und Datei müssen dort bereits existieren.
            </p>
          </div>

          {/* Formular für neues/bearbeitetes Template */}
          {editingId !== null && (
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
              <h3 className="font-medium text-gray-900">
                {editingId === 'new' ? 'Neues Template' : 'Template bearbeiten'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input className="mt-1 bg-white" placeholder="z.B. Mietvertrag"
                    value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <Label>Kategorie</Label>
                  <Input className="mt-1 bg-white" placeholder="z.B. Mietrecht"
                    value={form.category} onChange={e => set('category', e.target.value)} />
                </div>
              </div>

              <div>
                <Label>OneDrive-Pfad *</Label>
                <div className="relative mt-1">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-10 bg-white font-mono text-sm"
                    placeholder="/FLOX/Templates/Mietvertrag.docx"
                    value={form.onedrive_path}
                    onChange={e => set('onedrive_path', e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Beschreibung</Label>
                <textarea
                  className="mt-1 w-full min-h-16 p-3 rounded-md border border-input bg-white text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Wofür wird dieses Template verwendet?"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              <div className="w-24">
                <Label>Reihenfolge</Label>
                <Input className="mt-1 bg-white" type="number" min="0"
                  value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Speichern...' : 'Speichern'}
                </Button>
                <Button onClick={cancel} variant="outline" size="sm" className="gap-2">
                  <X className="h-4 w-4" />
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Template-Liste */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && templates?.length === 0 && editingId === null && (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Noch keine Templates angelegt</p>
            </div>
          )}

          {templates?.map(t => (
            <div key={t.id}
              className={`border rounded-lg p-4 flex items-center gap-4 ${editingId === t.id ? 'opacity-50' : 'hover:shadow-sm'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{t.name}</span>
                  {t.category && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {t.category}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{t.description}</p>
                )}
                <p className="text-xs font-mono text-gray-400 mt-0.5 truncate">{t.onedrive_path}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => startEdit(t)} title="Bearbeiten">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon"
                  onClick={() => handleDelete(t.id, t.name)}
                  className="text-destructive hover:text-destructive"
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
