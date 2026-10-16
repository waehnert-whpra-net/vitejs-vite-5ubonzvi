import { useState, useRef } from 'react'
import { useImportPatterns, useSaveImportPattern, useDeleteImportPattern, useAccountTypes } from '@/hooks/useAccounting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Save, X, Upload, ArrowRight, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import type { ImportPattern, FieldMapping } from '@/hooks/useAccounting'

const TARGET_FIELDS = [
  { key: 'booking_date', label: 'Buchungstag' },
  { key: 'amount', label: 'Buchungsbetrag' },
  { key: 'counterpart_name', label: 'Empfänger/Absender Name' },
  { key: 'counterpart_iban', label: 'Empfänger/Absender IBAN' },
  { key: 'purpose', label: 'Verwendungszweck' },
  { key: 'notes', label: 'Anmerkungen' },
]

const IGNORE = '__ignore__'

type PatternForm = {
  id?: string
  name: string
  account_type_id: string
  delimiter: string
  skip_rows: string
  notes: string
  field_mappings: FieldMapping[]
}

const emptyForm = (): PatternForm => ({
  name: '', account_type_id: '', delimiter: ';', skip_rows: '1', notes: '', field_mappings: []
})

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

export default function ImportPatternsPage() {
  const { data: patterns, isLoading } = useImportPatterns()
  const { data: accountTypes } = useAccountTypes()
  const save = useSaveImportPattern()
  const del = useDeleteImportPattern()

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<PatternForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CSV Beispiel
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const startNew = () => { setForm(emptyForm()); setEditingId('new'); setError(null); setCsvHeaders([]); setCsvPreview([]) }

  const startEdit = (p: ImportPattern) => {
    setForm({
      id: p.id, name: p.name, account_type_id: p.account_type_id ?? '',
      delimiter: p.delimiter, skip_rows: p.skip_rows.toString(),
      notes: p.notes ?? '', field_mappings: p.field_mappings ?? []
    })
    setEditingId(p.id); setError(null); setCsvHeaders([]); setCsvPreview([])
  }

  const cancel = () => { setEditingId(null); setForm(emptyForm()); setError(null); setCsvHeaders([]); setCsvPreview([]) }

  const loadCsvExample = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim())
      if (lines.length === 0) return
      const headers = parseCsvRow(lines[0], form.delimiter)
      setCsvHeaders(headers)
      const preview = lines.slice(1, 4).map(l => parseCsvRow(l, form.delimiter))
      setCsvPreview(preview)
      // Initiale Mappings anlegen (alle auf ignore)
      if (form.field_mappings.length === 0) {
        setForm(prev => ({
          ...prev,
          field_mappings: TARGET_FIELDS.map(tf => ({
            target_field: tf.key,
            source_fields: [],
            separator: ' '
          }))
        }))
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  // Mapping für ein Zielfeld aktualisieren
  const updateMapping = (targetField: string, sourceIndex: number, action: 'add' | 'remove' | 'move_up' | 'move_down') => {
    setForm(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.map(m => {
        if (m.target_field !== targetField) return m
        let fields = [...m.source_fields]
        if (action === 'add' && !fields.includes(sourceIndex)) fields.push(sourceIndex)
        else if (action === 'remove') fields = fields.filter(f => f !== sourceIndex)
        else if (action === 'move_up') {
          const idx = fields.indexOf(sourceIndex)
          if (idx > 0) { [fields[idx-1], fields[idx]] = [fields[idx], fields[idx-1]] }
        }
        else if (action === 'move_down') {
          const idx = fields.indexOf(sourceIndex)
          if (idx < fields.length - 1) { [fields[idx], fields[idx+1]] = [fields[idx+1], fields[idx]] }
        }
        return { ...m, source_fields: fields }
      })
    }))
  }

  const updateSeparator = (targetField: string, separator: string) => {
    setForm(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.map(m =>
        m.target_field === targetField ? { ...m, separator } : m
      )
    }))
  }

  const handleSave = async () => {
    if (!form.name) { setError('Name ist Pflichtfeld'); return }
    setSaving(true); setError(null)
    try {
      await save.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        account_type_id: form.account_type_id || null,
        delimiter: form.delimiter,
        skip_rows: parseInt(form.skip_rows) || 1,
        notes: form.notes || null,
        field_mappings: form.field_mappings,
      })
      cancel()
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Muster "${name}" wirklich löschen?`)) await del.mutateAsync(id)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Importmuster</h1>
          <p className="text-gray-500 mt-1">CSV-Importmuster verwalten</p>
        </div>
        {editingId === null && (
          <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" />Neues Muster</Button>
        )}
      </div>

      <div className="grid gap-5">
        {/* Formular */}
        {editingId !== null && (
          <Card className="border-2 border-blue-200">
            <CardHeader><CardTitle className="text-base">{editingId === 'new' ? 'Neues Importmuster' : 'Muster bearbeiten'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Grunddaten */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input className="mt-1" placeholder="z.B. Sparkasse Girokonto" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <Label>Kontoart</Label>
                  <Select value={form.account_type_id || IGNORE} onValueChange={v => set('account_type_id', v === IGNORE ? '' : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Kontoart wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>Keine Zuordnung</SelectItem>
                      {accountTypes?.map(at => <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Trennzeichen</Label>
                  <Select value={form.delimiter} onValueChange={v => set('delimiter', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=";">Semikolon (;)</SelectItem>
                      <SelectItem value=",">Komma (,)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kopfzeilen überspringen</Label>
                  <Input className="mt-1" type="number" min="0" value={form.skip_rows} onChange={e => set('skip_rows', e.target.value)} />
                </div>
                <div>
                  <Label>Anmerkungen</Label>
                  <Input className="mt-1" placeholder="Optional" value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>
              </div>

              {/* CSV Beispiel laden */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Feldzuordnung</Label>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" />Beispiel-CSV laden
                  </Button>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={loadCsvExample} />
                </div>

                {csvHeaders.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Lade eine Beispiel-CSV, um die Felder visuell zuzuordnen
                  </p>
                )}

                {csvHeaders.length > 0 && (
                  <div className="space-y-3">
                    {/* Vorschau */}
                    <div className="overflow-x-auto border rounded-md">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-2 py-1 text-left font-medium text-gray-500">#</th>
                            {csvHeaders.map((h, i) => (
                              <th key={i} className="px-2 py-1 text-left font-medium border-l">{h || `Spalte ${i}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, ri) => (
                            <tr key={ri} className="border-t">
                              <td className="px-2 py-1 text-gray-400">{ri+1}</td>
                              {csvHeaders.map((_, ci) => (
                                <td key={ci} className="px-2 py-1 border-l truncate max-w-32">{row[ci] ?? ''}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Feldzuordnung */}
                    <div className="grid gap-2">
                      {TARGET_FIELDS.map(tf => {
                        const mapping = form.field_mappings.find(m => m.target_field === tf.key) ?? { target_field: tf.key, source_fields: [], separator: ' ' }
                        const assigned = mapping.source_fields

                        return (
                          <div key={tf.key} className="border rounded-lg p-3 bg-white">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-900 w-48 flex-shrink-0">{tf.label}</span>
                              <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <div className="flex flex-wrap gap-1 flex-1">
                                {assigned.map((colIdx, pos) => (
                                  <span key={colIdx} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                    <button onClick={() => updateMapping(tf.key, colIdx, 'move_up')} className="hover:text-blue-600" title="Nach vorne"><ChevronUp className="h-3 w-3" /></button>
                                    <span>{csvHeaders[colIdx] || `Sp.${colIdx}`}</span>
                                    <button onClick={() => updateMapping(tf.key, colIdx, 'move_down')} className="hover:text-blue-600" title="Nach hinten"><ChevronDown className="h-3 w-3" /></button>
                                    <button onClick={() => updateMapping(tf.key, colIdx, 'remove')} className="hover:text-red-600 ml-1"><X className="h-3 w-3" /></button>
                                  </span>
                                ))}
                                {assigned.length === 0 && <span className="text-xs text-gray-400">nicht zugeordnet</span>}
                              </div>
                              {assigned.length > 1 && (
                                <Select value={mapping.separator === '' ? '__none__' : mapping.separator} onValueChange={v => updateSeparator(tf.key, v === '__none__' ? '' : v)}>
                                  <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value=" ">Mit Leerzeichen</SelectItem>
                                    <SelectItem value="__none__">Ohne Leerzeichen</SelectItem>
                                    <SelectItem value=", ">Mit Komma</SelectItem>
                                    <SelectItem value=" / ">Mit Slash</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            {/* Spalten-Buttons */}
                            <div className="flex flex-wrap gap-1">
                              {csvHeaders.map((h, i) => (
                                <button
                                  key={i}
                                  onClick={() => updateMapping(tf.key, i, assigned.includes(i) ? 'remove' : 'add')}
                                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                    assigned.includes(i)
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {h || `Sp.${i}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
                  <Save className="h-4 w-4" />{saving ? 'Speichern...' : 'Muster speichern'}
                </Button>
                <Button onClick={cancel} variant="outline" size="sm" className="gap-2">
                  <X className="h-4 w-4" />Abbrechen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liste */}
        {isLoading && [1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        {!isLoading && patterns?.length === 0 && editingId === null && (
          <Card><CardContent className="py-10 text-center text-gray-400">
            <p>Noch keine Importmuster angelegt</p>
          </CardContent></Card>
        )}
        {patterns?.map(p => (
          <Card key={p.id} className={editingId === p.id ? 'opacity-40' : 'hover:shadow-sm'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  {p.account_type && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{p.account_type.name}</span>}
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">Trennzeichen: "{p.delimiter}"</span>
                  <span className="text-xs text-gray-400">{p.field_mappings.filter(m => m.source_fields.length > 0).length} Felder zugeordnet</span>
                </div>
                {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.name)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
