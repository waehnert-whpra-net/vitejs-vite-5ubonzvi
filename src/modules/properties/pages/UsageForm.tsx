import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { usePropertyUsage, usePropertyUnits, useSavePropertyUsage } from '@/modules/properties/hooks/useProperties'
import { useContacts } from '@/hooks/useContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Search } from 'lucide-react'


const RENTAL_PERIODS = ['pro Woche', 'pro Monat', 'einmalig', 'pro Tag', 'pro Nacht']

  export default function UsageForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const fromCalendar = location.state?.from === 'calendar'
  const calendarDate = location.state?.calendarDate
  const isEdit = !!id
  const { data: existing } = usePropertyUsage(id ?? '')
  const { data: unitsResult } = usePropertyUnits()
  const { data: contactsResult } = useContacts('', 0, 1000)
  const saveUsage = useSavePropertyUsage()

  const units = unitsResult ?? []
  const contacts = contactsResult?.data ?? []

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [unitSearch, setUnitSearch] = useState('')

  const [form, setForm] = useState({
    unit_id: '',
    contact_id: '',
    is_unlimited: false,
    rental_period: 'pro Woche',
    date_from: '',
    date_to: '',
    rent_actual: '',
    handover_date: '',
    handover_time: '',
    handover_notes: '',
    return_date: '',
    return_time: '',
    return_notes: '',
    children_count: '0',
    adults_count: '0',
    is_active: true,
    is_future: false,
    notes: '',
    show_in_calendar: true,
    calendar_comment: '',
  })

  useEffect(() => {
    if (!existing) return
    setForm({
      unit_id: existing.unit_id ?? '',
      contact_id: existing.contact_id ?? '',
      is_unlimited: existing.is_unlimited ?? false,
      rental_period: existing.rental_period ?? 'pro Woche',
      date_from: existing.date_from ?? '',
      date_to: existing.date_to ?? '',
      rent_actual: existing.rent_actual?.toString() ?? '',
      handover_date: existing.handover_date ?? '',
      handover_time: existing.handover_time ?? '',
      handover_notes: existing.handover_notes ?? '',
      return_date: existing.return_date ?? '',
      return_time: existing.return_time ?? '',
      return_notes: existing.return_notes ?? '',
      children_count: existing.children_count?.toString() ?? '0',
      adults_count: existing.adults_count?.toString() ?? '0',
      is_active: existing.is_active ?? true,
      is_future: existing.is_future ?? false,
      notes: existing.notes ?? '',
      show_in_calendar: existing.show_in_calendar ?? true,
      calendar_comment: existing.calendar_comment ?? '',
    })
  }, [existing])

  const set = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

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

  const filteredContacts = contacts.filter(c => {
    const name = c.is_company
      ? c.company_name ?? ''
      : [c.first_name, c.last_name].filter(Boolean).join(' ')
    return name.toLowerCase().includes(contactSearch.toLowerCase())
  })

  const filteredUnits = units.filter(u =>
    u.name?.toLowerCase().includes(unitSearch.toLowerCase()) ||
    u.short_code?.toLowerCase().includes(unitSearch.toLowerCase()) ||
    u.location?.toLowerCase().includes(unitSearch.toLowerCase())
  )

  const getContactName = (id: string) => {
    const c = contacts.find(c => c.id === id)
    if (!c) return ''
    return c.is_company
      ? c.company_name ?? ''
      : [c.first_name, c.last_name].filter(Boolean).join(' ')
  }

  const getUnitName = (id: string) => {
    const u = units.find(u => u.id === id)
    if (!u) return ''
    return `${u.short_code ? `[${u.short_code}] ` : ''}${u.name ?? u.location ?? ''}`
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveUsage.mutateAsync({
        ...(isEdit ? { id } : {}),
        unit_id: form.unit_id || null,
        contact_id: form.contact_id || null,
        is_unlimited: form.is_unlimited,
        rental_period: form.rental_period || null,
        date_from: form.date_from || null,
        date_to: form.is_unlimited ? null : (form.date_to || null),
        rent_actual: form.rent_actual ? parseFloat(form.rent_actual) : null,
        handover_date: form.handover_date || null,
        handover_time: form.handover_time || null,
        handover_notes: form.handover_notes || null,
        return_date: form.return_date || null,
        return_time: form.return_time || null,
        return_notes: form.return_notes || null,
        children_count: parseInt(form.children_count) || 0,
        adults_count: parseInt(form.adults_count) || 0,
        is_active: form.is_active,
        is_future: form.is_future,
        notes: form.notes || null,
        show_in_calendar: form.show_in_calendar,
        calendar_comment: form.calendar_comment || null,
      })
      navigate('/properties/usages')
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      {/* Header */}
<div className="flex items-center gap-4 mb-6">
  <Button
  variant="ghost"
  size="icon"
  onClick={() => fromCalendar
    ? navigate('/calendar', { state: { calendarDate } })
    : navigate('/properties/usages')
  }
>
  <ArrowLeft className="h-4 w-4" />
</Button>
  <div>
    <h1 className="text-3xl font-bold text-gray-900">
      {isEdit ? 'Nutzung bearbeiten' : 'Neue Nutzung'}
    </h1>
    {fromCalendar && (
  <button
    onClick={() => navigate('/calendar', { state: { calendarDate } })}
    className="text-sm text-blue-600 hover:underline mt-0.5"
  >
    ← Zurück zum Kalender
  </button>
)}
  </div>
</div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6">

        {/* Einheit & Nutzer */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Einheit & Nutzer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Einheit */}
            <div>
              <Label>Einheit *</Label>
              <div className="mt-1 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Einheit suchen..."
                    value={unitSearch}
                    onChange={e => setUnitSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {form.unit_id && (
                  <div className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">
                    ✅ {getUnitName(form.unit_id)}
                  </div>
                )}
                {unitSearch && (
                  <div className="border rounded-md bg-white shadow-sm max-h-48 overflow-y-auto">
                    {filteredUnits.slice(0, 20).map(u => (
                      <button
                        key={u.id}
                        onClick={() => { set('unit_id', u.id); setUnitSearch('') }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                      >
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {u.short_code}
                        </span>
                        <span className="font-medium">{u.name ?? u.location}</span>
                        {u.area && (
                          <span className="text-gray-400 ml-2 text-xs">{u.area.name}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Nutzer/Kontakt */}
            <div>
              <Label>Nutzer (Kontakt)</Label>
              <div className="mt-1 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Kontakt suchen..."
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {form.contact_id && (
                  <div className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">
                    ✅ {getContactName(form.contact_id)}
                  </div>
                )}
                {contactSearch && (
                  <div className="border rounded-md bg-white shadow-sm max-h-48 overflow-y-auto">
                    {filteredContacts.slice(0, 20).map(c => (
                      <button
                        key={c.id}
                        onClick={() => { set('contact_id', c.id); setContactSearch('') }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                      >
                        <span className="font-medium">
                          {c.is_company
                            ? c.company_name
                            : [c.first_name, c.last_name].filter(Boolean).join(' ')}
                        </span>
                        {c.email_main && (
                          <span className="text-gray-400 ml-2 text-xs">{c.email_main}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zeitraum */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Zeitraum & Konditionen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-6 pt-1">
              <ToggleButton field="is_unlimited" label="Unbefristet" />
              <ToggleButton field="is_future" label="In Zukunft" />
              <ToggleButton field="is_active" label="Aktiv" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Zeitraum</Label>
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
                <Label>Miete IST (€)</Label>
                <Input className="mt-1" type="number" placeholder="z.B. 350"
                  value={form.rent_actual} onChange={e => set('rent_actual', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Von</Label>
                <Input className="mt-1" type="date"
                  value={form.date_from} onChange={e => set('date_from', e.target.value)} />
              </div>
              <div>
                <Label>Bis {form.is_unlimited && '(unbefristet – wird ignoriert)'}</Label>
                <Input className="mt-1" type="date"
                  value={form.date_to}
                  onChange={e => set('date_to', e.target.value)}
                  disabled={form.is_unlimited}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personen */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Personen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Erwachsene (14–90)</Label>
                <Input className="mt-1" type="number" min="0"
                  value={form.adults_count} onChange={e => set('adults_count', e.target.value)} />
              </div>
              <div>
                <Label>Kinder (4–13)</Label>
                <Input className="mt-1" type="number" min="0"
                  value={form.children_count} onChange={e => set('children_count', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Übergabe */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Übergabe</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Übergabe am</Label>
                <Input className="mt-1" type="date"
                  value={form.handover_date} onChange={e => set('handover_date', e.target.value)} />
              </div>
              <div>
                <Label>Übergabe um</Label>
                <Input className="mt-1" type="time"
                  value={form.handover_time} onChange={e => set('handover_time', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Übergabe Bemerkungen</Label>
              <textarea
                className="mt-1 w-full min-h-16 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.handover_notes}
                onChange={e => set('handover_notes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rückgabe */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Rückgabe</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rückgabe am</Label>
                <Input className="mt-1" type="date"
                  value={form.return_date} onChange={e => set('return_date', e.target.value)} />
              </div>
              <div>
                <Label>Rückgabe um</Label>
                <Input className="mt-1" type="time"
                  value={form.return_time} onChange={e => set('return_time', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Rückgabe Bemerkungen</Label>
              <textarea
                className="mt-1 w-full min-h-16 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.return_notes}
                onChange={e => set('return_notes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Kalender */}
<Card>
  <CardHeader><CardTitle className="text-lg">Kalender</CardTitle></CardHeader>
  <CardContent className="space-y-4">
    <ToggleButton field="show_in_calendar" label="Im Kalender anzeigen" />
    <div>
      <Label>Kommentar im Kalender</Label>
      <textarea
        className="mt-1 w-full min-h-16 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Wird im Kalender angezeigt..."
        value={form.calendar_comment}
        onChange={e => set('calendar_comment', e.target.value)}
      />
    </div>
  </CardContent>
</Card>

{/* Notizen */}
<Card>
  <CardHeader><CardTitle className="text-lg">Bemerkungen</CardTitle></CardHeader>
  <CardContent>
    <textarea
      className="w-full min-h-24 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      placeholder="Interne Bemerkungen zur Nutzung..."
      value={form.notes}
      onChange={e => set('notes', e.target.value)}
    />
  </CardContent>
</Card>

        {/* Speichern */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate('/properties/usages')}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Wird gespeichert...' : 'Nutzung speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}