import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  useBuchungssaetze, useSaveBuchungssatz, useDeleteBuchungssatz,
  useUpdateBuchungssatzStatus, useToggleKiVorlage, uploadBeleg, getBelegUrl,
} from '@/hooks/useBuchungssaetze'
import { useSkr03 } from '@/hooks/useSkr03'
import { useContacts } from '@/hooks/useContacts'
import { useTransactions, useAccountTypes } from '@/hooks/useAccounting'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useIsAdmin } from '@/hooks/usePermissions'
import FilePicker from '@/components/FilePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp,
  Paperclip, Link, Upload, Search, ExternalLink,
  Loader2, CheckCircle, FolderOpen, ArrowLeft
} from 'lucide-react'
import type { Buchungssatz, Buchung } from '@/hooks/useBuchungssaetze'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  offen:       { label: 'Offen',       color: 'bg-yellow-100 text-yellow-800' },
  teilbezahlt: { label: 'Teilbezahlt', color: 'bg-blue-100 text-blue-800' },
  bezahlt:     { label: 'Bezahlt',     color: 'bg-green-100 text-green-800' },
  storniert:   { label: 'Storniert',   color: 'bg-red-100 text-red-800' },
}

const HERKUNFT_LABELS: Record<string, string> = {
  manuell: 'Manuell',
  geldkontobewegung: 'Geldkontobewegung',
  beleg_ocr: 'Beleg (OCR)',
}

type BuchungForm = {
  id?: string
  datum: string
  betrag: string
  sollkonto_id: string
  habenkonto_id: string
  buchungstext: string
  anmerkungen: string
}

type BsForm = {
  id?: string
  datum: string
  buchungstext: string
  belegnummer: string
  belegdatum: string
  belegtyp: string
  contact_id: string
  ki_vorlage: boolean
  beleg_sharepoint_url: string
  beleg_sharepoint_path: string
  status: Buchungssatz['status']
  herkunft: Buchungssatz['herkunft']
  anmerkungen: string
}

const emptyBuchung = (datum: string): BuchungForm => ({
  datum, betrag: '', sollkonto_id: '', habenkonto_id: '', buchungstext: '', anmerkungen: ''
})

const emptyBsForm = (): BsForm => ({
  datum: new Date().toISOString().split('T')[0],
  buchungstext: '', belegnummer: '', belegdatum: '',
  belegtyp: '', contact_id: '',
  beleg_sharepoint_url: '', beleg_sharepoint_path: '',
  status: 'offen', herkunft: 'manuell', anmerkungen: '', ki_vorlage: false,
})

// ─── Kontosuche ───────────────────────────────────────────────────────────────
function KontoSearch({ value, onChange, placeholder }: {
  value: string; onChange: (id: string) => void; placeholder?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { data: result } = useSkr03(false, search)
  const konten = result?.data ?? []
  const selected = konten.find(k => k.id === value) ?? null

  const handleFocus = () => {
    setOpen(true)
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 420),
        zIndex: 9999,
      })
    }
  }

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-white text-xs h-8"
          title={`${selected.kontonummer} ${selected.beschriftung ?? ''}`}>
          <span className="font-mono text-blue-700 flex-shrink-0">{selected.kontonummer}</span>
          <span className="truncate flex-1">{selected.beschriftung}</span>
          <button onClick={() => onChange('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          <input
            ref={inputRef}
            className="pl-6 pr-2 h-8 w-full rounded-md border border-input bg-white text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={placeholder ?? 'Konto suchen...'}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        </div>
      )}
      {open && !selected && search.length > 0 && (
        <div style={dropdownStyle} className="bg-white border rounded-md shadow-xl max-h-52 overflow-y-auto">
          {konten.slice(0, 25).map(k => (
            <button key={k.id} className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs flex gap-2"
              onMouseDown={() => { onChange(k.id); setSearch(''); setOpen(false) }}>
              <span className="font-mono text-blue-700 w-14 flex-shrink-0">{k.kontonummer}</span>
              <span className="text-gray-700">{k.beschriftung || k.kontenzweck}</span>
            </button>
          ))}
          {konten.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Kein Konto gefunden</div>}
        </div>
      )}
    </div>
  )
}

// ─── Kontaktsuche ─────────────────────────────────────────────────────────────
function ContactSearch({ value, onChange, existingContact }: {
  value: string
  onChange: (id: string) => void
  existingContact?: { id: string; is_company: boolean; first_name: string | null; last_name: string | null; company_name: string | null } | null
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const { data: result } = useContacts(search, 0, 20)
  const contacts = result?.data ?? []

  const getName = (c: typeof existingContact) => {
    if (!c) return ''
    return c.is_company ? c.company_name ?? '' : [c.first_name, c.last_name].filter(Boolean).join(' ')
  }

  // Zeige existingContact wenn value gesetzt aber noch nicht in Suchergebnissen
  const displayContact = existingContact?.id === value ? existingContact : contacts.find(c => c.id === value) ?? null

  return (
    <div className="relative">
      {displayContact ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white text-sm">
          <span className="flex-1 truncate">{getName(displayContact as any)}</span>
          <button onClick={() => onChange('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input className="pl-8 text-sm bg-white" placeholder="Kontakt suchen..."
            value={search} onChange={e => { setSearch(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} />
        </div>
      )}
      {open && !displayContact && search.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
          {contacts.slice(0, 15).map(c => (
            <button key={c.id} className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-sm"
              onMouseDown={() => { onChange(c.id); setSearch(''); setOpen(false) }}>
              {getName(c as any)}
              {c.email_main && <span className="text-gray-400 text-xs ml-2">{c.email_main}</span>}
            </button>
          ))}
          {contacts.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Kein Kontakt gefunden</div>}
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function BuchungssaetzePage() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: appSettings } = useAppSettings(['default_belege_folder', 'default_belege_folder_eingang', 'default_belege_folder_ausgang', 'default_belege_folder_sonstiges'])
  const [fromTransactions, setFromTransactions] = useState(false)
  const [expandTxId, setExpandTxId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'nummer' | 'datum' | 'betrag'>('nummer')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)

  // Formular
  const [bsForm, setBsForm] = useState<BsForm>(emptyBsForm())

  // Dynamisches Belegverzeichnis je nach Belegtyp
  const defaultBelegeFolder = bsForm.belegtyp === 'eingangsrechnung'
    ? (appSettings?.default_belege_folder_eingang ?? '/FLOX/Belege/Eingangsrechnungen')
    : bsForm.belegtyp === 'ausgangsrechnung'
    ? (appSettings?.default_belege_folder_ausgang ?? '/FLOX/Belege/Ausgangsrechnungen')
    : bsForm.belegtyp === 'sonstiges'
    ? (appSettings?.default_belege_folder_sonstiges ?? '/FLOX/Belege/Sonstiges')
    : (appSettings?.default_belege_folder ?? '/FLOX/Belege')
  const [buchungenForm, setBuchungenForm] = useState<BuchungForm[]>([])
  const [activeBuchungIdx, setActiveBuchungIdx] = useState<number>(0)
  const [linkedTxIds, setLinkedTxIds] = useState<string[]>([])
  const [loadedLinkedTxs, setLoadedLinkedTxs] = useState<any[]>([])
  const [selectedTxForKi, setSelectedTxForKi] = useState<any | null>(null)
  const [kiVorschlag, setKiVorschlag] = useState<any | null>(null)
  const [kiLoading, setKiLoading] = useState(false)
  const [belegFile, setBelegFile] = useState<File | null>(null)
  const [belegPreviewUrl, setBelegPreviewUrl] = useState<string | null>(null)
  const [belegPreviewMime, setBelegPreviewMime] = useState<string | null>(null)
  const [belegMode, setBelegMode] = useState<'sharepoint' | 'upload'>('sharepoint')
  const [spPreviewLoading, setSpPreviewLoading] = useState(false)
  const [referenzStoragePath, setReferenzStoragePath] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [belegVorschlaege, setBelegVorschlaege] = useState<any[]>([])
  const [showBelegVorschlaege, setShowBelegVorschlaege] = useState(false)
  const [referenzBsId, setReferenzBsId] = useState<string | null>(null)
  const [loadingBelegVorschlaege, setLoadingBelegVorschlaege] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [showVorlagenDropdown, setShowVorlagenDropdown] = useState(false)
  const [loadingVorlagen, setLoadingVorlagen] = useState(false)
  const [matchingVorlagen, setMatchingVorlagen] = useState<any[]>([])

  // TX-Filter
  const [txSearch, setTxSearch] = useState('')
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')
  const [txAccountType, setTxAccountType] = useState('__all__')

  const fileRef = useRef<HTMLInputElement>(null)

  const { data: buchungssaetze, isLoading } = useBuchungssaetze({
    status: statusFilter !== '__all__' ? statusFilter : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    search: search || undefined,
  })
  const { data: accountTypes } = useAccountTypes()
  const { data: transactions } = useTransactions({
    search: txSearch || undefined,
    date_from: txDateFrom || undefined,
    date_to: txDateTo || undefined,
    account_type_id: txAccountType !== '__all__' ? txAccountType : undefined,
  })

  const save = useSaveBuchungssatz()
  const del = useDeleteBuchungssatz()
  const updateStatus = useUpdateBuchungssatzStatus()
  const toggleKiVorlage = useToggleKiVorlage()

  // Auto-open BS from URL param (z.B. nach Erstellung aus Geldkontobewegung)
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || !buchungssaetze || buchungssaetze.length === 0) return
    const bs = buchungssaetze.find(b => b.id === editId)
    if (bs && editingId !== editId) {
      // Herkunft merken (für Zurück-Button)
      if (searchParams.get('from') === 'transactions') {
        setFromTransactions(true)
        setExpandTxId(searchParams.get('expand') ?? null)
      }
      startEdit(bs).then(() => {
        // Transaktion vorauswählen wenn mitübergeben
        const txParam = searchParams.get('tx')
        if (txParam) {
          try {
            const tx = JSON.parse(decodeURIComponent(txParam))
            setLoadedLinkedTxs([tx])
            setSelectedTxForKi(tx)
          } catch {}
        }
      }).catch(console.error)
      setSearchParams({})
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300)
    }
  }, [buchungssaetze])

  const startNew = () => {
    setBsForm(emptyBsForm())
    setBuchungenForm([emptyBuchung(new Date().toISOString().split('T')[0])])
    setLinkedTxIds([])
    setBelegFile(null); setBelegPreviewUrl(null)
    setEditingId('new'); setError(null)
  }

  const startEdit = async (bs: Buchungssatz) => {
    const spPath = bs.beleg_sharepoint_path ?? ''
    const storagePath = bs.beleg_storage_path ?? ''
    setBsForm({
      id: bs.id, datum: bs.datum,
      buchungstext: bs.buchungstext ?? '', belegnummer: bs.belegnummer ?? '',
      belegdatum: bs.belegdatum ?? '',
      belegtyp: (bs as any).belegtyp ?? '',
      contact_id: (bs as any).contact_id ?? '',
      ki_vorlage: (bs as any).ki_vorlage ?? false,
      beleg_sharepoint_url: bs.beleg_sharepoint_url ?? '',
      beleg_sharepoint_path: spPath,
      status: bs.status, herkunft: bs.herkunft, anmerkungen: bs.anmerkungen ?? '',
    })
    setBuchungenForm((bs.buchungen ?? []).map(b => ({
      id: b.id, datum: b.datum,
      betrag: b.betrag.toString().replace('.', ','),
      sollkonto_id: b.sollkonto_id ?? '', habenkonto_id: b.habenkonto_id ?? '',
      buchungstext: b.buchungstext ?? '', anmerkungen: b.anmerkungen ?? '',
    })))
    setLinkedTxIds((bs.buchungssatz_transactions ?? []).map((t: any) => t.transaction_id))
    // Verknüpfte Transaktionen direkt aus dem Query-Ergebnis laden
    setLoadedLinkedTxs((bs.buchungssatz_transactions ?? [])
      .filter((t: any) => t.transactions)
      .map((t: any) => t.transactions))
    setBelegFile(null); setBelegPreviewUrl(null); setBelegPreviewMime(null)
    setReferenzStoragePath(null); setReferenzBsId(null)
    setAnalyzeResult(null); setContactSuggestion(null)
    setEditingId(bs.id); setError(null)

    // Belegmodus setzen
    if (spPath) {
      setBelegMode('sharepoint')
      // SP-Vorschau automatisch laden
      setSpPreviewLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'readFile', payload: { path: spPath } }),
        })
        const data = await res.json()
        if (data.success) {
          const ext = spPath.split('.').pop()?.toLowerCase()
          const mime = ext === 'pdf' ? 'application/pdf'
            : ['jpg','jpeg'].includes(ext ?? '') ? 'image/jpeg'
            : ext === 'png' ? 'image/png' : 'application/octet-stream'
          const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: mime })
          setBelegPreviewUrl(URL.createObjectURL(blob))
          setBelegPreviewMime(mime)
        }
      } finally { setSpPreviewLoading(false) }
    } else if (storagePath) {
      setBelegMode('upload')
      // Storage-Vorschau laden
      try {
        const url = await getBelegUrl(storagePath)
        setBelegPreviewUrl(url)
        const ext = storagePath.split('.').pop()?.toLowerCase()
        setBelegPreviewMime(ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
      } catch {}
    } else {
      setBelegMode('sharepoint')
    }
  }

  const cancel = () => {
    setEditingId(null); setBsForm(emptyBsForm()); setFromTransactions(false); setExpandTxId(null); setConfirmDelete(false)
    setBuchungenForm([]); setActiveBuchungIdx(0); setLinkedTxIds([]); setLoadedLinkedTxs([])
    setKiVorschlag(null); setSelectedTxForKi(null); setReferenzBsId(null); setReferenzStoragePath(null)
    setBelegFile(null); setBelegPreviewUrl(null); setBelegPreviewMime(null)
    setAnalyzeResult(null); setContactSuggestion(null); setError(null)
  }

  const handleBelegFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBelegFile(file)
    setBelegPreviewMime(file.type)
    setBelegPreviewUrl(URL.createObjectURL(file))
  }

  const loadSpPreview = async () => {
    if (!bsForm.beleg_sharepoint_path) return
    setSpPreviewLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'readFile', payload: { path: bsForm.beleg_sharepoint_path } }),
      })
      const data = await res.json()
      if (!data.success) return
      // Aus Dateiendung MIME ermitteln
      const ext = bsForm.beleg_sharepoint_path.split('.').pop()?.toLowerCase()
      const mime = ext === 'pdf' ? 'application/pdf'
        : ['jpg','jpeg'].includes(ext ?? '') ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'tiff' ? 'image/tiff'
        : 'application/octet-stream'
      const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: mime })
      setBelegPreviewUrl(URL.createObjectURL(blob))
      setBelegPreviewMime(mime)
    } finally {
      setSpPreviewLoading(false)
    }
  }

  const handleFilePickerSelect = async (item: { name: string; path: string; webUrl: string }) => {
    setBsForm(f => ({ ...f, beleg_sharepoint_path: item.path, beleg_sharepoint_url: item.webUrl }))
    setShowFilePicker(false)
    // Vorschau automatisch laden
    setSpPreviewLoading(true)
    setBelegPreviewUrl(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'readFile', payload: { path: item.path } }),
      })
      const data = await res.json()
      if (!data.success) return
      const ext = item.name.split('.').pop()?.toLowerCase()
      const mime = ext === 'pdf' ? 'application/pdf'
        : ['jpg','jpeg'].includes(ext ?? '') ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'tiff' ? 'image/tiff'
        : 'application/octet-stream'
      const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: mime })
      setBelegPreviewUrl(URL.createObjectURL(blob))
      setBelegPreviewMime(mime)
    } finally {
      setSpPreviewLoading(false)
    }
  }

  const suggestBuchung = async (tx: any) => {
    setSelectedTxForKi(tx)
    setKiVorschlag(null)
    setKiLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-buchung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          betrag: tx.amount,
          counterpart_name: tx.counterpart_name,
          purpose: tx.purpose,
          belegtyp: bsForm.belegtyp,
          buchungstext: bsForm.buchungstext,
        }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      setKiVorschlag(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setKiLoading(false)
    }
  }

  const addBuchung = () => setBuchungenForm(prev => [...prev, emptyBuchung(bsForm.datum)])
  const removeBuchung = (i: number) => setBuchungenForm(prev => prev.filter((_, j) => j !== i))
  const updateBuchung = (i: number, field: string, value: string) =>
    setBuchungenForm(prev => prev.map((b, j) => j === i ? { ...b, [field]: value } : b))

  const loadMatchingVorlagen = async () => {
    setLoadingVorlagen(true)
    setMatchingVorlagen([])
    try {
      // Verknüpfte Transaktion ermitteln
      const tx = selectedTxForKi ?? linkedTransactions[0]
      if (!tx) { setLoadingVorlagen(false); return }

      const txName = (tx.counterpart_name ?? '').toLowerCase().trim()
      const txIban = (tx.counterpart_iban ?? '').toLowerCase().trim()
      const txPurpose = (tx.purpose ?? '').toLowerCase().trim()

      // Alle Buchungssätze mit ki_vorlage=true laden (inkl. verknüpfte Transaktionen + Beleg)
      const { data: vorlagenData } = await supabase
        .from('buchungssaetze')
        .select(`
          id, nummer, datum, buchungstext, anmerkungen, ki_vorlage,
          belegnummer, belegdatum, belegtyp, contact_id,
          beleg_sharepoint_url, beleg_sharepoint_path, beleg_storage_path,
          buchungen(datum, betrag, buchungstext, anmerkungen, sort_order, sollkonto:skr03!sollkonto_id(id, kontonummer, beschriftung), habenkonto:skr03!habenkonto_id(id, kontonummer, beschriftung)),
          buchungssatz_transactions(transaction_id, transactions(id, counterpart_name, counterpart_iban, purpose))
        `)
        .eq('ki_vorlage', true)
        .eq('is_active', true)
        .neq('id', editingId ?? '')

      const passend = (vorlagenData ?? []).filter((bs: any) => {
        const txs: any[] = (bs.buchungssatz_transactions ?? []).map((bt: any) => bt.transactions).filter(Boolean)
        if (txs.length === 0) return false
        return txs.some((t: any) => {
          const n = (t.counterpart_name ?? '').toLowerCase().trim()
          const ib = (t.counterpart_iban ?? '').toLowerCase().trim()
          const p = (t.purpose ?? '').toLowerCase().trim()
          const nameMatch = txName && n && n === txName
          const ibanMatch = txIban && ib && ib === txIban
          const purposeMatch = txPurpose && p && p === txPurpose
          return nameMatch || ibanMatch || purposeMatch
        })
      })

      setMatchingVorlagen(passend)
    } catch (err) {
      console.error('Vorlagen laden Fehler:', err)
    } finally {
      setLoadingVorlagen(false)
    }
  }

  const applyVorlage = async (vorlage: any) => {
    // Buchungszeilen übernehmen
    const buchungen = (vorlage.buchungen ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    setBuchungenForm(buchungen.map((b: any) => ({
      datum: bsForm.datum || b.datum || '',
      betrag: b.betrag != null ? b.betrag.toString().replace('.', ',') : '',
      buchungstext: b.buchungstext ?? '',
      anmerkungen: b.anmerkungen ?? '',
      sollkonto_id: b.sollkonto?.id ?? '',
      habenkonto_id: b.habenkonto?.id ?? '',
    })))

    // Belegnummer, Belegdatum, Belegtyp und Kontakt übernehmen
    setBsForm(f => ({
      ...f,
      belegnummer: vorlage.belegnummer ?? f.belegnummer,
      belegdatum: vorlage.belegdatum ?? f.belegdatum,
      belegtyp: vorlage.belegtyp ?? f.belegtyp,
      contact_id: vorlage.contact_id ?? f.contact_id,
    }))

    // Beleg übernehmen
    const spPath = vorlage.beleg_sharepoint_path ?? ''
    const spUrl = vorlage.beleg_sharepoint_url ?? ''
    const storagePath = vorlage.beleg_storage_path ?? ''

    if (spPath) {
      // SharePoint-Link übernehmen
      setBsForm(f => ({ ...f, beleg_sharepoint_path: spPath, beleg_sharepoint_url: spUrl }))
      setBelegMode('sharepoint')
      // Vorschau laden
      setSpPreviewLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'readFile', payload: { path: spPath } }),
        })
        const data = await res.json()
        if (data.success) {
          const ext = spPath.split('.').pop()?.toLowerCase()
          const mime = ext === 'pdf' ? 'application/pdf'
            : ['jpg','jpeg'].includes(ext ?? '') ? 'image/jpeg'
            : ext === 'png' ? 'image/png' : 'application/octet-stream'
          const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: mime })
          setBelegPreviewUrl(URL.createObjectURL(blob))
          setBelegPreviewMime(mime)
        }
      } finally { setSpPreviewLoading(false) }
    } else if (storagePath) {
      // Hochgeladenen Beleg kopieren (in neuen Pfad unter temporärer ID)
      setBelegMode('upload')
      try {
        const ext = storagePath.split('.').pop()
        const tmpId = editingId && editingId !== 'new' ? editingId : `tmp_${Date.now()}`
        const newPath = `${tmpId}/${Date.now()}.${ext}`
        const { error: copyErr } = await supabase.storage.from('belege').copy(storagePath, newPath)
        if (!copyErr) {
          setBsForm(f => ({ ...f, beleg_storage_path: newPath } as any))
          setReferenzStoragePath(newPath)
          const url = await getBelegUrl(newPath)
          setBelegPreviewUrl(url)
          setBelegPreviewMime(ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
        } else {
          // Kopie fehlgeschlagen: trotzdem URL der Vorlage anzeigen
          const url = await getBelegUrl(storagePath)
          setBelegPreviewUrl(url)
          setBelegPreviewMime(ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
          setReferenzStoragePath(storagePath)
        }
      } catch {}
    }

    setShowVorlagenDropdown(false)
  }

  const loadBelegVorschlaege = async () => {
    setLoadingBelegVorschlaege(true)
    setShowBelegVorschlaege(true)
    setBelegVorschlaege([])
    try {
      const tx = selectedTxForKi ?? linkedTransactions[0]
      if (!tx) { setLoadingBelegVorschlaege(false); return }

      const txAmount = Math.abs(tx.amount ?? 0)
      const txName = (tx.counterpart_name ?? '').toLowerCase().trim()

      // Schritt 1: Alle Transaktionen mit ähnlichem Betrag und Name finden
      const { data: ähnlicheTx } = await supabase
        .from('transactions')
        .select('id, amount, counterpart_name')
        .neq('id', tx.id)

      const passendeIds = (ähnlicheTx ?? [])
        .filter(t => {
          const betragsMatch = Math.abs(Math.abs(t.amount ?? 0) - txAmount) < 0.02
          const nameMatch = txName.length > 2 &&
            (t.counterpart_name ?? '').toLowerCase().includes(txName.slice(0, 6))
          return betragsMatch && nameMatch
        })
        .map(t => t.id)

      if (passendeIds.length === 0) {
        setBelegVorschlaege([])
        setLoadingBelegVorschlaege(false)
        return
      }

      // Schritt 2: Buchungssätze zu diesen Transaktionen laden
      const { data: bstData } = await supabase
        .from('buchungssatz_transactions')
        .select('buchungssatz_id')
        .in('transaction_id', passendeIds)

      const bsIds = [...new Set((bstData ?? []).map(b => b.buchungssatz_id))]
        .filter(id => id !== bsForm.id)

      if (bsIds.length === 0) {
        setBelegVorschlaege([])
        setLoadingBelegVorschlaege(false)
        return
      }

      // Schritt 3: Buchungssätze mit ki_vorlage=true laden (auch ohne Beleg)
      const { data: bsData } = await supabase
        .from('buchungssaetze')
        .select('id, nummer, datum, buchungstext, belegnummer, belegtyp, beleg_sharepoint_url, beleg_sharepoint_path, beleg_storage_path, contact_id, contact:contacts(id, is_company, first_name, last_name, company_name)')
        .in('id', bsIds)
        .eq('ki_vorlage', true)
        .eq('is_active', true)

      setBelegVorschlaege(bsData ?? [])
    } catch (err) {
      console.error('Beleg-Vorschläge Fehler:', err)
    } finally {
      setLoadingBelegVorschlaege(false)
    }
  }

  const analyzeBeleg = async () => {
    setAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      let base64Data: string | null = null

      if (belegFile) {
        // Lokale Datei → Base64
        base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1]) // Nur Base64-Teil
          }
          reader.onerror = reject
          reader.readAsDataURL(belegFile)
        })
      } else if (bsForm.beleg_sharepoint_path) {
        // SharePoint-Datei über graph-service laden
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'readFile', payload: { path: bsForm.beleg_sharepoint_path } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error('Datei konnte nicht geladen werden')
        base64Data = data.data
      } else {
        throw new Error('Kein Beleg vorhanden — bitte zuerst Datei hochladen oder SharePoint-Datei wählen')
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-beleg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ base64Data }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      setAnalyzeResult(result.data)

      // Felder automatisch befüllen wenn leer
      if (result.data.belegdatum && !bsForm.belegdatum) {
        setBsForm(f => ({ ...f, belegdatum: result.data.belegdatum }))
      }
      if (result.data.belegnummer && !bsForm.belegnummer) {
        setBsForm(f => ({ ...f, belegnummer: result.data.belegnummer }))
      }

      // Kontakt-Suche starten wenn Absender-Name gefunden
      if (result.data.absender?.name) {
        await searchMatchingContact(result.data.absender)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const [contactSuggestion, setContactSuggestion] = useState<{
    type: 'found' | 'notfound'
    contact?: any
    absender?: any
  } | null>(null)

  const searchMatchingContact = async (absender: any) => {
    const searchTerm = absender.name?.trim()
    if (!searchTerm) return
    const { data } = await supabase
      .from('contacts')
      .select('id, is_company, first_name, last_name, company_name, email_main')
      .or(`company_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
      .limit(1)
    if (data && data.length > 0) {
      setContactSuggestion({ type: 'found', contact: data[0], absender })
    } else {
      setContactSuggestion({ type: 'notfound', absender })
    }
  }

  const handleSave = async () => {
    if (!bsForm.datum) { setError('Datum ist Pflichtfeld'); return }
    const validBuchungen = buchungenForm.filter(b => b.betrag.trim() !== '')
    if (validBuchungen.length === 0) { setError('Mindestens eine Buchung mit Betrag erforderlich'); return }
    setSaving(true); setError(null)
    try {
      let storagePath = '', storageName = '', storageMime = ''
      if (belegFile) {
        const tmpId = bsForm.id ?? 'new-' + Date.now()
        const uploaded = await uploadBeleg(belegFile, tmpId)
        storagePath = uploaded.path; storageName = uploaded.name; storageMime = uploaded.mime
      } else if (referenzStoragePath) {
        // Beleg aus Referenz-BS übernommen — Pfad direkt verwenden
        storagePath = referenzStoragePath
        storageName = referenzStoragePath.split('/').pop() ?? ''
        storageMime = referenzStoragePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
      }
      const savedId = await save.mutateAsync({
        buchungssatz: {
          ...(bsForm.id ? { id: bsForm.id } : {}),
          datum: bsForm.datum,
          buchungstext: bsForm.buchungstext || null,
          belegnummer: bsForm.belegnummer || null,
          belegdatum: bsForm.belegdatum || null,
          beleg_sharepoint_url: bsForm.beleg_sharepoint_url || null,
          beleg_sharepoint_path: bsForm.beleg_sharepoint_path || null,
          ...(storagePath ? { beleg_storage_path: storagePath, beleg_storage_name: storageName, beleg_storage_mime: storageMime } : {}),
          status: bsForm.status, herkunft: bsForm.herkunft,
          belegtyp: bsForm.belegtyp || null,
          contact_id: bsForm.contact_id || null,
          ki_vorlage: bsForm.ki_vorlage,
          anmerkungen: bsForm.anmerkungen || null,
        },
        buchungen: buchungenForm
          .filter(b => b.betrag.trim() !== '')
          .map(b => ({
            datum: b.datum || bsForm.datum,
            betrag: parseFloat(b.betrag.replace(',', '.')) || 0,
            sollkonto_id: b.sollkonto_id || null,
            habenkonto_id: b.habenkonto_id || null,
            buchungstext: b.buchungstext || null,
            anmerkungen: b.anmerkungen || null,
          })),
        transaction_ids: linkedTxIds,
      })
      // ID setzen falls neuer Buchungssatz
      if (!bsForm.id && savedId) {
        setBsForm(f => ({ ...f, id: savedId }))
        setEditingId(savedId)
      }
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('de-DE') : '–'
  const formatAmount = (a: number) => a.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  const totalBuchungen = (bs: Buchungssatz) => (bs.buchungen ?? []).reduce((s, b) => s + b.betrag, 0)

  // Prüft ob ein Buchungssatz unvollständig ist (wenn mit GeldkontoBewegung verknüpft)
  const isBsIncomplete = (bs: Buchungssatz): boolean => {
    const txs = (bs as any).buchungssatz_transactions ?? []
    // Nur prüfen wenn Geldkontobewegung verknüpft
    if (txs.length === 0) return false
    const buchungen = bs.buchungen ?? []
    // 1. Keine Buchungen vorhanden
    if (buchungen.length === 0) return true
    // 2. Summe stimmt nicht mit Geldkontobewegung überein
    const txBetrag = Math.abs((txs[0]?.transactions as any)?.amount ?? 0)
    const bsSumme = Math.abs(totalBuchungen(bs))
    if (txBetrag > 0 && Math.abs(bsSumme - txBetrag) > 0.02) return true
    // 3. Fehlende Pflichtfelder in Buchungen
    const buchungUnvollständig = buchungen.some(b =>
      !b.datum || !b.betrag || !b.sollkonto_id || !b.habenkonto_id || !b.buchungstext
    )
    if (buchungUnvollständig) return true
    // 4. Kein Beleg verknüpft
    if (!(bs as any).beleg_sharepoint_url && !(bs as any).beleg_storage_path) return true
    // 5. Fehlende Belegfelder
    if (!(bs as any).belegtyp || !(bs as any).belegnummer || !(bs as any).belegdatum || !(bs as any).contact_id) return true
    // 6. Fehlende Grunddaten
    if (!bs.datum || !bs.buchungstext) return true
    return false
  }

  const linkedTransactions = [
    ...loadedLinkedTxs,
    ...(transactions ?? []).filter(t => linkedTxIds.includes(t.id) && !loadedLinkedTxs.find((lt: any) => lt.id === t.id))
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Buchungssätze</h1>
          <p className="text-gray-500 mt-1">{buchungssaetze?.length ?? 0} Einträge</p>
        </div>
        {editingId === null && (
          <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" />Neuer Buchungssatz</Button>
        )}
      </div>

      {/* Formular */}
      {editingId !== null && (
        <Card className="mb-6 border-2 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editingId === 'new' ? 'Neuer Buchungssatz' : 'Buchungssatz bearbeiten'}</CardTitle>
              <div className="flex items-center gap-2">
                {fromTransactions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { cancel(); navigate(`/accounting/transactions${expandTxId ? `?expand=${expandTxId}` : ''}`) }}
                    className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Zurück zur Geldkontobewegung
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cancel} className="gap-1.5 text-gray-500 hover:text-gray-700">
                  <X className="h-4 w-4" />Schließen
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Grunddaten: Datum (1), Buchungstext (2), Status (1) */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Datum *</Label>
                <Input type="date" className="mt-1" value={bsForm.datum}
                  onChange={e => setBsForm(f => ({ ...f, datum: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Buchungstext</Label>
                <Input className="mt-1" placeholder="z.B. Warenlieferung Musterfirma"
                  value={bsForm.buchungstext} onChange={e => setBsForm(f => ({ ...f, buchungstext: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={bsForm.status} onValueChange={v => setBsForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Vorlage Toggle + Aus Vorlage laden */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBsForm(f => ({ ...f, ki_vorlage: !f.ki_vorlage }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${bsForm.ki_vorlage ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${bsForm.ki_vorlage ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-gray-500">Als Vorlage verwenden</span>
              </div>
              {/* Aus Vorlage laden */}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => {
                    if (!showVorlagenDropdown) {
                      setShowVorlagenDropdown(true)
                      loadMatchingVorlagen()
                    } else {
                      setShowVorlagenDropdown(false)
                    }
                  }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Aus Vorlage laden
                </Button>
                {showVorlagenDropdown && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-white border border-gray-200 rounded-md shadow-lg">
                    <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Passende Vorlagen</span>
                      <button onClick={() => setShowVorlagenDropdown(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {loadingVorlagen ? (
                      <div className="flex items-center justify-center py-4 gap-2 text-xs text-gray-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Lade Vorlagen…
                      </div>
                    ) : matchingVorlagen.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-400">Keine passenden Vorlagen gefunden</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        {matchingVorlagen.map((v: any) => (
                          <button
                            key={v.id}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                            onClick={() => applyVorlage(v)}>
                            <div className="text-xs font-medium text-gray-800 truncate">{v.buchungstext || `Vorlage ${v.nummer}`}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{v.datum} · {(v.buchungen ?? []).length} Buchungszeile{(v.buchungen ?? []).length !== 1 ? 'n' : ''}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Anmerkungen */}
            <div>
              <Label>Anmerkungen</Label>
              <textarea className="mt-1 w-full min-h-16 p-2 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={bsForm.anmerkungen} onChange={e => setBsForm(f => ({ ...f, anmerkungen: e.target.value }))} />
            </div>

            {/* Beleg-Box */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />Beleg zum Buchungssatz
                </h3>
                <div className="flex items-center gap-2">
                  {/* Ähnliche Belege vorschlagen */}
                  {linkedTransactions.length > 0 && (
                    <div className="relative">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        onClick={loadBelegVorschlaege} disabled={loadingBelegVorschlaege}>
                        {loadingBelegVorschlaege ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🔍'}
                        Ähnliche Belege
                      </Button>
                      {showBelegVorschlaege && (
                        <div className="absolute right-0 top-9 z-50 w-96 bg-white border rounded-md shadow-xl max-h-64 overflow-y-auto">
                          <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-xs font-medium text-gray-700">Ähnliche Belege ({belegVorschlaege.length})</span>
                            <button onClick={() => setShowBelegVorschlaege(false)} className="text-gray-400 hover:text-gray-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {belegVorschlaege.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs text-gray-400">Keine passenden Belege gefunden</div>
                          )}
                          {belegVorschlaege.map((bs: any) => (
                            <button key={bs.id}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 text-xs"
                              onClick={async () => {
                                setBsForm(f => ({
                                  ...f,
                                  belegnummer: bs.belegnummer ?? f.belegnummer,
                                  belegtyp: bs.belegtyp ?? f.belegtyp,
                                  ...(bs.contact_id ? { contact_id: bs.contact_id } : {}),
                                  // Belegdatum aus verknüpfter Geldkontobewegung wenn vorhanden
                                  ...(linkedTransactions.length > 0 && linkedTransactions[0].booking_date
                                    ? { belegdatum: linkedTransactions[0].booking_date }
                                    : {}),
                                }))
                                setReferenzBsId(bs.id)
                                // Buchungen automatisch übernehmen wenn noch keine vorhanden
                                if (buchungenForm.filter(b => b.betrag.trim() !== '').length === 0) {
                                  const { data: refBuchungen } = await supabase
                                    .from('buchungen')
                                    .select('datum, betrag, buchungstext, anmerkungen, sort_order, sollkonto:skr03!sollkonto_id(id), habenkonto:skr03!habenkonto_id(id)')
                                    .eq('buchungssatz_id', bs.id)
                                    .order('sort_order')
                                  if (refBuchungen && refBuchungen.length > 0) {
                                    setBuchungenForm(refBuchungen.map(b => ({
                                      datum: bsForm.datum,
                                      betrag: b.betrag.toString().replace('.', ','),
                                      sollkonto_id: (b.sollkonto as any)?.id ?? '',
                                      habenkonto_id: (b.habenkonto as any)?.id ?? '',
                                      buchungstext: b.buchungstext ?? '',
                                      anmerkungen: b.anmerkungen ?? '',
                                    })))
                                    setActiveBuchungIdx(0)
                                  }
                                }

                                if (bs.beleg_sharepoint_url) {
                                  // SharePoint-Link übernehmen und Vorschau laden
                                  setBelegMode('sharepoint')
                                  setBsForm(f => ({
                                    ...f,
                                    beleg_sharepoint_url: bs.beleg_sharepoint_url,
                                    beleg_sharepoint_path: bs.beleg_sharepoint_path ?? '',
                                    belegnummer: bs.belegnummer ?? f.belegnummer,
                                  }))
                                  // Vorschau laden
                                  if (bs.beleg_sharepoint_path) {
                                    setSpPreviewLoading(true)
                                    setBelegPreviewUrl(null)
                                    try {
                                      const { data: { session } } = await supabase.auth.getSession()
                                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                        body: JSON.stringify({ action: 'readFile', payload: { path: bs.beleg_sharepoint_path } }),
                                      })
                                      const data = await res.json()
                                      if (data.success) {
                                        const ext = bs.beleg_sharepoint_path.split('.').pop()?.toLowerCase()
                                        const mime = ext === 'pdf' ? 'application/pdf'
                                          : ['jpg','jpeg'].includes(ext ?? '') ? 'image/jpeg'
                                          : ext === 'png' ? 'image/png' : 'application/octet-stream'
                                        const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: mime })
                                        setBelegPreviewUrl(URL.createObjectURL(blob))
                                        setBelegPreviewMime(mime)
                                      }
                                    } finally { setSpPreviewLoading(false) }
                                  }
                                } else if (bs.beleg_storage_path) {
                                  // Hochgeladene Datei — Storage-URL laden und Vorschau anzeigen
                                  setBelegMode('upload')
                                  setReferenzStoragePath(bs.beleg_storage_path)
                                  try {
                                    const url = await getBelegUrl(bs.beleg_storage_path)
                                    setBelegPreviewUrl(url)
                                    const ext = bs.beleg_storage_path.split('.').pop()?.toLowerCase()
                                    setBelegPreviewMime(ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
                                    setBsForm(f => ({
                                      ...f,
                                      belegnummer: bs.belegnummer ?? f.belegnummer,
                                    }))
                                  } catch {}
                                }
                                setShowBelegVorschlaege(false)
                              }}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">BS#{bs.nummer} · {bs.datum}</span>
                                {bs.beleg_sharepoint_url && <span className="text-blue-400">📎 SharePoint</span>}
                                {bs.beleg_storage_path && <span className="text-green-400">📁 Hochgeladen</span>}
                              </div>
                              <div className="text-gray-500 truncate">{bs.buchungstext}</div>
                              {bs.contact && (
                                <div className="text-gray-400">
                                  👤 {bs.contact.is_company ? bs.contact.company_name : [bs.contact.first_name, bs.contact.last_name].filter(Boolean).join(' ')}
                                </div>
                              )}
                              {bs.belegnummer && <div className="text-gray-400">Beleg: {bs.belegnummer}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Belegtyp rechtsbündig */}
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    {[['eingangsrechnung','Eingangsrechnung'],['ausgangsrechnung','Ausgangsrechnung'],['sonstiges','Sonstiges']].map(([k,l]) => (
                      <button key={k}
                        onClick={() => setBsForm(f => ({ ...f, belegtyp: f.belegtyp === k ? '' : k }))}
                        className={`px-3 py-1.5 font-medium transition-colors border-r last:border-0 ${bsForm.belegtyp === k ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                {/* Links: Eingabefelder */}
                <div className="flex-1 space-y-3">

                  {/* SharePoint-Modus */}
                  {belegMode === 'sharepoint' && (
                    <div>
                      <Label className="text-xs">SharePoint-Datei</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex rounded-md border overflow-hidden text-xs flex-shrink-0">
                          <button
                            onClick={() => { setBelegMode('sharepoint') }}
                            className="px-3 py-1.5 font-medium bg-blue-600 text-white whitespace-nowrap">
                            SharePoint
                          </button>
                          <button
                            onClick={() => { setBelegMode('upload'); setBsForm(f => ({ ...f, beleg_sharepoint_path: '', beleg_sharepoint_url: '' })); setBelegPreviewUrl(null); setBelegPreviewMime(null) }}
                            className="px-3 py-1.5 font-medium bg-white text-gray-600 hover:bg-gray-50 border-l whitespace-nowrap">
                            Hochladen
                          </button>
                        </div>
                        <Input className="flex-1 font-mono text-xs bg-white" readOnly
                          placeholder="Noch keine Datei gewählt"
                          value={bsForm.beleg_sharepoint_path} />
                        <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0"
                          onClick={() => setShowFilePicker(true)}>
                          <FolderOpen className="h-4 w-4" />Wählen
                        </Button>
                        {bsForm.beleg_sharepoint_url && (
                          <Button variant="outline" size="sm" className="flex-shrink-0"
                            onClick={() => window.open(bsForm.beleg_sharepoint_url, '_blank')}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {spPreviewLoading && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />Vorschau wird geladen...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload-Modus */}
                  {belegMode === 'upload' && (
                    <div>
                      <Label className="text-xs">Datei hochladen</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex rounded-md border overflow-hidden text-xs flex-shrink-0">
                          <button
                            onClick={() => { setBelegMode('sharepoint'); setBelegFile(null); setBelegPreviewUrl(null); setBelegPreviewMime(null) }}
                            className="px-3 py-1.5 font-medium bg-white text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                            SharePoint
                          </button>
                          <button
                            onClick={() => { setBelegMode('upload') }}
                            className="px-3 py-1.5 font-medium bg-blue-600 text-white border-l whitespace-nowrap">
                            Hochladen
                          </button>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2 bg-white flex-shrink-0"
                          onClick={() => fileRef.current?.click()}>
                          <Upload className="h-4 w-4" />
                          {belegFile ? belegFile.name : 'Datei wählen'}
                        </Button>
                        {belegFile && (
                          <>
                            <Button variant="ghost" size="sm"
                              onClick={() => { setBelegFile(null); setBelegPreviewUrl(null); setBelegPreviewMime(null) }}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="flex-shrink-0"
                              onClick={() => belegPreviewUrl && window.open(belegPreviewUrl, '_blank')}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff" className="hidden" onChange={handleBelegFile} />
                    </div>
                  )}

                  {/* Belegnummer + Belegdatum */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Belegnummer</Label>
                      <Input className="mt-1 bg-white" placeholder="z.B. RE-2026-001"
                        value={bsForm.belegnummer} onChange={e => setBsForm(f => ({ ...f, belegnummer: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Belegdatum</Label>
                      <Input type="date" className="mt-1 bg-white" value={bsForm.belegdatum}
                        onChange={e => setBsForm(f => ({ ...f, belegdatum: e.target.value }))} />
                    </div>
                  </div>

                  {/* Empfänger/Absender — ganz unten */}
                  <div>
                    <Label className="text-xs">Empfänger/Absender</Label>
                    <div className="mt-1">
                      <ContactSearch
                        value={bsForm.contact_id}
                        onChange={v => setBsForm(f => ({ ...f, contact_id: v }))}
                        existingContact={buchungssaetze?.find(bs => bs.id === editingId) ? (buchungssaetze.find(bs => bs.id === editingId) as any).contact : null}
                      />
                    </div>
                  </div>
                </div>

                {/* Rechts: Vorschau + Analyse-Button — A4-Verhältnis */}
                <div className="w-40 flex-shrink-0 flex flex-col gap-2">
                  <div style={{ height: '226px' }}>
                    {belegPreviewUrl ? (
                      <div className="w-full h-full border rounded-md overflow-hidden bg-white">
                        {belegPreviewMime === 'application/pdf' ? (
                          <embed src={belegPreviewUrl} type="application/pdf" className="w-full h-full" />
                        ) : (
                          <img src={belegPreviewUrl} alt="Beleg Vorschau" className="w-full h-full object-contain" />
                        )}
                      </div>
                    ) : spPreviewLoading ? (
                      <div className="w-full h-full border rounded-md bg-white flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                      </div>
                    ) : (
                      <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-md flex items-center justify-center">
                        <span className="text-xs text-gray-300 text-center px-2">Vorschau erscheint hier</span>
                      </div>
                    )}
                  </div>
                  {/* Analysieren-Button */}
                  {(belegFile || bsForm.beleg_sharepoint_path) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      onClick={analyzeBeleg}
                      disabled={analyzing}
                    >
                      {analyzing
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analysiert...</>
                        : <>🔍 KI-Analyse</>}
                    </Button>
                  )}
                </div>
              </div>

              {/* Analyse-Ergebnis */}
              {analyzeResult && (
                <div className="mt-3 border rounded-md bg-blue-50 border-blue-200 p-3 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-700">🔍 KI-Ergebnis
                      <span className="ml-2 text-gray-400">(Konfidenz: {Math.round((analyzeResult.konfidenz ?? 0) * 100)}%)</span>
                    </p>
                  </div>

                  {/* Erkannte Felder — Belegnummer zuerst, dann Datum, Gesamt */}
                  <div className="grid grid-cols-3 gap-2">
                    {analyzeResult.belegnummer && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Nr.:</span>
                        <span className="font-medium">{analyzeResult.belegnummer}</span>
                        <button
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0"
                          onClick={() => setBsForm(f => ({ ...f, belegnummer: analyzeResult.belegnummer }))}>
                          ↑ Übernehmen
                        </button>
                      </div>
                    )}
                    {analyzeResult.belegdatum && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Datum:</span>
                        <span className="font-medium">{analyzeResult.belegdatum}</span>
                        <button
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0"
                          onClick={() => {
                            const raw = analyzeResult.belegdatum
                            let iso = raw
                            const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
                            if (de) iso = `${de[3]}-${de[2].padStart(2,'0')}-${de[1].padStart(2,'0')}`
                            const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
                            if (us) iso = `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`
                            setBsForm(f => ({ ...f, belegdatum: iso }))
                          }}>
                          ↑ Übernehmen
                        </button>
                      </div>
                    )}
                    {analyzeResult.gesamtbetrag && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Gesamt:</span>
                        <span className="font-medium text-green-700">{analyzeResult.gesamtbetrag} {analyzeResult.waehrung}</span>
                        {analyzeResult.steuerbetrag && (
                          <span className="text-gray-400">· MwSt: {analyzeResult.steuerbetrag}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Absender */}
                  {analyzeResult.absender?.name && (
                    <div className="border rounded p-2 bg-white">
                      <p className="font-medium text-gray-700 mb-1">Absender/Lieferant</p>
                      <p>{analyzeResult.absender.name}</p>
                      {analyzeResult.absender.adresszeile && <p className="text-gray-500">{analyzeResult.absender.adresszeile}</p>}
                      {analyzeResult.absender.steuernummer && <p className="text-gray-400">StNr.: {analyzeResult.absender.steuernummer}</p>}
                    </div>
                  )}

                  {/* Kontakt-Vorschlag */}
                  {contactSuggestion && (
                    <div className={`border rounded p-2 ${contactSuggestion.type === 'found' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      {contactSuggestion.type === 'found' ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-green-800">Kontakt gefunden:</p>
                            <p className="text-green-700">
                              {contactSuggestion.contact.is_company
                                ? contactSuggestion.contact.company_name
                                : [contactSuggestion.contact.first_name, contactSuggestion.contact.last_name].filter(Boolean).join(' ')}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="text-xs gap-1 border-green-300"
                            onClick={() => {
                              setBsForm(f => ({ ...f, contact_id: contactSuggestion.contact.id }))
                              setContactSuggestion(null)
                            }}>
                            <CheckCircle className="h-3.5 w-3.5" />Verknüpfen
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-yellow-800">Kein Kontakt gefunden für <strong>{contactSuggestion.absender?.name}</strong></p>
                          <Button size="sm" variant="outline" className="text-xs border-yellow-300 flex-shrink-0"
                            onClick={() => {
                              const a = contactSuggestion.absender
                              const params = new URLSearchParams()
                              if (a.name) params.set('company_name', a.name)
                              if (a.strasse) params.set('street', a.strasse)
                              if (a.plz) params.set('postal_code', a.plz)
                              if (a.ort) params.set('city', a.ort)
                              if (a.land) params.set('country', a.land)
                              if (a.steuernummer) params.set('tax_number', a.steuernummer)
                              const qs = params.toString()
                              navigate(`/contacts/new${qs ? '?' + qs : ''}`)
                            }}>
                            + Neu anlegen
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Positionen */}
                  {analyzeResult.positionen?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Positionen ({analyzeResult.positionen.length})</p>
                      <div className="border rounded overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="px-2 py-1 text-left">Beschreibung</th>
                              <th className="px-2 py-1 text-right">Menge</th>
                              <th className="px-2 py-1 text-right">Einzelpreis</th>
                              <th className="px-2 py-1 text-right">USt-%</th>
                              <th className="px-2 py-1 text-right">USt-Betrag</th>
                              <th className="px-2 py-1 text-right">Gesamt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyzeResult.positionen.map((p: any, i: number) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="px-2 py-1">{p.beschreibung || '–'}</td>
                                <td className="px-2 py-1 text-right">{p.menge} {p.einheit}</td>
                                <td className="px-2 py-1 text-right">{p.einzelpreis}</td>
                                <td className="px-2 py-1 text-right text-gray-500">{p.steuersatz || '–'}</td>
                                <td className="px-2 py-1 text-right text-gray-500">{p.steuerbetrag || '–'}</td>
                                <td className="px-2 py-1 text-right font-medium">{p.gesamtpreis}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Geldkontobewegungen verknüpfen */}
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700">Geldkontobewegung(en) verknüpfen</h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="relative col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input className="pl-8 text-sm bg-white" placeholder="Name, IBAN, Verwendungszweck..."
                    value={txSearch} onChange={e => setTxSearch(e.target.value)} />
                </div>
                <Input type="date" className="text-sm bg-white" value={txDateFrom}
                  onChange={e => setTxDateFrom(e.target.value)} />
                <Input type="date" className="text-sm bg-white" value={txDateTo}
                  onChange={e => setTxDateTo(e.target.value)} />
              </div>
              <div>
                <Select value={txAccountType} onValueChange={setTxAccountType}>
                  <SelectTrigger className="bg-white text-sm"><SelectValue placeholder="Alle Kontoarten" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Alle Kontoarten</SelectItem>
                    {accountTypes?.map(at => <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(txSearch || txDateFrom || txDateTo || txAccountType !== '__all__') && (
                <div className="border rounded-md bg-white max-h-48 overflow-y-auto">
                  {(transactions ?? []).slice(0, 30).map(tx => (
                    <button key={tx.id}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-0 ${linkedTxIds.includes(tx.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        if (!linkedTxIds.includes(tx.id)) {
                          setLinkedTxIds(prev => [...prev, tx.id])
                          setLoadedLinkedTxs(prev => [...prev, tx])
                          // Liste schließen nach Auswahl
                          setTxSearch('')
                          setTxDateFrom('')
                          setTxDateTo('')
                          setTxAccountType('__all__')
                        } else {
                          setLinkedTxIds(prev => prev.filter(id => id !== tx.id))
                          setLoadedLinkedTxs(prev => prev.filter((t: any) => t.id !== tx.id))
                        }
                      }}>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 w-20 flex-shrink-0">{tx.booking_date}</span>
                        <span className={`font-medium w-24 flex-shrink-0 ${(tx.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(tx.amount ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                        <span className="truncate text-gray-700">{tx.counterpart_name}</span>
                        <span className="truncate text-gray-400 flex-1">{tx.counterpart_iban}</span>
                        {linkedTxIds.includes(tx.id) && <CheckCircle className="h-3.5 w-3.5 text-blue-600 ml-auto flex-shrink-0" />}
                      </div>
                      {tx.purpose && <div className="text-gray-400 truncate mt-0.5">{tx.purpose}</div>}
                    </button>
                  ))}
                  {(transactions ?? []).length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Keine Bewegungen gefunden</div>}
                </div>
              )}
              {linkedTransactions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Ausgewählte Bewegungen:</p>
                  {/* Zeilen mit Radio-Auswahl */}
                  {linkedTransactions.map(tx => (
                    <div key={tx.id}
                      className={`flex items-center gap-2 border rounded-md px-3 py-2 text-xs cursor-pointer transition-colors ${selectedTxForKi?.id === tx.id ? 'border-purple-400 bg-purple-50' : 'bg-blue-50 border-blue-200 hover:border-blue-400'}`}
                      onClick={() => setSelectedTxForKi(selectedTxForKi?.id === tx.id ? null : tx)}>
                      {/* Radio-Button */}
                      <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selectedTxForKi?.id === tx.id ? 'border-purple-500 bg-purple-500' : 'border-gray-300 bg-white'}`}>
                        {selectedTxForKi?.id === tx.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      {/* Daten */}
                      <div className="flex-1 grid grid-cols-5 gap-2 min-w-0">
                        <span className="text-gray-500">{tx.booking_date}</span>
                        <span className={`font-medium ${(tx.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(tx.amount ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                        <span className="text-gray-700 truncate">{tx.counterpart_name}</span>
                        <span className="text-gray-400 font-mono truncate">{tx.counterpart_iban}</span>
                        <span className="text-gray-600 truncate">{tx.purpose}</span>
                      </div>
                      {/* Entfernen + Öffnen */}
                      <a href={`/accounting/transactions?expand=${tx.id}`} target="_blank" rel="noreferrer"
                        className="text-blue-400 hover:text-blue-600 flex-shrink-0" title="In neuem Tab öffnen">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button onClick={e => {
                        e.stopPropagation()
                        setLinkedTxIds(prev => prev.filter(id => id !== tx.id))
                        setLoadedLinkedTxs(prev => prev.filter((t: any) => t.id !== tx.id))
                        if (selectedTxForKi?.id === tx.id) { setSelectedTxForKi(null); setKiVorschlag(null) }
                      }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {/* Zentraler KI-Button */}
                  <div className="flex justify-center pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`gap-2 text-xs transition-colors ${selectedTxForKi ? 'border-purple-400 text-purple-700 hover:bg-purple-50' : 'text-gray-400 border-gray-300'}`}
                      onClick={() => selectedTxForKi && suggestBuchung(selectedTxForKi)}
                      disabled={!selectedTxForKi || kiLoading}>
                      {kiLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <span>🤖</span>}
                      {selectedTxForKi ? 'KI-Buchungsvorschlag für ausgewählte Bewegung' : 'Bewegung auswählen für KI-Vorschlag'}
                    </Button>
                  </div>
                </div>
              )}

              {/* KI-Buchungsvorschlag */}
              {kiVorschlag && (
                <div className="border border-purple-200 rounded-md bg-purple-50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-purple-800">🤖 KI-Buchungsvorschlag</p>
                    <button onClick={() => { setKiVorschlag(null); setSelectedTxForKi(null) }}
                      className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {kiVorschlag.begruendung && (
                    <p className="text-gray-600 italic">{kiVorschlag.begruendung}</p>
                  )}
                  {kiVorschlag.vorschlaege?.map((vorschlag: any, vi: number) => (
                    <div key={vi} className="border border-purple-200 rounded bg-white p-2 space-y-1.5">
                      <p className="font-medium text-gray-700">{vorschlag.beschreibung}</p>
                      {/* Vorlage-Referenz */}
                      {vorschlag.vorlage_bs_nummer && (
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                          <span>📋 Vorlage: <span className="font-mono text-blue-700">BS#{vorschlag.vorlage_bs_nummer}</span></span>
                          {vorschlag.vorlage_kontakt_name && (
                            <span>👤 {vorschlag.vorlage_kontakt_name}</span>
                          )}
                          {vorschlag.vorlage_beleg_url && vorschlag.vorlage_beleg_url !== 'null' && (
                            <a href={vorschlag.vorlage_beleg_url} target="_blank" rel="noreferrer"
                              className="text-blue-500 hover:underline flex items-center gap-1">
                              📄 Beleg öffnen
                            </a>
                          )}
                        </div>
                      )}
                      <div className="border rounded overflow-hidden">
                        <div className="grid gap-1 px-2 py-1 bg-gray-50 border-b font-medium text-gray-600" style={{gridTemplateColumns: '1fr 5rem 1fr 1fr'}}>
                          <div>Buchungstext</div>
                          <div>Betrag</div>
                          <div>Sollkonto</div>
                          <div>Habenkonto</div>
                        </div>
                        {vorschlag.buchungen?.map((b: any, bi: number) => (
                          <div key={bi} className="grid gap-1 px-2 py-1 border-b last:border-0" style={{gridTemplateColumns: '1fr 5rem 1fr 1fr'}}>
                            <span className="text-gray-700">{b.buchungstext}</span>
                            <span className="font-medium">{b.betrag?.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                            <span><span className="font-mono text-blue-700">{b.sollkonto_nr}</span> {b.sollkonto_name}</span>
                            <span><span className="font-mono text-blue-700">{b.habenkonto_nr}</span> {b.habenkonto_name}</span>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" className="gap-1.5 w-full"
                        onClick={async () => {
                          const lookupKonto = async (nr: string) => {
                            if (!nr) return ''
                            const trimmed = nr.toString().trim()
                            // Nur Einträge mit Beschriftung — leere sind technische Header
                            const { data } = await supabase.from('skr03')
                              .select('id')
                              .eq('kontonummer', trimmed)
                              .not('beschriftung', 'is', null)
                              .limit(1)
                            return data?.[0]?.id ?? ''
                          }

                          const newBuchungen: BuchungForm[] = []
                          for (const b of vorschlag.buchungen ?? []) {
                            const [sollId, habenId] = await Promise.all([
                              lookupKonto(b.sollkonto_nr),
                              lookupKonto(b.habenkonto_nr),
                            ])
                            newBuchungen.push({
                              datum: selectedTxForKi?.booking_date || bsForm.datum,
                              betrag: b.betrag?.toString().replace('.', ',') ?? '',
                              sollkonto_id: sollId,
                              habenkonto_id: habenId,
                              buchungstext: b.buchungstext ?? '',
                              anmerkungen: '',
                            })
                          }
                          setBuchungenForm(prev => [...prev, ...newBuchungen])
                          setKiVorschlag(null)
                          setSelectedTxForKi(null)
                        }}>
                        <CheckCircle className="h-3.5 w-3.5" />Buchungen übernehmen
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buchungszeilen */}
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-gray-700 mr-auto">Buchungen</h3>
                {/* Daten aus Beleg übernehmen */}
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={() => {
                    const idx = activeBuchungIdx
                    if (buchungenForm.length === 0) { addBuchung(); return }
                    setBuchungenForm(prev => prev.map((b, i) => i === idx ? {
                      ...b,
                      datum: bsForm.belegdatum || bsForm.datum || b.datum,
                      buchungstext: bsForm.belegnummer || b.buchungstext,
                    } : b))
                  }}>
                  📄 Aus Beleg
                </Button>
                {/* Daten aus Geldkontobewegung übernehmen */}
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                  disabled={linkedTransactions.length === 0}
                  title={linkedTransactions.length === 0 ? 'Erst eine Geldkontobewegung verknüpfen' : ''}
                  onClick={async () => {
                    const tx = selectedTxForKi ?? linkedTransactions[0]
                    if (!tx) return
                    const idx = activeBuchungIdx
                    if (buchungenForm.length === 0) { addBuchung(); return }
                    // Bank-Konto (1200) laden
                    const { data: bankData } = await supabase.from('skr03')
                      .select('id').eq('kontonummer', '1200').not('beschriftung', 'is', null).limit(1)
                    const bankId = bankData?.[0]?.id ?? ''
                    const isEingang = (tx.amount ?? 0) > 0
                    setBuchungenForm(prev => prev.map((b, i) => i === idx ? {
                      ...b,
                      datum: tx.booking_date || b.datum,
                      betrag: tx.amount ? Math.abs(tx.amount).toString().replace('.', ',') : b.betrag,
                      buchungstext: tx.purpose || b.buchungstext,
                      // Eingang (positiv): Bank SOLL, Haben leer; Ausgang (negativ): Haben Bank, Soll leer
                      sollkonto_id: isEingang ? bankId : b.sollkonto_id,
                      habenkonto_id: isEingang ? b.habenkonto_id : bankId,
                    } : b))
                    if (tx.counterpart_name && !bsForm.contact_id) {
                      setBsForm(f => ({ ...f, buchungstext: f.buchungstext || tx.counterpart_name }))
                    }
                  }}>
                  💳 Aus Geldkontobewegung
                </Button>
                {/* MwSt-Rechner — nur aktive Zeile */}
                <select className="text-xs h-8 border border-input rounded-md px-2 bg-white"
                  defaultValue=""
                  onChange={async e => {
                    const val = e.target.value
                    if (!val) return
                    const idx = activeBuchungIdx
                    const b = buchungenForm[idx]

                    if (val === 'buchung7' || val === 'buchung19') {
                      if (!b || !b.betrag) { e.target.value = ''; return }
                      const brutto = parseFloat(b.betrag.replace(',', '.'))
                      if (isNaN(brutto)) { e.target.value = ''; return }
                      const rate = val === 'buchung7' ? 0.07 : 0.19
                      const netto = brutto / (1 + rate)
                      const steuerBetrag = brutto - netto

                      // Bank-Konto laden um Richtung zu ermitteln
                      const { data: bankData } = await supabase.from('skr03')
                        .select('id').eq('kontonummer', '1200').not('beschriftung', 'is', null).limit(1)
                      const bankId = bankData?.[0]?.id ?? ''

                      // Richtung: Bank im Soll → Geld raus → USt; Bank im Haben → Geld rein → Vorsteuer
                      const bankImSoll = b.sollkonto_id === bankId
                      const bankImHaben = b.habenkonto_id === bankId
                      // Fallback über Belegtyp wenn Bank nicht direkt gesetzt
                      const belegtyp = bsForm.belegtyp
                      const isVorsteuer = bankImHaben || (!bankImSoll && belegtyp === 'eingangsrechnung')

                      const vstKto = val === 'buchung7' ? '1571' : '1576'
                      const ustKto = val === 'buchung7' ? '1771' : '1776'
                      const steuerKtoNr = isVorsteuer ? vstKto : ustKto

                      const { data: steuerData } = await supabase.from('skr03')
                        .select('id, beschriftung').eq('kontonummer', steuerKtoNr).not('beschriftung', 'is', null).limit(1)
                      const steuerKtoId = steuerData?.[0]?.id ?? ''
                      const steuerKtoName = steuerData?.[0]?.beschriftung ?? (isVorsteuer ? 'Vorsteuer' : 'Umsatzsteuer')

                      // Originalbuchung auf Netto kürzen
                      setBuchungenForm(prev => prev.map((row, i) => i !== idx ? row : {
                        ...row, betrag: netto.toFixed(2).replace('.', ','),
                      }))

                      // Steuer-Buchung spiegelt die Originalrichtung:
                      // Vorsteuer (Bank Haben): Vorsteuer SOLL, Gegenkonto HABEN (gleich wie Original-Haben)
                      // USt (Bank Soll): Gegenkonto SOLL (gleich wie Original-Soll), USt HABEN
                      const neueBuchung: BuchungForm = {
                        datum: b.datum,
                        betrag: steuerBetrag.toFixed(2).replace('.', ','),
                        sollkonto_id: isVorsteuer ? steuerKtoId : b.sollkonto_id,
                        habenkonto_id: isVorsteuer ? b.habenkonto_id : steuerKtoId,
                        buchungstext: b.buchungstext || '',
                        anmerkungen: '',
                      }
                      setBuchungenForm(prev => [...prev, neueBuchung])
                      setActiveBuchungIdx(buchungenForm.length)
                    } else {
                      setBuchungenForm(prev => prev.map((b, i) => {
                        if (i !== idx) return b
                        const betrag = parseFloat(b.betrag.replace(',', '.'))
                        if (isNaN(betrag)) return b
                        let neu: number
                        if (val === '7mwst') neu = betrag * 0.07
                        else if (val === '19mwst') neu = betrag * 0.19
                        else {
                          const rate = val.startsWith('7') ? 0.07 : 0.19
                          neu = val.endsWith('+') ? betrag * (1 + rate) : betrag / (1 + rate)
                        }
                        return { ...b, betrag: neu.toFixed(2).replace('.', ',') }
                      }))
                    }
                    e.target.value = ''
                  }}>
                  <option value="">MwSt anpassen</option>
                  <optgroup label="Kürzen (Brutto→Netto)">
                    <option value="7-">÷ 7% MwSt</option>
                    <option value="19-">÷ 19% MwSt</option>
                  </optgroup>
                  <optgroup label="Erhöhen (Netto→Brutto)">
                    <option value="7+">× 7% MwSt</option>
                    <option value="19+">× 19% MwSt</option>
                  </optgroup>
                  <optgroup label="MwSt-Betrag berechnen">
                    <option value="7mwst">7% aus Betrag</option>
                    <option value="19mwst">19% aus Betrag</option>
                  </optgroup>
                  <optgroup label="MwSt-Buchung erstellen">
                    <option value="buchung7">Buchung 7%</option>
                    <option value="buchung19">Buchung 19%</option>
                  </optgroup>
                </select>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addBuchung}>
                  <Plus className="h-3.5 w-3.5" />Buchung hinzufügen
                </Button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid gap-1 px-3 py-2 bg-white border-b text-xs font-medium text-gray-600" style={{gridTemplateColumns: '9rem 5rem 1fr 1fr 1fr auto'}}>
                  <div>Datum</div>
                  <div>Betrag</div>
                  <div>Sollkonto</div>
                  <div>Habenkonto</div>
                  <div>Buchungstext</div>
                  <div className="w-7"></div>
                </div>
                {buchungenForm.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-gray-400 bg-white">
                    Noch keine Buchungen — oben "Buchung hinzufügen" klicken
                  </div>
                )}
                {buchungenForm.map((b, i) => (
                  <div key={i}
                    className={`grid gap-1 px-3 py-2 items-center border-b last:border-0 cursor-pointer transition-colors ${activeBuchungIdx === i ? 'bg-blue-50 border-l-2 border-l-blue-400' : 'bg-white hover:bg-gray-50'}`}
                    style={{gridTemplateColumns: '9rem 5rem 1fr 1fr 1fr auto'}}
                    onClick={() => setActiveBuchungIdx(i)}>
                    <Input type="date" className="text-xs h-8" value={b.datum}
                      onChange={e => updateBuchung(i, 'datum', e.target.value)}
                      onClick={e => e.stopPropagation()} />
                    <Input className="text-xs h-8" placeholder="0,00" value={b.betrag}
                      onChange={e => updateBuchung(i, 'betrag', e.target.value)}
                      onClick={e => e.stopPropagation()} />
                    <KontoSearch value={b.sollkonto_id} onChange={v => updateBuchung(i, 'sollkonto_id', v)} placeholder="Soll..." />
                    <KontoSearch value={b.habenkonto_id} onChange={v => updateBuchung(i, 'habenkonto_id', v)} placeholder="Haben..." />
                    <Input className="text-xs h-8" value={b.buchungstext}
                      onChange={e => updateBuchung(i, 'buchungstext', e.target.value)}
                      onClick={e => e.stopPropagation()} />
                    <Button variant="ghost" size="icon" className="text-destructive h-7 w-7"
                      onClick={e => { e.stopPropagation(); removeBuchung(i) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving || deleting} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Speichert...' : 'Buchungssatz speichern'}
              </Button>
              <Button variant="outline" onClick={cancel} disabled={saving || deleting} className="gap-2">
                <X className="h-4 w-4" />Abbrechen
              </Button>

              {/* Löschen — nur für Admins, nur bei bestehendem BS */}
              {isAdmin && editingId !== 'new' && (
                <div className="flex items-center gap-2 ml-auto">
                  {!confirmDelete ? (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      disabled={saving || deleting}
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Buchungssatz löschen
                    </Button>
                  ) : (
                    <>
                      <span className="text-sm text-red-600 font-medium">Wirklich löschen?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleting}
                        onClick={async () => {
                          setDeleting(true)
                          try {
                            await del.mutateAsync(editingId as string)
                            cancel()
                          } catch (err: any) {
                            setError(err.message ?? 'Fehler beim Löschen')
                            setConfirmDelete(false)
                          } finally {
                            setDeleting(false)
                          }
                        }}
                        className="gap-1.5"
                      >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Ja, löschen
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                        Abbrechen
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Liste */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buchungstext, Belegnummer..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        {/* Sortierung */}
        <div className="flex items-center gap-1 border rounded-md overflow-hidden text-xs">
          {(['nummer','datum','betrag'] as const).map(field => (
            <button key={field}
              onClick={() => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('desc') } }}
              className={`px-3 py-2 font-medium flex items-center gap-1 transition-colors border-r last:border-0 ${sortField === field ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {field === 'nummer' ? 'Nr.' : field === 'datum' ? 'Datum' : 'Betrag'}
              {sortField === field && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {isLoading && <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}
      {!isLoading && (() => {
        const sorted = [...(buchungssaetze ?? [])].sort((a, b) => {
          let va: any, vb: any
          if (sortField === 'nummer') { va = a.nummer; vb = b.nummer }
          else if (sortField === 'datum') { va = a.datum; vb = b.datum }
          else { va = totalBuchungen(a); vb = totalBuchungen(b) }
          if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
          return sortDir === 'asc' ? va - vb : vb - va
        })
        return (
        <div className="grid gap-3">
          {sorted.length === 0 && (
            <Card><CardContent className="py-10 text-center text-gray-400">Keine Buchungssätze gefunden</CardContent></Card>
          )}
          {sorted.map(bs => {
            const isExpanded = expandedIds.has(bs.id)
            const { label, color } = STATUS_LABELS[bs.status] ?? STATUS_LABELS.offen
            const total = totalBuchungen(bs)
            const incomplete = isBsIncomplete(bs)
            return (
              <Card key={bs.id} className={`transition-shadow ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => toggleExpand(bs.id)}>
                    <div className="text-gray-400 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <div className="w-16 text-xs font-mono text-gray-500 flex-shrink-0">#{bs.nummer}</div>
                    <div className="w-28 flex-shrink-0 text-sm font-medium">{formatDate(bs.datum)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${color}`}>{label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{bs.buchungstext || '–'}</p>
                      {bs.belegnummer && <p className="text-xs text-gray-400">Beleg: {bs.belegnummer}</p>}
                    </div>
                    <div className="w-32 text-right flex-shrink-0">
                      <p className={`font-medium ${incomplete ? 'text-red-600' : 'text-gray-900'}`}>{formatAmount(total)}</p>
                      <p className="text-xs text-gray-400">{(bs.buchungen ?? []).length} Buchung(en)</p>
                    </div>
                    {/* Piktogramme in fixer Breite damit Beträge immer gleich ausgerichtet */}
                    <div className="w-10 flex gap-1 flex-shrink-0 justify-end">
                      {bs.beleg_sharepoint_url && (
                        <a href={bs.beleg_sharepoint_url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700" title="Beleg in SharePoint öffnen">
                          <Link className="h-4 w-4" />
                        </a>
                      )}
                      {bs.beleg_storage_path && (
                        <button className="text-green-500 hover:text-green-700" title="Hochgeladenen Beleg öffnen"
                          onClick={async (e) => { e.stopPropagation(); const url = await getBelegUrl(bs.beleg_storage_path!); window.open(url, '_blank') }}>
                          <Paperclip className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(bs)}><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => confirm('Buchungssatz wirklich löschen?') && del.mutate(bs.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-gray-50 px-6 py-4 space-y-4">
                      {/* Buchungszeilen */}
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 mb-2">Buchungszeilen</h3>
                        <div className="border rounded-md bg-white">
                          <div className="grid gap-1 px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-600" style={{gridTemplateColumns: '9rem 5rem 1fr 1fr 1fr'}}>
                            <div>Datum</div>
                            <div>Betrag</div>
                            <div>Sollkonto</div>
                            <div>Habenkonto</div>
                            <div>Buchungstext</div>
                          </div>
                          {(bs.buchungen ?? []).map(b => (
                            <div key={b.id} className="grid gap-1 px-3 py-1.5 items-center border-b last:border-0 text-xs" style={{gridTemplateColumns: '9rem 5rem 1fr 1fr 1fr'}}>
                              <div>{formatDate(b.datum)}</div>
                              <div className="font-medium">{formatAmount(b.betrag)}</div>
                              <div title={b.sollkonto ? `${b.sollkonto.kontonummer} ${b.sollkonto.beschriftung}` : ''}>
                                {b.sollkonto
                                  ? <span className="truncate block"><span className="font-mono text-blue-700">{b.sollkonto.kontonummer}</span> {b.sollkonto.beschriftung}</span>
                                  : '–'}
                              </div>
                              <div title={b.habenkonto ? `${b.habenkonto.kontonummer} ${b.habenkonto.beschriftung}` : ''}>
                                {b.habenkonto
                                  ? <span className="truncate block"><span className="font-mono text-blue-700">{b.habenkonto.kontonummer}</span> {b.habenkonto.beschriftung}</span>
                                  : '–'}
                              </div>
                              <div className="text-gray-600">{b.buchungstext || '–'}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Verknüpfte Bewegungen */}
                      {(bs.transactions ?? []).length > 0 && (
                        <div>
                          <h3 className="text-xs font-medium text-gray-500 mb-2">Verknüpfte Geldkontobewegungen</h3>
                          <div className="border rounded-md bg-white overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b">
                                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Datum</th>
                                  <th className="px-3 py-1.5 text-right font-medium text-gray-600">Betrag</th>
                                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Name</th>
                                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">IBAN</th>
                                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Verwendungszweck</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(bs.transactions ?? []).map((t: any) => (
                                  <tr key={t.id ?? t.transaction_id} className="border-b last:border-0">
                                    <td className="px-3 py-1.5">{t.booking_date}</td>
                                    <td className={`px-3 py-1.5 text-right font-medium ${(t.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {(t.amount ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                    <td className="px-3 py-1.5">{t.counterpart_name ?? '–'}</td>
                                    <td className="px-3 py-1.5 font-mono text-gray-500">{t.counterpart_iban ?? '–'}</td>
                                    <td className="px-3 py-1.5 text-gray-600 truncate max-w-48">{t.purpose ?? '–'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Meta + Status */}
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div><span className="font-medium text-gray-500">Anmerkungen: </span><span className="text-gray-700">{bs.anmerkungen || '–'}</span></div>
                        <div><span className="font-medium text-gray-500">Herkunft: </span><span className="text-gray-700">{HERKUNFT_LABELS[bs.herkunft]}</span></div>
                        <div><span className="font-medium text-gray-500">Erstellt von: </span><span className="text-gray-700">{bs.created_by_name || '–'}</span></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">Status:</span>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <button key={k} onClick={() => updateStatus.mutate({ id: bs.id, status: k as any })}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${bs.status === k ? v.color + ' border-transparent' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                              {v.label}
                            </button>
                          ))}
                        </div>
                        {/* KI-Vorlage Toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Als Vorlage verwenden</span>
                          <button
                            onClick={() => toggleKiVorlage.mutate({ id: bs.id, ki_vorlage: !bs.ki_vorlage })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${bs.ki_vorlage !== false ? 'bg-blue-600' : 'bg-gray-200'}`}
                            title={bs.ki_vorlage !== false ? 'Wird als KI-Vorlage verwendet — klicken zum Ausschließen' : 'Ausgeschlossen von KI-Vorlagen — klicken zum Einschließen'}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${bs.ki_vorlage !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        )
      })()}

      {/* SharePoint File Picker */}
      {showFilePicker && (
        <FilePicker
          initialPath={defaultBelegeFolder}
          onSelect={handleFilePickerSelect}
          onClose={() => setShowFilePicker(false)}
        />
      )}
    </div>
  )
}
