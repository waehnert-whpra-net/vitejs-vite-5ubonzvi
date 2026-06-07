import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePropertyArea, useSavePropertyArea } from '@/modules/properties/hooks/useProperties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save } from 'lucide-react'

export default function AreaForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { data: existing } = usePropertyArea(id ?? '')
  const saveArea = useSavePropertyArea()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nr: '',
    name: '',
    display_name: '',
    description: '',
    symbol: '',
    color: '#e5e7eb',
    is_outdoor: false,
    sort_order: '0',
  })

  useEffect(() => {
    if (!existing) return
    setForm({
      nr: existing.nr?.toString() ?? '',
      name: existing.name ?? '',
      display_name: existing.display_name ?? '',
      description: existing.description ?? '',
      symbol: existing.symbol ?? '',
      color: existing.color ?? '#e5e7eb',
      is_outdoor: existing.is_outdoor ?? false,
      sort_order: existing.sort_order?.toString() ?? '0',
    })
  }, [existing])

  const set = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveArea.mutateAsync({
        ...(isEdit ? { id } : {}),
        nr: form.nr ? parseInt(form.nr) : undefined,
        name: form.name,
        display_name: form.display_name || form.name,
        description: form.description || null,
        symbol: form.symbol || null,
        color: form.color || null,
        is_outdoor: form.is_outdoor,
        sort_order: parseInt(form.sort_order) || 0,
      })
      navigate('/properties/areas')
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties/areas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEdit ? 'Bereich bearbeiten' : 'Neuer Bereich'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {/* Basisdaten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basisdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nummer</Label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="z.B. 1"
                  value={form.nr}
                  onChange={e => set('nr', e.target.value)}
                />
              </div>
              <div>
                <Label>Sortierung</Label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="0"
                  value={form.sort_order}
                  onChange={e => set('sort_order', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Name *</Label>
              <Input
                className="mt-1"
                placeholder="z.B. Haupthaus"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            <div>
              <Label>Anzeigename</Label>
              <Input
                className="mt-1"
                placeholder="z.B. Haupthaus (wird Name verwendet wenn leer)"
                value={form.display_name}
                onChange={e => set('display_name', e.target.value)}
              />
            </div>

            <div>
              <Label>Beschreibung</Label>
              <textarea
                className="mt-1 w-full min-h-20 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Kurze Beschreibung des Bereichs..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Darstellung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Darstellung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Farbe</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => set('color', e.target.value)}
                    className="h-10 w-16 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={form.color}
                    onChange={e => set('color', e.target.value)}
                    placeholder="#e5e7eb"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Symbol</Label>
                <Input
                  className="mt-1"
                  placeholder="z.B. home, building"
                  value={form.symbol}
                  onChange={e => set('symbol', e.target.value)}
                />
              </div>
            </div>

            {/* Vorschau */}
            <div>
              <Label className="mb-2 block">Vorschau</Label>
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: form.color }}
              >
                {form.name.slice(0, 2).toUpperCase() || '?'}
              </div>
            </div>

            {/* Außenbereich Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('is_outdoor', !form.is_outdoor)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${form.is_outdoor ? 'bg-blue-600' : 'bg-gray-200'}
                `}
              >
                <span className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${form.is_outdoor ? 'translate-x-6' : 'translate-x-1'}
                `} />
              </button>
              <Label>Außenbereich</Label>
            </div>
          </CardContent>
        </Card>

        {/* Speichern */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate('/properties/areas')}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Wird gespeichert...' : 'Bereich speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}