import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { usePropertyUsage, usePropertyUnits, usePropertyUsages, useSavePropertyUsage } from '@/modules/properties/hooks/useProperties'
import { useContacts } from '@/hooks/useContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Search, UserPlus } from 'lucide-react'


const RENTAL_PERIODS = ['pro Woche', 'pro Monat', 'einmalig', 'pro Tag', 'pro Tag und Person']

  export default function UsageForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const fromCalendar = location.state?.from === 'calendar'
  const calendarDate = location.state?.calendarDate
  // Wiederherstellung nach Kontakt anlegen: gespeicherter Formularstand + neue contactId
  const restoredForm: Record<string, any> | undefined = location.state?.savedForm
  const newContactId: string | undefined = location.state?.newContactId
  const isEdit = !!id
  const { data: existing } = usePropertyUsage(id ?? '')
  const { data: unitsResult } = usePropertyUnits()
  const { data: allUsagesResult } = usePropertyUsages()
  const { data: contactsResult } = useContacts('', 0, 1000)
  const saveUsage = useSavePropertyUsage()

  const units = unitsResult ?? []
  const allUsages = allUsagesResult ?? []
  const contacts = contactsResult?.data ?? []

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [onlyAvailableUnits, setOnlyAvailableUnits] = useState(false)

  type FormState = {
    unit_id: string
    contact_id: string
    is_unlimited: boolean
    rental_period: string
    date_from: string
    date_to: string
    rent_actual: string
    handover_date: string
    handover_time: string
    handover_notes: string
    return_date: string
    return_time: string
    return_notes: string
    children_count: string
    adults_count: string
    is_active: boolean
    notes: string
    show_in_calendar: boolean
    calendar_comment: string
  }

  const emptyForm: FormState = {
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
    notes: '',
    show_in_calendar: true,
    calendar_comment: '',
  }

  const [form, setForm] = useState<FormState>(() =>
    restoredForm
      ? { ...emptyForm, ...restoredForm, contact_id: newContactId ?? restoredForm.contact_id }
      : emptyForm
  )

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

  // Ermittelt, ob eine Einheit aktuell (heute) anderweitig vermietet/genutzt ist
  const isUnitCurrentlyOccupied = (unitId: string): boolean => {
    const now = new Date()
    return allUsages.some(u => {
      if (u.unit_id !== unitId) return false
      // bei Bearbeitung die eigene Nutzung nicht mitzählen
      if (isEdit && u.id === id) return false

      const from = u.date_from ? new Date(u.date_from) : null
      const to = u.date_to ? new Date(u.date_to) : null

      if (from && from > now) return false // zukünftig -> blockiert "jetzt" nicht
      if (!u.is_unlimited && to && to < now) return false // bereits beendet

      return true // läuft gerade (unbefristet oder im Zeitraum)
    })
  }

  const filteredUnits = units.filter(u => {
    const matchesSearch =
      u.name?.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.short_code?.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.location?.toLowerCase().includes(unitSearch.toLowerCase())

    if (!matchesSearch) return false

    if (onlyAvailableUnits && isUnitCurrentlyOccupied(u.id)) return false

    return true
  })

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

  // Berechnet die Gesamtmiete basierend auf Zeitraum, Datum und Personen
  const calcRent = (): string => {
    const rate = parseFloat(form.rent_actual)
    if (!form.rent_actual || isNaN(rate)) return ''

    const adults = parseInt(form.adults_count) || 0
    const children = parseInt(form.children_count) || 0
    const weightedPersons = adults + children * 0.5

    const from = form.date_from ? new Date(form.date_from) : null
    const to = form.is_unlimited ? null : (form.date_to ? new Date(form.date_to) : null)

    const days = (from && to)
      ? Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
      : null

    switch (form.rental_period) {
      case 'pro Tag und Person':
        if (days == null) return ''
        return (rate * weightedPersons * days).toFixed(2)
      case 'pro Tag':
        if (days == null) return ''
        return (rate * days).toFixed(2)
      case 'pro Woche':
        if (days == null) return rate.toFixed(2)
        return (rate * (days / 7)).toFixed(2)
      case 'pro Monat':
        if (days == null) return rate.toFixed(2)
        return (rate * (days / 30.44)).toFixed(2)
      case 'einmalig':
        return rate.toFixed(2)
      default:
        return ''
    }
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
              <div className="flex items-center justify-between">
                <Label>Einheit *</Label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyAvailableUnits}
                    onChange={e => setOnlyAvailableUnits(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Nur verfügbare Einheiten anzeigen
                </label>
              </div>
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
                  <button
                    type="button"
                    onClick={() => window.open(`/properties/units/${form.unit_id}/edit`, '_blank')}
                    className="w-full text-left text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded transition-colors"
                    title="Einheit in neuem Tab bearbeiten"
                  >
                    ✅ {getUnitName(form.unit_id)}
                  </button>
                )}
                {unitSearch && (
                  <div className="border rounded-md bg-white shadow-sm max-h-48 overflow-y-auto">
                    {filteredUnits.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400">
                        Keine {onlyAvailableUnits ? 'verfügbaren ' : ''}Einheiten gefunden
                      </div>
                    )}
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
              <div className="flex items-center justify-between">
                <Label>Nutzer (Kontakt)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 h-7 text-xs"
                  onClick={() => navigate('/contacts/new', {
                    state: {
                      returnTo: id ? `/properties/usages/${id}/edit` : '/properties/usages/new',
                      returnState: {
                        savedForm: form,
                        ...(fromCalendar ? { from: 'calendar', calendarDate } : {}),
                      },
                    }
                  })}
                  title="Neuen Kontakt anlegen und zurückkehren"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Neuer Nutzer
                </Button>
              </div>
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
                  <button
                    type="button"
                    onClick={() => window.open(`/contacts/${form.contact_id}/edit`, '_blank')}
                    className="w-full text-left text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded transition-colors"
                    title="Kontakt in neuem Tab bearbeiten"
                  >
                    ✅ {getContactName(form.contact_id)}
                  </button>
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
            <div className="pt-1">
              <ToggleButton field="is_unlimited" label="Unbefristet" />
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

            <div>
              <Label>Berechnete Miete (€)</Label>
              <div className="mt-1 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-800 font-medium text-sm min-h-10 flex items-center">
                {calcRent() ? `${calcRent().replace('.', ',')} €` : '–'}
              </div>
              {form.rental_period === 'pro Tag und Person' && (
                <p className="text-xs text-gray-400 mt-1">
                  Kinder zählen mit halbem Satz · Erw. {form.adults_count || 0} + Kinder {form.children_count || 0} × 0,5 = {(
                    (parseInt(form.adults_count) || 0) + (parseInt(form.children_count) || 0) * 0.5
                  )} Pers.
                </p>
              )}
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
