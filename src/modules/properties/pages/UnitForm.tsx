import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePropertyUnit, usePropertyAreas, useSavePropertyUnit } from '@/modules/properties/hooks/useProperties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'

const RENTAL_PERIODS = ['pro Woche', 'pro Monat', 'einmalig', 'pro Tag', 'pro Nacht']
const CLEANING_STATUSES = ['gereinigt', 'zu reinigen', 'in Reinigung']
const CLEANING_CYCLES = ['bei Auszug', 'auf Anweisung', 'wöchentlich', 'täglich']

export default function UnitForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { data: existing } = usePropertyUnit(id ?? '')
  const { data: areas } = usePropertyAreas()
  const saveUnit = useSavePropertyUnit()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nr: '',
    name: '',
    short_code: '',
    short_code_old: '',
    area_id: '',
    location: '',
    location_geo: '',
    rental_period: 'pro Woche',
    cleaning_status: '',
    cleaning_cycle: '',
    cleaning_notes: '',
    rent_target: '',
    daily_rate_per_person: '',
    rent_calculated_weekly: '',
    rent_total: '',
    rent_cold: '',
    operating_costs: '',
    heating_costs: '',
    land_price_share: '',
    color: '',
    rooms: '',
    max_persons: '',
    sqm_measured: '',
    has_terrace: false,
    has_garden: false,
    is_rentable: true,
    rooms_with_wc: '',
    max_extra_beds: '',
    extra_beds_delivery: '',
    extra_beds_couch: '',
    magic_plan: '',
    floor_plan: '',
    notes: '',
  })

  useEffect(() => {
    if (!existing) return
    setForm({
      nr: existing.nr?.toString() ?? '',
      name: existing.name ?? '',
      short_code: existing.short_code ?? '',
      short_code_old: existing.short_code_old ?? '',
      area_id: existing.area_id ?? '',
      location: existing.location ?? '',
      location_geo: existing.location_geo ?? '',
      rental_period: existing.rental_period ?? 'pro Woche',
      cleaning_status: existing.cleaning_status ?? '',
      cleaning_cycle: existing.cleaning_cycle ?? '',
      cleaning_notes: existing.cleaning_notes ?? '',
      rent_target: existing.rent_target?.toString() ?? '',
      daily_rate_per_person: existing.daily_rate_per_person?.toString() ?? '',
      rent_calculated_weekly: existing.rent_calculated_weekly?.toString() ?? '',
      rent_total: existing.rent_total?.toString() ?? '',
      rent_cold: existing.rent_cold?.toString() ?? '',
      operating_costs: existing.operating_costs?.toString() ?? '',
      heating_costs: existing.heating_costs?.toString() ?? '',
      land_price_share: existing.land_price_share?.toString() ?? '',
      color: existing.color ?? '',
      rooms: existing.rooms?.toString() ?? '',
      max_persons: existing.max_persons?.toString() ?? '',
      sqm_measured: existing.sqm_measured?.toString() ?? '',
      has_terrace: existing.has_terrace ?? false,
      has_garden: existing.has_garden ?? false,
      is_rentable: existing.is_rentable ?? true,
      rooms_with_wc: existing.rooms_with_wc?.toString() ?? '',
      max_extra_beds: existing.max_extra_beds?.toString() ?? '',
      extra_beds_delivery: existing.extra_beds_delivery?.toString() ?? '',
      extra_beds_couch: existing.extra_beds_couch?.toString() ?? '',
      magic_plan: existing.magic_plan ?? '',
      floor_plan: existing.floor_plan ?? '',
      notes: existing.notes ?? '',
    })
  }, [existing])

  const set = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const num = (val: string) => val ? parseFloat(val) : null
  const int = (val: string) => val ? parseInt(val) : null

  const toggle = (field: string) =>
    setForm(prev => ({ ...prev, [field]: !prev[field as keyof typeof prev] }))

  const ToggleButton = ({ field, label }: { field: string; label: string }) => (
    <div className="flex items-center gap-3">
      <button
        onClick={() => toggle(field)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${form[field as keyof typeof form] ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span className={`
          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
          ${form[field as keyof typeof form] ? 'translate-x-6' : 'translate-x-1'}
        `} />
      </button>
      <Label>{label}</Label>
    </div>
  )

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveUnit.mutateAsync({
        ...(isEdit ? { id } : {}),
        nr: int(form.nr),
        name: form.name || null,
        short_code: form.short_code || null,
        short_code_old: form.short_code_old || null,
        area_id: form.area_id || null,
        location: form.location || null,
        location_geo: form.location_geo || null,
        rental_period: form.rental_period || null,
        cleaning_status: form.cleaning_status || null,
        cleaning_cycle: form.cleaning_cycle || null,
        cleaning_notes: form.cleaning_notes || null,
        rent_target: num(form.rent_target),
        daily_rate_per_person: num(form.daily_rate_per_person),
        rent_calculated_weekly: num(form.rent_calculated_weekly),
        rent_total: num(form.rent_total),
        rent_cold: num(form.rent_cold),
        operating_costs: num(form.operating_costs),
        heating_costs: num(form.heating_costs),
        land_price_share: num(form.land_price_share),
        color: form.color || null,
        rooms: int(form.rooms),
        max_persons: int(form.max_persons),
        sqm_measured: num(form.sqm_measured),
        has_terrace: form.has_terrace,
        has_garden: form.has_garden,
        is_rentable: form.is_rentable,
        rooms_with_wc: int(form.rooms_with_wc),
        max_extra_beds: int(form.max_extra_beds),
        extra_beds_delivery: int(form.extra_beds_delivery),
        extra_beds_couch: int(form.extra_beds_couch),
        magic_plan: form.magic_plan || null,
        floor_plan: form.floor_plan || null,
        notes: form.notes || null,
      })
      navigate('/properties/units')
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties/units')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEdit ? 'Einheit bearbeiten' : 'Neue Einheit'}
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
          <CardHeader><CardTitle className="text-lg">Basisdaten</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nummer</Label>
                <Input className="mt-1" type="number" placeholder="z.B. 1"
                  value={form.nr} onChange={e => set('nr', e.target.value)} />
              </div>
              <div>
                <Label>Kürzel</Label>
                <Input className="mt-1" placeholder="z.B. B101"
                  value={form.short_code} onChange={e => set('short_code', e.target.value)} />
              </div>
              <div>
                <Label>Kürzel alt</Label>
                <Input className="mt-1" placeholder="Altes Kürzel"
                  value={form.short_code_old} onChange={e => set('short_code_old', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input className="mt-1" placeholder="z.B. Bella"
                  value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <Label>Bereich *</Label>
                <Select value={form.area_id} onValueChange={v => set('area_id', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Bereich wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas?.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lage</Label>
                <Input className="mt-1" placeholder="z.B. 1. OG 1. Einheit"
                  value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
              <div>
                <Label>Lage (geo)</Label>
                <Input className="mt-1" placeholder="z.B. 1. OG Nord"
                  value={form.location_geo} onChange={e => set('location_geo', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eigenschaften */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Eigenschaften</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Zimmer</Label>
                <Input className="mt-1" type="number" placeholder="z.B. 2"
                  value={form.rooms} onChange={e => set('rooms', e.target.value)} />
              </div>
              <div>
                <Label>Max. Personen</Label>
                <Input className="mt-1" type="number" placeholder="z.B. 4"
                  value={form.max_persons} onChange={e => set('max_persons', e.target.value)} />
              </div>
              <div>
                <Label>Fläche (m²)</Label>
                <Input className="mt-1" type="number" placeholder="z.B. 44"
                  value={form.sqm_measured} onChange={e => set('sqm_measured', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Zimmer mit WC</Label>
                <Input className="mt-1" type="number"
                  value={form.rooms_with_wc} onChange={e => set('rooms_with_wc', e.target.value)} />
              </div>
              <div>
                <Label>Max. Aufbettung</Label>
                <Input className="mt-1" type="number"
                  value={form.max_extra_beds} onChange={e => set('max_extra_beds', e.target.value)} />
              </div>
              <div>
                <Label>Aufbettung Zustellung</Label>
                <Input className="mt-1" type="number"
                  value={form.extra_beds_delivery} onChange={e => set('extra_beds_delivery', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-2">
              <ToggleButton field="has_terrace" label="Terrasse" />
              <ToggleButton field="has_garden" label="Garten" />
              <ToggleButton field="is_rentable" label="Mietbar" />
            </div>
          </CardContent>
        </Card>

        {/* Preise */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Preise & Konditionen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Zeitraum SOLL</Label>
                <Select value={form.rental_period} onValueChange={v => set('rental_period', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENTAL_PERIODS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Miete SOLL (€)</Label>
                <Input className="mt-1" type="number" placeholder="z.B. 200"
                  value={form.rent_target} onChange={e => set('rent_target', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tagesmiete p.P. SOLL (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.daily_rate_per_person} onChange={e => set('daily_rate_per_person', e.target.value)} />
              </div>
              <div>
                <Label>Berechnet pro Woche (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.rent_calculated_weekly} onChange={e => set('rent_calculated_weekly', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Gesamt (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.rent_total} onChange={e => set('rent_total', e.target.value)} />
              </div>
              <div>
                <Label>Kalt (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.rent_cold} onChange={e => set('rent_cold', e.target.value)} />
              </div>
              <div>
                <Label>Preisanteil Grundstück (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.land_price_share} onChange={e => set('land_price_share', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>BK/HK/Strom (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.operating_costs} onChange={e => set('operating_costs', e.target.value)} />
              </div>
              <div>
                <Label>Heizung (€)</Label>
                <Input className="mt-1" type="number"
                  value={form.heating_costs} onChange={e => set('heating_costs', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reinigung */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Reinigung</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reinigungszustand</Label>
                <Select value={form.cleaning_status} onValueChange={v => set('cleaning_status', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLEANING_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reinigungsturnus</Label>
                <Select value={form.cleaning_cycle} onValueChange={v => set('cleaning_cycle', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Turnus wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLEANING_CYCLES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Reinigung Anmerkungen</Label>
              <textarea
                className="mt-1 w-full min-h-20 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Anmerkungen zur Reinigung..."
                value={form.cleaning_notes}
                onChange={e => set('cleaning_notes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Darstellung */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Darstellung & Referenzen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Farbe</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.color || '#e5e7eb'}
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
                <Label>MagicPlan Referenz</Label>
                <Input className="mt-1" placeholder="z.B. 1301"
                  value={form.magic_plan} onChange={e => set('magic_plan', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Grundriss (Pfad)</Label>
              <Input className="mt-1" placeholder="z.B. M1/Bella.png"
                value={form.floor_plan} onChange={e => set('floor_plan', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Notizen */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Notizen</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full min-h-24 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Interne Notizen zur Einheit..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Speichern */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate('/properties/units')}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Wird gespeichert...' : 'Einheit speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}