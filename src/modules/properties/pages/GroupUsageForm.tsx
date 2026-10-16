import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useGroupUsage, useSaveGroupUsage, useSavePropertyUsage, useDeletePropertyUsage,
  useAvailableUnits, type GroupUsage
} from '@/modules/properties/hooks/useProperties'
import { useContacts } from '@/hooks/useContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Save, Users, CalendarDays, Building2,
  Link, FolderOpen, Check, X, Bed
} from 'lucide-react'

export default function GroupUsageForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id && id !== 'new'

  const { data: existing } = useGroupUsage(id ?? '')
  const { data: contactResult } = useContacts('', 0, 200)
  const contacts = contactResult?.data ?? []
  const saveGroup = useSaveGroupUsage()
  const saveUsage = useSavePropertyUsage()
  const deleteUsage = useDeletePropertyUsage()

  const [form, setForm] = useState({
    name: '',
    contact_id: '',
    date_from: '',
    date_to: '',
    notes: '',
    sharepoint_url: '',
  })

  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const { data: availableUnits } = useAvailableUnits(
    form.date_from || null,
    form.date_to || null,
    isEdit ? id : undefined
  )

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? '',
        contact_id: existing.contact_id ?? '',
        date_from: existing.date_from ?? '',
        date_to: existing.date_to ?? '',
        notes: existing.notes ?? '',
        sharepoint_url: existing.sharepoint_url ?? '',
      })
      const ids = new Set<string>(
        (existing.usages ?? []).map(u => u.unit_id).filter(Boolean) as string[]
      )
      setSelectedUnitIds(ids)
    }
  }, [existing])

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
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

      // Bestehende Einzel-Nutzungen dieser Gruppe ermitteln
      const existingUsages = existing?.usages ?? []
      const existingUnitIds = new Set(existingUsages.map(u => u.unit_id).filter(Boolean) as string[])

      // Entfernte Einheiten löschen
      for (const u of existingUsages) {
        if (u.unit_id && !selectedUnitIds.has(u.unit_id)) {
          await deleteUsage.mutateAsync(u.id)
        }
      }

      // Neue Einheiten anlegen
      for (const unitId of selectedUnitIds) {
        if (!existingUnitIds.has(unitId)) {
          await saveUsage.mutateAsync({
            unit_id: unitId,
            contact_id: form.contact_id || null,
            group_usage_id: groupId,
            date_from: form.date_from,
            date_to: form.date_to,
            is_unlimited: false,
            adults_count: 0,
            children_count: 0,
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties/usages')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Gruppennutzung bearbeiten' : 'Neue Gruppennutzung'}
          </h1>
          <p className="text-sm text-gray-500">Mehrere Einheiten für eine Gruppe buchen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Spalte: Stammdaten */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Gruppeninformationen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Gruppenname *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Familie Müller – Pfingsten 2026"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Kontakt / Hauptbuchender</Label>
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
                Einheiten auswählen
                {selectedUnitIds.size > 0 && (
                  <Badge className="bg-indigo-500 text-white">{selectedUnitIds.size} gewählt</Badge>
                )}
              </CardTitle>
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
                    const selected = selectedUnitIds.has(unit.id)
                    const available = unit.is_available
                    return (
                      <button
                        key={unit.id}
                        onClick={() => available && toggleUnit(unit.id)}
                        disabled={!available && !selected}
                        className={`
                          w-full text-left rounded-lg border p-3 transition-all
                          ${selected
                            ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                            : available
                              ? 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 cursor-pointer'
                              : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          }
                        `}
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
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Bed className="h-3 w-3" />
                                {unit.max_persons}
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
        <Button variant="outline" onClick={() => navigate('/properties/usages')}>
          Abbrechen
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !form.name || !dateRangeOk}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Wird gespeichert...' : `Gruppe speichern (${selectedUnitIds.size} Einheiten)`}
        </Button>
      </div>
    </div>
  )
}
