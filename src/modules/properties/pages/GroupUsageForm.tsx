import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  useGroupUsage, useSaveGroupUsage, useSavePropertyUsage, useDeletePropertyUsage,
  useDeleteGroupUsage, useAvailableUnits,
} from '@/modules/properties/hooks/useProperties'
import { useContacts } from '@/hooks/useContacts'
import { useIsAdmin, useIsSuperAdmin } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Save, CalendarDays, Building2,
  Link, FolderOpen, Check, X, Bed, Users, Trash2, Loader2, UserPlus
} from 'lucide-react'

type UnitPersons = { adults: number; children: number; extraBeds: number }

export default function GroupUsageForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id && id !== 'new'

  // Wiederherstellung nach Kontakt anlegen
  const restoredForm: any = location.state?.savedForm
  const restoredUnitPersons: [string, { adults: number; children: number; extraBeds: number }][] | undefined = location.state?.savedUnitPersons
  const newContactId: string | undefined = location.state?.newContactId

  const { data: existing } = useGroupUsage(id ?? '')
  const { data: contactResult } = useContacts('', 0, 200)
  const contacts = contactResult?.data ?? []
  const saveGroup = useSaveGroupUsage()
  const saveUsage = useSavePropertyUsage()
  const deleteUsage = useDeletePropertyUsage()
  const deleteGroup = useDeleteGroupUsage()
  const isAdmin = useIsAdmin()
  const { data: isSuperAdmin } = useIsSuperAdmin()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!id) return
    try {
      setDeleting(true)
      await deleteGroup.mutateAsync(id)
      navigate('/properties/usages')
    } catch (err: any) {
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const [form, setForm] = useState(() => restoredForm
    ? { ...restoredForm, contact_id: newContactId ?? restoredForm.contact_id }
    : {
        name: '',
        contact_id: '',
        date_from: '',
        date_to: '',
        notes: '',
        sharepoint_url: '',
      }
  )

  // Ausgewählte Einheiten: Map unitId → { adults, children, extraBeds }
  const [unitPersons, setUnitPersons] = useState<Map<string, UnitPersons>>(() =>
    restoredUnitPersons ? new Map(restoredUnitPersons) : new Map()
  )
  const [saving, setSaving] = useState(false)

  const { data: availableUnits } = useAvailableUnits(
    form.date_from || null,
    form.date_to || null,
    isEdit ? id : undefined
  )

  useEffect(() => {
    // Nicht überschreiben wenn Formular gerade von Kontakt-Anlegen wiederhergestellt wird
    if (restoredForm) return
    if (existing) {
      setForm({
        name: existing.name ?? '',
        contact_id: existing.contact_id ?? '',
        date_from: existing.date_from ?? '',
        date_to: existing.date_to ?? '',
        notes: existing.notes ?? '',
        sharepoint_url: existing.sharepoint_url ?? '',
      })
      const map = new Map<string, UnitPersons>()
      for (const u of existing.usages ?? []) {
        if (u.unit_id) {
          map.set(u.unit_id, {
            adults: u.adults_count ?? 0,
            children: u.children_count ?? 0,
            extraBeds: (u as any).extra_beds_count ?? 0,
          })
        }
      }
      setUnitPersons(map)
    }
  }, [existing])

  // Einheit auswählen: Standardwert adults = max_persons
  const toggleUnit = (unit: any) => {
    setUnitPersons(prev => {
      const next = new Map(prev)
      if (next.has(unit.id)) {
        next.delete(unit.id)
      } else {
        next.set(unit.id, {
          adults: unit.max_persons ?? 0,
          children: 0,
          extraBeds: 0,
        })
      }
      return next
    })
  }

  // Personenzahl setzen mit Limit-Logik
  const setPersons = (unitId: string, field: 'adults' | 'children' | 'extraBeds', value: number, unit: any) => {
    setUnitPersons(prev => {
      const next = new Map(prev)
      const cur = next.get(unitId)
      if (!cur) return next

      const maxTotal = unit.max_extra_beds ?? unit.max_persons ?? 0
      const maxExtra = (unit.max_extra_beds ?? 0) - (unit.max_persons ?? 0)

      const updated = { ...cur, [field]: Math.max(0, value) }

      // Aufbettungen dürfen die Differenz (max_extra_beds - max_persons) nicht überschreiten
      updated.extraBeds = Math.min(updated.extraBeds, Math.max(0, maxExtra))

      // Summe aller drei darf maxTotal nicht überschreiten
      const total = updated.adults + updated.children + updated.extraBeds
      if (total > maxTotal) {
        // Aktuell geändertes Feld reduzieren
        const overflow = total - maxTotal
        updated[field] = Math.max(0, updated[field] - overflow)
      }

      next.set(unitId, updated)
      return next
    })
  }

  const getContactName = (c: any) => {
    if (!c) return ''
    if (c.is_company) return c.company_name ?? ''
    return [c.first_name, c.last_name].filter(Boolean).join(' ')
  }

  const handleSave = async () => {
    if (!form.name || !form.date_from || !form.date_to) return
    setSaving(true)
    try {
      const groupId = await saveGroup.mutateAsync({
        ...(isEdit ? { id } : {}),
        name: form.name,
        contact_id: form.contact_id || null,
        date_from: form.date_from,
        date_to: form.date_to,
        notes: form.notes || null,
        sharepoint_url: form.sharepoint_url || null,
      })

      const existingUsages = existing?.usages ?? []
      const selectedUnitIds = new Set(unitPersons.keys())

      // Entfernte Einheiten deaktivieren
      for (const u of existingUsages) {
        if (u.unit_id && !selectedUnitIds.has(u.unit_id)) {
          await deleteUsage.mutateAsync(u.id)
        }
      }

      // Neue Einheiten anlegen / bestehende aktualisieren
      for (const [unitId, persons] of unitPersons) {
        const existingUsage = existingUsages.find(u => u.unit_id === unitId)
        if (existingUsage) {
          await saveUsage.mutateAsync({
            id: existingUsage.id,
            adults_count: persons.adults,
            children_count: persons.children,
            extra_beds_count: persons.extraBeds,
          } as any)
        } else {
          await saveUsage.mutateAsync({
            unit_id: unitId,
            contact_id: form.contact_id || null,
            group_usage_id: groupId,
            date_from: form.date_from,
            date_to: form.date_to,
            is_unlimited: false,
            adults_count: persons.adults,
            children_count: persons.children,
            extra_beds_count: persons.extraBeds,
            is_active: true,
            show_in_calendar: true,
          } as any)
        }
      }

      navigate('/properties/usages')
    } finally {
      setSaving(false)
    }
  }

  const dateRangeOk = form.date_from && form.date_to && form.date_from <= form.date_to
  const selectedCount = unitPersons.size

  // Gesamtsummen über alle gewählten Einheiten
  const totals = Array.from(unitPersons.values()).reduce(
    (acc, p) => ({ adults: acc.adults + p.adults, children: acc.children + p.children, extraBeds: acc.extraBeds + p.extraBeds }),
    { adults: 0, children: 0, extraBeds: 0 }
  )

  // Stepper-Hilfsfunktion
  const Stepper = ({
    label, value, onMinus, onPlus, max,
  }: { label: string; value: number; onMinus: () => void; onPlus: () => void; max?: number }) => (
    <div className="flex items-center gap-1.5 flex-1">
      <span className="text-xs text-gray-500 w-22 shrink-0">{label}</span>
      <button
        onClick={onMinus}
        className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-bold leading-none flex items-center justify-center"
      >−</button>
      <span className="w-8 text-center text-sm tabular-nums">{value}</span>
      <button
        onClick={onPlus}
        disabled={max !== undefined && value >= max}
        className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-bold leading-none flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
      >+</button>
      {max !== undefined && (
        <span className="text-xs text-gray-400">/ {max}</span>
      )}
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties/usages')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Gastro-Event bearbeiten' : 'Neues Gastro-Event'}
          </h1>
          <p className="text-sm text-gray-500">Mehrere Einheiten für ein Gastro-Event buchen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Spalte: Stammdaten */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Event-Informationen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Event-Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Hochzeit Müller – Pfingsten 2026"
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Kontakt / Hauptbuchender</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => navigate('/contacts/new', {
                      state: {
                        returnTo: id && id !== 'new' ? `/properties/group-usages/${id}/edit` : '/properties/group-usages/new',
                        returnState: {
                          savedForm: form,
                          savedUnitPersons: Array.from(unitPersons.entries()),
                        },
                      }
                    })}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Neuer Kontakt
                  </Button>
                </div>
                <select
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.contact_id}
                  onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}
                >
                  <option value="">– kein Kontakt –</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{getContactName(c)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Von *</Label>
                  <Input
                    type="date"
                    value={form.date_from}
                    onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Bis *</Label>
                  <Input
                    type="date"
                    value={form.date_to}
                    onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Notizen</Label>
                <textarea
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Besonderheiten, Wünsche, ..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Dokumente / SharePoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-blue-500" />
                Dokumente &amp; Verträge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Link className="h-3.5 w-3.5" />
                  SharePoint-Link (Ordner)
                </Label>
                <Input
                  value={form.sharepoint_url}
                  onChange={e => setForm(f => ({ ...f, sharepoint_url: e.target.value }))}
                  placeholder="https://whpra.sharepoint.com/..."
                  className="mt-1 font-mono text-xs"
                />
                {form.sharepoint_url && (
                  <a
                    href={form.sharepoint_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Ordner öffnen →
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rechte Spalte: Einheitenauswahl */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                Einheiten für dieses Event
                {selectedCount > 0 && (
                  <Badge className="bg-indigo-500 text-white">{selectedCount} gewählt</Badge>
                )}
              </CardTitle>

              {/* Gesamtsumme aller gewählten Einheiten */}
              {selectedCount > 0 && (
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-indigo-400" />
                    <span className="text-indigo-700 font-medium">{totals.adults}</span> Erw.
                  </span>
                  <span>·</span>
                  <span>
                    <span className="text-indigo-700 font-medium">{totals.children}</span> Kinder
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Bed className="h-3 w-3 text-indigo-400" />
                    <span className="text-indigo-700 font-medium">{totals.extraBeds}</span> Aufbettungen
                  </span>
                </div>
              )}

              {!dateRangeOk && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Zuerst Von- und Bis-Datum eingeben, um freie Einheiten zu sehen
                </p>
              )}
            </CardHeader>
            <CardContent>
              {dateRangeOk && availableUnits && (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {availableUnits.map((unit: any) => {
                    const persons = unitPersons.get(unit.id)
                    const selected = !!persons
                    const available = unit.is_available
                    const maxTotal = unit.max_extra_beds ?? unit.max_persons ?? 0
                    const maxExtra = Math.max(0, (unit.max_extra_beds ?? 0) - (unit.max_persons ?? 0))

                    return (
                      <div
                        key={unit.id}
                        className={`
                          rounded-lg border transition-all
                          ${selected
                            ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                            : available
                              ? 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                              : 'border-gray-100 bg-gray-50 opacity-50'
                          }
                        `}
                      >
                        {/* Klickbereich: Kopfzeile */}
                        <button
                          onClick={() => available && toggleUnit(unit)}
                          disabled={!available && !selected}
                          className="w-full text-left p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: unit.color ?? '#94a3b8' }}
                              />
                              <span className="font-medium text-sm">
                                {unit.name ?? unit.short_code ?? '–'}
                              </span>
                              {unit.short_code && unit.name && (
                                <span className="text-xs text-gray-400 font-mono">{unit.short_code}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {unit.max_persons && (
                                <span className="flex items-center gap-1 text-xs text-gray-500" title="Betten / max. Aufbettung">
                                  <Bed className="h-3 w-3" />
                                  {unit.max_persons}
                                  {unit.max_extra_beds > unit.max_persons
                                    ? <span className="text-gray-400">+{unit.max_extra_beds - unit.max_persons}</span>
                                    : null}
                                </span>
                              )}
                              {selected
                                ? <Check className="h-4 w-4 text-indigo-500" />
                                : !available
                                  ? <X className="h-4 w-4 text-red-400" />
                                  : null
                              }
                            </div>
                          </div>
                          {unit.area && (
                            <p className="text-xs text-gray-400 mt-0.5 ml-5">{unit.area.name}</p>
                          )}
                          {!available && !selected && (
                            <p className="text-xs text-red-400 mt-0.5 ml-5">Im Zeitraum belegt</p>
                          )}
                        </button>

                        {/* Personenanzahl — nur wenn ausgewählt */}
                        {selected && persons && (
                          <div
                            className="px-3 pb-3 pt-2 border-t border-indigo-200 space-y-2"
                            onClick={e => e.stopPropagation()}
                          >
                            {/* Hinweis max. Personen */}
                            <p className="text-xs text-gray-400">
                              {unit.max_persons ?? 0} Betten
                              {maxExtra > 0 ? ` + ${maxExtra} Aufbettungen möglich` : ''}
                              {' '}— Summe: {persons.adults + persons.children + persons.extraBeds} / {maxTotal}
                            </p>

                            <Stepper
                              label="Erwachsene"
                              value={persons.adults}
                              onMinus={() => setPersons(unit.id, 'adults', persons.adults - 1, unit)}
                              onPlus={() => setPersons(unit.id, 'adults', persons.adults + 1, unit)}
                              max={maxTotal - persons.children - persons.extraBeds}
                            />
                            <Stepper
                              label="Kinder"
                              value={persons.children}
                              onMinus={() => setPersons(unit.id, 'children', persons.children - 1, unit)}
                              onPlus={() => setPersons(unit.id, 'children', persons.children + 1, unit)}
                              max={maxTotal - persons.adults - persons.extraBeds}
                            />
                            {maxExtra > 0 && (
                              <Stepper
                                label="Aufbettungen"
                                value={persons.extraBeds}
                                onMinus={() => setPersons(unit.id, 'extraBeds', persons.extraBeds - 1, unit)}
                                onPlus={() => setPersons(unit.id, 'extraBeds', persons.extraBeds + 1, unit)}
                                max={Math.min(maxExtra, maxTotal - persons.adults - persons.children)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {dateRangeOk && !availableUnits && (
                <div className="text-center text-gray-400 py-8 text-sm">Lade Einheiten...</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        {/* Links: Löschen (nur Admin/Super-Admin beim Bearbeiten) */}
        <div>
          {(isAdmin || isSuperAdmin) && isEdit && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                  Ja, löschen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Abbrechen
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Event löschen
              </Button>
            )
          )}
        </div>

        {/* Rechts: Abbrechen + Speichern */}
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/properties/usages')}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name || !dateRangeOk}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Wird gespeichert...' : `Event speichern (${selectedCount} Einheiten)`}
          </Button>
        </div>
      </div>
    </div>
  )
}
