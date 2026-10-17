import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  useTransactions, useImportTransactions, useDeleteTransaction,
  useUpdateTransactionNotes, useAccountTypes, useImportPatterns, buildDedupHash
} from '@/hooks/useAccounting'
import { useIsAdmin } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload, Trash2, Search, CheckCircle, Loader2, FileText,
  ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare, BookOpen, Plus, Save, X
} from 'lucide-react'
import type { Transaction, ImportPattern } from '@/hooks/useAccounting'

const ALL = '__all__'

type SortField = 'booking_date' | 'amount' | 'counterpart_name' | 'counterpart_iban' | 'purpose'
type SortDir = 'asc' | 'desc'

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function parseAmount(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : val
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return raw
}

async function applyPattern(rows: string[][], pattern: ImportPattern, accountTypeId: string): Promise<Partial<Transaction>[]> {
  const results: Partial<Transaction>[] = []
  for (const row of rows) {
    const getValue = (targetField: string): string => {
      const mapping = pattern.field_mappings.find(m => m.target_field === targetField)
      if (!mapping || mapping.source_fields.length === 0) return ''
      return mapping.source_fields.map(i => row[i] ?? '').join(mapping.separator)
    }
    const booking_date = parseDate(getValue('booking_date'))
    const amount = parseAmount(getValue('amount'))
    const counterpart_iban = getValue('counterpart_iban')
    const purpose = getValue('purpose')
    const dedup_hash = await buildDedupHash(booking_date ?? '', amount?.toString() ?? '', counterpart_iban, purpose)
    results.push({
      account_type_id: accountTypeId || pattern.account_type_id || undefined,
      booking_date, amount,
      counterpart_name: getValue('counterpart_name'),
      counterpart_iban, purpose,
      notes: getValue('notes'),
      dedup_hash,
    } as any)
  }
  return results
}

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown className="h-3 w-3 text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-blue-600 ml-1 inline" />
    : <ChevronDown className="h-3 w-3 text-blue-600 ml-1 inline" />
}

export default function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortField, setSortField] = useState<SortField>('booking_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchParams] = useSearchParams()
  const initialExpandId = searchParams.get('expand')

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    initialExpandId ? new Set([initialExpandId]) : new Set()
  )

  const { data: transactions, isLoading } = useTransactions({
    account_type_id: accountTypeFilter !== ALL ? accountTypeFilter : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    search: search || undefined,
  })
  const { data: accountTypes } = useAccountTypes()
  const { data: patterns } = useImportPatterns()
  const importTx = useImportTransactions()
  const deleteTx = useDeleteTransaction()
  const updateNotes = useUpdateTransactionNotes()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [bsForTx, setBsForTx] = useState<Record<string, any[]>>({})
  const [bsLoading, setBsLoading] = useState<Record<string, boolean>>({})
  const [bsIncomplete, setBsIncomplete] = useState<Record<string, boolean>>({})
  const [showBsSelect, setShowBsSelect] = useState<string | null>(null)

  // Lokale Anmerkungen-States (key = transaction id)
  const [notesState, setNotesState] = useState<Record<string, string>>({})
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({})

  // Neuer Datensatz
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({
    account_type_id: '', booking_date: new Date().toISOString().split('T')[0],
    amount: '', counterpart_name: '', counterpart_iban: '', purpose: '', notes: ''
  })
  const [savingNew, setSavingNew] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)

  // Import state
  const [showImport, setShowImport] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState('')
  const [importAccountType, setImportAccountType] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<Partial<Transaction>[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPattern) return
    setImportFile(file); setImportResult(null)
    const pattern = patterns?.find(p => p.id === selectedPattern)
    if (!pattern) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, '')
      const lines = text.split('\n').filter(l => l.trim())
      const rows = lines.slice(pattern.skip_rows).map(l => parseCsvRow(l, pattern.delimiter))
      setImportPreview(await applyPattern(rows.slice(0, 5), pattern, importAccountType))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    if (!importFile || !selectedPattern) return
    const pattern = patterns?.find(p => p.id === selectedPattern)
    if (!pattern) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = (ev.target?.result as string).replace(/^\uFEFF/, '')
        const lines = text.split('\n').filter(l => l.trim())
        const rows = lines.slice(pattern.skip_rows).map(l => parseCsvRow(l, pattern.delimiter))
        const txs = await applyPattern(rows, pattern, importAccountType)
        setImportResult(await importTx.mutateAsync({ transactions: txs, importPatternId: selectedPattern }))
      } finally { setImporting(false) }
    }
    reader.readAsText(importFile, 'UTF-8')
  }

  const handleSaveNew = async () => {
    if (!newForm.booking_date || !newForm.amount) {
      setNewError('Buchungstag und Betrag sind Pflichtfelder'); return
    }
    setSavingNew(true); setNewError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles').select('first_name, last_name, display_name')
        .eq('id', user?.id).maybeSingle()
      const creatorName = profile?.display_name
        || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        || user?.email || 'FLOX'

      const amount = parseFloat(newForm.amount.replace(',', '.'))
      const dedup_hash = await buildDedupHash(
        newForm.booking_date, amount.toString(),
        newForm.counterpart_iban, newForm.purpose
      )
      const { error } = await supabase.from('transactions').insert({
        account_type_id: newForm.account_type_id || null,
        booking_date: newForm.booking_date,
        amount,
        counterpart_name: newForm.counterpart_name || null,
        counterpart_iban: newForm.counterpart_iban || null,
        purpose: newForm.purpose || null,
        notes: newForm.notes || null,
        dedup_hash,
        created_by: user?.id,
        created_by_name: creatorName,
      })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setShowNew(false)
      setNewForm({ account_type_id: '', booking_date: new Date().toISOString().split('T')[0], amount: '', counterpart_name: '', counterpart_iban: '', purpose: '', notes: '' })
    } catch (err: any) {
      setNewError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSavingNew(false)
    }
  }

  // Sortierung
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sorted = [...(transactions ?? [])].sort((a, b) => {
    let va: any = a[sortField], vb: any = b[sortField]
    if (sortField === 'booking_date') { va = va ?? ''; vb = vb ?? '' }
    if (sortField === 'amount') { va = va ?? 0; vb = vb ?? 0 }
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb ?? '') : (vb ?? '').localeCompare(va)
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const toggleExpand = (id: string, currentNotes: string | null) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setNotesState(s => ({ ...s, [id]: s[id] ?? (currentNotes ?? '') }))
        // Buchungssätze für diese Transaktion laden
        loadBuchungssaetze(id)
      }
      return next
    })
  }

  const loadBuchungssaetze = async (txId: string) => {
    setBsLoading(s => ({ ...s, [txId]: true }))
    try {
      const { data } = await supabase
        .from('buchungssatz_transactions')
        .select(`buchungssatz_id,
          buchungssaetze!inner(id, nummer, datum, buchungstext, status, is_active,
            belegtyp, belegnummer, belegdatum, contact_id,
            beleg_sharepoint_url, beleg_storage_path,
            buchungen(id, datum, betrag, sollkonto_id, habenkonto_id, buchungstext))`)
        .eq('transaction_id', txId)
        .eq('buchungssaetze.is_active', true)
      const bsList = (data ?? []).map((d: any) => d.buchungssaetze).filter(Boolean)
      setBsForTx(s => ({ ...s, [txId]: bsList }))

      // Vollständigkeitsprüfung für jede verknüpfte TX
      const tx = transactions?.find(t => t.id === txId)
      const txBetrag = Math.abs((tx as any)?.amount ?? 0)
      const incomplete = bsList.some((bs: any) => {
        const buchungen = bs.buchungen ?? []
        if (buchungen.length === 0) return true
        const bsSumme = Math.abs(buchungen.reduce((s: number, b: any) => s + (b.betrag ?? 0), 0))
        if (txBetrag > 0 && Math.abs(bsSumme - txBetrag) > 0.02) return true
        if (buchungen.some((b: any) => !b.datum || !b.betrag || !b.sollkonto_id || !b.habenkonto_id || !b.buchungstext)) return true
        if (!bs.beleg_sharepoint_url && !bs.beleg_storage_path) return true
        if (!bs.belegtyp || !bs.belegnummer || !bs.belegdatum || !bs.contact_id) return true
        if (!bs.datum || !bs.buchungstext) return true
        return false
      })
      setBsIncomplete(s => ({ ...s, [txId]: incomplete }))
    } finally {
      setBsLoading(s => ({ ...s, [txId]: false }))
    }
  }

  // BS-Vollständigkeit für alle verknüpften Transaktionen im Hintergrund laden
  useEffect(() => {
    if (!transactions) return
    const linkedTxIds = transactions
      .filter(tx => (tx as any).buchungssatz_transactions?.length > 0)
      .map(tx => tx.id)
    for (const txId of linkedTxIds) {
      if (!(txId in bsIncomplete)) {
        loadBuchungssaetze(txId)
      }
    }
  }, [transactions?.length])
  useEffect(() => {
    if (!initialExpandId) return

    const doExpand = async () => {
      // Direkt aus DB laden falls nicht in der gefilterten Liste
      let tx = transactions?.find(t => t.id === initialExpandId)
      if (!tx) {
        const { data } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', initialExpandId)
          .single()
        if (data) tx = data as any
      }
      if (!tx) return
      setNotesState(s => ({ ...s, [initialExpandId]: (tx as any).notes ?? '' }))
      loadBuchungssaetze(initialExpandId)
      setTimeout(() => {
        document.getElementById(`tx-row-${initialExpandId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 500)
    }

    // Warten bis Seite gerendert
    const timer = setTimeout(doExpand, 800)
    return () => clearTimeout(timer)
  }, [])

  const handleBuchungssatz = async (tx: any) => {
    // Immer neu laden um gelöschte BS zu erkennen
    await loadBuchungssaetze(tx.id)
    const bs = bsForTx[tx.id] ?? []
    if (bs.length === 0) {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles').select('first_name, last_name, display_name')
        .eq('id', user?.id).maybeSingle()
      const creatorName = profile?.display_name
        || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        || user?.email || 'FLOX'
      const { data: newBs, error } = await supabase
        .from('buchungssaetze')
        .insert({
          datum: tx.booking_date,
          herkunft: 'geldkontobewegung',
          status: 'offen',
          ki_vorlage: false,
          buchungstext: [tx.counterpart_name, tx.purpose].filter(Boolean).join(' – ') || '',
          created_by: user?.id,
          created_by_name: creatorName,
        })
        .select('id').single()
      if (error || !newBs) return
      await supabase.from('buchungssatz_transactions').insert({
        buchungssatz_id: newBs.id,
        transaction_id: tx.id,
      })
      queryClient.invalidateQueries({ queryKey: ['buchungssaetze'] })
      const txParam = encodeURIComponent(JSON.stringify({
        id: tx.id, booking_date: tx.booking_date, amount: tx.amount,
        counterpart_name: tx.counterpart_name, counterpart_iban: tx.counterpart_iban,
        purpose: tx.purpose
      }))
      // Neuer BS → neuer Tab
      window.open(`/accounting/buchungssaetze?edit=${newBs.id}&tx=${txParam}&from=transactions`, '_blank')
    } else if (bs.length === 1) {
      // Bestehender BS → gleicher Tab
      navigate(`/accounting/buchungssaetze?edit=${bs[0].id}&from=transactions`)
    } else {
      setShowBsSelect(tx.id)
    }
  }

  const handleSaveNotes = async (id: string) => {
    setSavingNotes(s => ({ ...s, [id]: true }))
    try {
      await updateNotes.mutateAsync({ id, notes: notesState[id] ?? '' })
    } finally {
      setSavingNotes(s => ({ ...s, [id]: false }))
    }
  }

  const formatAmount = (amount: number | null) =>
    amount == null ? '–' : amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString('de-DE') : '–'

  const totalAmount = transactions?.reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0

  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
      onClick={() => toggleSort(field)}
    >
      {label}<SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Geldkontobewegungen</h1>
          <p className="text-gray-500 mt-1">
            {sorted.length} Einträge
            {sorted.length > 0 && (
              <span className={`ml-2 font-medium ${totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                · Summe: {formatAmount(totalAmount)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowNew(!showNew); setNewError(null) }} className="gap-2">
            <Plus className="h-4 w-4" />Neue Bewegung
          </Button>
          <Button onClick={() => { setShowImport(!showImport); setImportResult(null) }} className="gap-2">
            <Upload className="h-4 w-4" />CSV importieren
          </Button>
        </div>
      </div>

      {/* Neuer Datensatz */}
      {showNew && (
        <Card className="mb-6 border-2 border-green-200 bg-green-50">
          <CardContent className="pt-4 space-y-4">
            <h2 className="font-semibold text-gray-900">Neue Geldkontobewegung</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Buchungstag *</Label>
                <Input type="date" className="mt-1 bg-white" value={newForm.booking_date}
                  onChange={e => setNewForm(f => ({ ...f, booking_date: e.target.value }))} />
              </div>
              <div>
                <Label>Betrag (€) *</Label>
                <Input className="mt-1 bg-white" placeholder="-123,45" value={newForm.amount}
                  onChange={e => setNewForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Kontoart</Label>
                <Select value={newForm.account_type_id || ALL}
                  onValueChange={v => setNewForm(f => ({ ...f, account_type_id: v === ALL ? '' : v }))}>
                  <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Keine" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Keine</SelectItem>
                    {accountTypes?.map(at => <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empfänger/Absender Name</Label>
                <Input className="mt-1 bg-white" value={newForm.counterpart_name}
                  onChange={e => setNewForm(f => ({ ...f, counterpart_name: e.target.value }))} />
              </div>
              <div>
                <Label>IBAN</Label>
                <Input className="mt-1 bg-white font-mono" value={newForm.counterpart_iban}
                  onChange={e => setNewForm(f => ({ ...f, counterpart_iban: e.target.value }))} />
              </div>
              <div>
                {/* Platzhalter für dritte Spalte */}
              </div>
              <div className="col-span-3">
                <Label>Verwendungszweck</Label>
                <Input className="mt-1 bg-white" value={newForm.purpose}
                  onChange={e => setNewForm(f => ({ ...f, purpose: e.target.value }))} />
              </div>
              <div className="col-span-3">
                <Label>Anmerkungen</Label>
                <textarea
                  className="mt-1 w-full min-h-16 p-2 rounded-md border border-input bg-white text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={newForm.notes}
                  onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            {newError && <p className="text-sm text-red-600">{newError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleSaveNew} disabled={savingNew} className="gap-2">
                {savingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingNew ? 'Speichert...' : 'Speichern'}
              </Button>
              <Button variant="outline" onClick={() => { setShowNew(false); setNewError(null) }} className="gap-2">
                <X className="h-4 w-4" />Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import-Panel */}
      {showImport && (
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-4 space-y-4">
            <h2 className="font-semibold text-gray-900">CSV-Import</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Importmuster *</Label>
                <Select value={selectedPattern} onValueChange={v => { setSelectedPattern(v); setImportFile(null); setImportPreview([]); setImportResult(null) }}>
                  <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Muster wählen" /></SelectTrigger>
                  <SelectContent>{patterns?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kontoart (überschreibt Muster)</Label>
                <Select value={importAccountType || ALL} onValueChange={v => setImportAccountType(v === ALL ? '' : v)}>
                  <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Aus Muster" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Aus Muster übernehmen</SelectItem>
                    {accountTypes?.map(at => <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="gap-2 w-full bg-white" onClick={() => fileRef.current?.click()} disabled={!selectedPattern}>
                  <FileText className="h-4 w-4" />{importFile ? importFile.name : 'CSV-Datei wählen'}
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </div>
            </div>

            {importPreview.length > 0 && !importResult && (
              <div className="overflow-x-auto border rounded-md bg-white">
                <table className="text-xs w-full">
                  <thead><tr className="bg-gray-50 border-b">
                    <th className="px-2 py-1 text-left">Datum</th>
                    <th className="px-2 py-1 text-right">Betrag</th>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">IBAN</th>
                    <th className="px-2 py-1 text-left">Verwendungszweck</th>
                  </tr></thead>
                  <tbody>{importPreview.map((tx, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1">{tx.booking_date ?? '–'}</td>
                      <td className={`px-2 py-1 text-right font-medium ${(tx.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatAmount(tx.amount ?? null)}</td>
                      <td className="px-2 py-1 truncate max-w-32">{tx.counterpart_name ?? '–'}</td>
                      <td className="px-2 py-1 font-mono text-gray-500 truncate max-w-32">{tx.counterpart_iban ?? '–'}</td>
                      <td className="px-2 py-1 truncate max-w-48">{tx.purpose ?? '–'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {importResult && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span><strong>{importResult.inserted}</strong> neu · <strong>{importResult.skipped}</strong> Duplikate · <strong>{importResult.errors}</strong> Fehler</span>
              </div>
            )}

            <div className="flex gap-2">
              {!importResult && (
                <Button onClick={handleImport} disabled={!importFile || !selectedPattern || importing} className="gap-2">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Importiere...' : 'Importieren'}
                </Button>
              )}
              <Button variant="outline" onClick={() => { setShowImport(false); setImportFile(null); setImportPreview([]); setImportResult(null) }}>Schließen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Name, IBAN, Verwendungszweck..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Alle Kontoarten" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Kontoarten</SelectItem>
            {accountTypes?.map(at => <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
      </div>

      {/* Tabelle */}
      {isLoading && <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}
      {!isLoading && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-6 px-2"></th>
                <SortTh field="booking_date" label="Datum" />
                <th className="px-3 py-2 text-left font-medium text-gray-700">Konto</th>
                <SortTh field="amount" label="Betrag" />
                <SortTh field="counterpart_name" label="Name" />
                <SortTh field="counterpart_iban" label="IBAN" />
                <SortTh field="purpose" label="Verwendungszweck" />
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Keine Buchungen gefunden</td></tr>
              )}
              {sorted.map(tx => {
                const isExpanded = expandedIds.has(tx.id)
                const purposeTruncated = tx.purpose && tx.purpose.length > 60
                const hasNotes = !!tx.notes

                return (
                  <React.Fragment key={tx.id}>
                    <tr
                      key={tx.id}
                      id={`tx-row-${tx.id}`}
                      className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleExpand(tx.id, tx.notes)}
                    >
                      {/* Expand-Icon */}
                      <td className="px-2 py-2 text-gray-400">
                        {isExpanded
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(tx.booking_date)}</td>
                      <td className="px-3 py-2">
                        {tx.account_type && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{tx.account_type.kuerzel}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${(tx.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(tx.amount)}
                      </td>
                      <td className="px-3 py-2 truncate max-w-40">{tx.counterpart_name ?? '–'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500 truncate max-w-36">{tx.counterpart_iban ?? '–'}</td>
                      <td className="px-3 py-2 max-w-64">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-gray-600">{tx.purpose ?? '–'}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {hasNotes && (
                              <span title="Anmerkungen vorhanden">
                                <MessageSquare className="h-3.5 w-3.5 text-orange-400" />
                              </span>
                            )}
                            {(tx as any).buchungssatz_transactions?.length > 0 ? (
                              <span title={bsIncomplete[tx.id] ? 'Buchungssatz unvollständig' : `${(tx as any).buchungssatz_transactions.length} Buchungssatz verknüpft`}>
                                <BookOpen className={`h-3.5 w-3.5 ${bsIncomplete[tx.id] ? 'text-red-500' : 'text-green-500'}`} />
                              </span>
                            ) : (
                              <span title="Kein Buchungssatz verknüpft">
                                <BookOpen className="h-3.5 w-3.5 text-gray-300" />
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        {isAdmin && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => confirm('Buchung wirklich löschen?') && deleteTx.mutate(tx.id)}
                            className="text-destructive hover:text-destructive h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>

                    {/* Ausgeklappte Details */}
                    {isExpanded && (
                      <tr key={`${tx.id}-expanded`} className="bg-blue-50 border-b">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Vollständiger Verwendungszweck</p>
                              <p className="text-gray-800 whitespace-pre-wrap">{tx.purpose || '–'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Vollständige IBAN</p>
                              <p className="font-mono text-gray-700">{tx.counterpart_iban || '–'}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs font-medium text-gray-500 mb-1">Anmerkungen</p>
                              <div className="flex gap-2">
                                <textarea
                                  className="flex-1 min-h-16 p-2 rounded-md border border-input bg-white text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  placeholder="Anmerkung hinzufügen..."
                                  value={notesState[tx.id] ?? tx.notes ?? ''}
                                  onChange={e => setNotesState(s => ({ ...s, [tx.id]: e.target.value }))}
                                  onClick={e => e.stopPropagation()}
                                />
                                <div className="flex flex-col gap-2">
                                  <Button
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={savingNotes[tx.id]}
                                    onClick={e => { e.stopPropagation(); handleSaveNotes(tx.id) }}
                                  >
                                    {savingNotes[tx.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                    Speichern
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    disabled={bsLoading[tx.id]}
                                    onClick={e => { e.stopPropagation(); handleBuchungssatz(tx) }}
                                  >
                                    {bsLoading[tx.id]
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : (bsForTx[tx.id]?.length > 0 ? '📒' : '+')}
                                    Buchungssatz
                                  </Button>
                                  {/* Auswahl bei mehreren BS */}
                                  {showBsSelect === tx.id && (
                                    <div className="border rounded-md bg-white shadow-md p-2 space-y-1" onClick={e => e.stopPropagation()}>
                                      <p className="text-xs font-medium text-gray-600 mb-1">Buchungssatz öffnen:</p>
                                      {(bsForTx[tx.id] ?? []).map((bs: any) => (
                                        <button key={bs.id}
                                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 border border-gray-100"
                                          onClick={() => { setShowBsSelect(null); navigate(`/accounting/buchungssaetze?edit=${bs.id}&from=transactions`) }}>
                                          <span className="font-mono text-blue-700">#{bs.nummer}</span>
                                          <span className="ml-2 text-gray-600">{bs.datum}</span>
                                          <span className="ml-2 text-gray-500 truncate">{bs.buchungstext}</span>
                                        </button>
                                      ))}
                                      <button className="text-xs text-gray-400 w-full text-center pt-1"
                                        onClick={() => setShowBsSelect(null)}>Abbrechen</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Importiert am</p>
                              <p className="text-gray-700">{new Date(tx.created_at).toLocaleString('de-DE')}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Importiert durch</p>
                              <p className="text-gray-700">{tx.created_by_name || '–'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
