import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useArticle, useSaveArticle, netToGross, grossToNet } from '@/modules/documents/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save } from 'lucide-react'

const VAT_RATES = [0, 7, 19]

export default function ArticleForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { data: existing } = useArticle(id ?? '')
  const saveArticle = useSaveArticle()

  const empty = {
    name: '',
    description: '',
    unit: 'Stk.',
    quantity: '1',
    net_price: '',
    gross_price: '',
    vat_rate: '19',
  }

  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Welches Preisfeld zuletzt bearbeitet wurde
  const [priceMode, setPriceMode] = useState<'net' | 'gross'>('gross')

  useEffect(() => {
    if (!existing) return
    setForm({
      name: existing.name,
      description: existing.description ?? '',
      unit: existing.unit ?? 'Stk.',
      quantity: existing.quantity.toString(),
      net_price: existing.net_price != null ? existing.net_price.toString() : '',
      gross_price: existing.gross_price != null ? existing.gross_price.toString() : '',
      vat_rate: existing.vat_rate.toString(),
    })
    setPriceMode(existing.net_price != null && existing.gross_price == null ? 'net' : 'gross')
  }, [existing])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Wenn Netto geändert → Brutto automatisch berechnen
  const handleNetChange = (v: string) => {
    setPriceMode('net')
    set('net_price', v)
    const net = parseFloat(v)
    const vat = parseFloat(form.vat_rate)
    if (!isNaN(net) && !isNaN(vat)) {
      set('gross_price', netToGross(net, vat).toFixed(2))
    } else {
      set('gross_price', '')
    }
  }

  // Wenn Brutto geändert → Netto automatisch berechnen
  const handleGrossChange = (v: string) => {
    setPriceMode('gross')
    set('gross_price', v)
    const gross = parseFloat(v)
    const vat = parseFloat(form.vat_rate)
    if (!isNaN(gross) && !isNaN(vat)) {
      set('net_price', grossToNet(gross, vat).toFixed(2))
    } else {
      set('net_price', '')
    }
  }

  // Bei MwSt-Änderung das zuletzt aktive Feld neu berechnen
  const handleVatChange = (v: string) => {
    set('vat_rate', v)
    const vat = parseFloat(v)
    if (isNaN(vat)) return
    if (priceMode === 'gross') {
      const gross = parseFloat(form.gross_price)
      if (!isNaN(gross)) set('net_price', grossToNet(gross, vat).toFixed(2))
    } else {
      const net = parseFloat(form.net_price)
      if (!isNaN(net)) set('gross_price', netToGross(net, vat).toFixed(2))
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Bezeichnung ist erforderlich'); return }
    setSaving(true); setError(null)
    try {
      await saveArticle.mutateAsync({
        ...(isEdit ? { id } : {}),
        name: form.name.trim(),
        description: form.description.trim() || null,
        unit: form.unit.trim() || null,
        quantity: parseFloat(form.quantity) || 1,
        net_price: form.net_price ? parseFloat(form.net_price) : null,
        gross_price: form.gross_price ? parseFloat(form.gross_price) : null,
        vat_rate: parseFloat(form.vat_rate) || 19,
      })
      navigate('/documents/articles')
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documents/articles')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Artikel bearbeiten' : 'Neuer Artikel'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Allgemein</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Bezeichnung *</Label>
              <Input className="mt-1" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="z.B. Übernachtung Erwachsener" />
            </div>
            <div>
              <Label>Beschreibung (optional)</Label>
              <textarea
                className="mt-1 w-full min-h-16 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Zusätzliche Beschreibung für den Beleg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Standardmenge</Label>
                <Input className="mt-1" type="number" min="0.001" step="0.001"
                  value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </div>
              <div>
                <Label>Einheit</Label>
                <Input className="mt-1" value={form.unit} onChange={e => set('unit', e.target.value)}
                  placeholder="Stk., Nacht, h, …" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preise & MwSt.</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">
              Netto oder Brutto eingeben – das andere Feld wird automatisch berechnet.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>MwSt.-Satz (%)</Label>
              <div className="flex gap-2 mt-1">
                {VAT_RATES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleVatChange(r.toString())}
                    className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      form.vat_rate === r.toString()
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {r} %
                  </button>
                ))}
                <Input
                  className="w-24"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.vat_rate}
                  onChange={e => handleVatChange(e.target.value)}
                  placeholder="Satz"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={priceMode === 'net' ? 'text-blue-700 font-semibold' : ''}>
                  Netto-Einzelpreis (€)
                </Label>
                <Input
                  className={`mt-1 ${priceMode === 'net' ? 'ring-2 ring-blue-300' : ''}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.net_price}
                  onChange={e => handleNetChange(e.target.value)}
                  placeholder="z.B. 56,07"
                />
              </div>
              <div>
                <Label className={priceMode === 'gross' ? 'text-blue-700 font-semibold' : ''}>
                  Brutto-Einzelpreis (€) *
                </Label>
                <Input
                  className={`mt-1 ${priceMode === 'gross' ? 'ring-2 ring-blue-300' : ''}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.gross_price}
                  onChange={e => handleGrossChange(e.target.value)}
                  placeholder="z.B. 60,00"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Das zuletzt bearbeitete Feld ist das primäre (blau markiert). Bei der Übernahme in einen Beleg wird immer der Brutto-Preis verwendet.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/documents/articles')}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}
