import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  useDocument, useDocumentTypes, useArticles,
  useCreateDocument, useUpdateDocument, useSaveDocumentItems,
  useDuplicateDocument, calcVatSummary, grossToNet, netToGross,
  type DocumentItem,
} from '@/modules/documents/hooks/useDocuments'
import { useContacts } from '@/hooks/useContacts'
import { usePropertyUsage } from '@/modules/properties/hooks/useProperties'
import { useAppSettings } from '@/hooks/useAppSettings'
import { supabase } from '@/lib/supabase'
import { generateDocumentPdfBlob, type FirmaData } from '@/modules/documents/pdf/DocumentPdf'
import { buildZugferdXml } from '@/modules/documents/pdf/ZugferdXml'
import { embedZugferdXml } from '@/modules/documents/pdf/embedZugferd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Save, Plus, Trash2, Copy, FileText,
  Search, Loader2, Lock, ChevronDown, ChevronUp, Package,
} from 'lucide-react'

type ItemDraft = {
  key: string        // lokaler Key für React
  description: string
  quantity: string
  gross_unit_price: string
  vat_rate: string
  article_id: string | null
}

function newItem(overrides?: Partial<ItemDraft>): ItemDraft {
  return {
    key: crypto.randomUUID(),
    description: '',
    quantity: '1',
    gross_unit_price: '',
    vat_rate: '19',
    article_id: null,
    ...overrides,
  }
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE')
}

export default function DocumentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()

  // Wenn aus Nutzung geöffnet: Kontext vorbelegen
  const prefill = location.state as {
    contact_id?: string
    service_from?: string
    service_to?: string
    subject_line2?: string
    usage_id?: string
    document_type_id?: string
  } | null

  const isEdit = !!id
  const { data: existing, isLoading } = useDocument(id ?? '')
  const { data: docTypes = [] } = useDocumentTypes()
  const { data: articles = [] } = useArticles()
  const { data: contactResult } = useContacts('', 0, 500)
  const contacts = contactResult?.data ?? []
  const { data: appSettings } = useAppSettings([
    'documents_folder_rechnung',
    'documents_folder_angebot',
    'firma_name', 'firma_strasse', 'firma_plz', 'firma_ort', 'firma_land',
    'firma_steuernummer', 'firma_ustid', 'firma_bankname', 'firma_iban', 'firma_bic',
  ])

  const createDoc = useCreateDocument()
  const updateDoc = useUpdateDocument()
  const saveItems = useSaveDocumentItems()
  const duplicateDoc = useDuplicateDocument()

  // ─── Formularstate ──────────────────────────────────────────────────────────
  const [docTypeId, setDocTypeId] = useState(prefill?.document_type_id ?? '')
  const [contactId, setContactId] = useState(prefill?.contact_id ?? '')
  const [contactSearch, setContactSearch] = useState('')
  const [usageId, setUsageId] = useState(prefill?.usage_id ?? '')
  const [subjectLine2, setSubjectLine2] = useState(prefill?.subject_line2 ?? '')
  const [serviceFrom, setServiceFrom] = useState(prefill?.service_from ?? '')
  const [serviceTo, setServiceTo] = useState(prefill?.service_to ?? '')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([newItem()])
  const [showArticlePicker, setShowArticlePicker] = useState<string | null>(null)
  const [articleSearch, setArticleSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingPdf, setCreatingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // Daten beim Bearbeiten laden
  useEffect(() => {
    if (!existing) return
    setDocTypeId(existing.document_type_id)
    setContactId(existing.contact_id ?? '')
    setUsageId(existing.usage_id ?? '')
    setSubjectLine2(existing.subject_line2 ?? '')
    setServiceFrom(existing.service_from ?? '')
    setServiceTo(existing.service_to ?? '')
    setNotes(existing.notes ?? '')
    if (existing.items && existing.items.length > 0) {
      setItems(existing.items.map(it => ({
        key: it.id,
        description: it.description,
        quantity: it.quantity.toString(),
        gross_unit_price: it.gross_unit_price.toString(),
        vat_rate: it.vat_rate.toString(),
        article_id: it.article_id,
      })))
    }
  }, [existing])

  const isFinalized = existing?.is_finalized ?? false

  // Ersten Dokumenttyp vorwählen
  useEffect(() => {
    if (!docTypeId && docTypes.length > 0) setDocTypeId(docTypes[0].id)
  }, [docTypes])

  const selectedType = docTypes.find(t => t.id === docTypeId)

  // ─── Nutzungs-Verknüpfung ───────────────────────────────────────────────────
  const { data: linkedUsage } = usePropertyUsage(usageId)

  // ─── Kontakt-Suche ──────────────────────────────────────────────────────────
  const filteredContacts = contacts.filter(c => {
    const name = c.is_company ? c.company_name ?? '' : [c.first_name, c.last_name].filter(Boolean).join(' ')
    return name.toLowerCase().includes(contactSearch.toLowerCase())
  })
  const selectedContact = contacts.find(c => c.id === contactId)
  const contactName = selectedContact
    ? selectedContact.is_company
      ? selectedContact.company_name ?? ''
      : [selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ')
    : ''

  // ─── Positionen ─────────────────────────────────────────────────────────────
  const setItem = (key: string, field: keyof ItemDraft, value: string) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, [field]: value } : it))
  }

  const removeItem = (key: string) => {
    setItems(prev => prev.filter(it => it.key !== key))
  }

  const applyArticle = (itemKey: string, articleId: string) => {
    const a = articles.find(x => x.id === articleId)
    if (!a) return
    const gross = a.gross_price ?? (a.net_price != null ? netToGross(a.net_price, a.vat_rate) : 0)
    setItems(prev => prev.map(it => it.key === itemKey ? {
      ...it,
      description: a.name,
      quantity: a.quantity.toString(),
      gross_unit_price: gross.toFixed(2),
      vat_rate: a.vat_rate.toString(),
      article_id: a.id,
    } : it))
    setShowArticlePicker(null)
    setArticleSearch('')
  }

  // ─── Summen ─────────────────────────────────────────────────────────────────
  const parsedItems = items
    .filter(it => it.description && it.gross_unit_price)
    .map(it => ({
      quantity: parseFloat(it.quantity) || 1,
      gross_unit_price: parseFloat(it.gross_unit_price) || 0,
      vat_rate: parseFloat(it.vat_rate) || 0,
    }))

  const vatSummary = calcVatSummary(parsedItems)
  const totalGross = vatSummary.reduce((s, r) => s + r.grossTotal, 0)
  const totalNet = vatSummary.reduce((s, r) => s + r.netTotal, 0)
  const totalVat = vatSummary.reduce((s, r) => s + r.vatAmount, 0)

  // ─── Speichern ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!docTypeId) { setError('Belegtyp auswählen'); return }
    setSaving(true); setError(null)
    try {
      let docId = id
      if (!isEdit) {
        docId = await createDoc.mutateAsync({
          document_type_id: docTypeId,
          prefix: selectedType?.prefix ?? 'X',
          contact_id: contactId || null,
          usage_id: usageId || null,
          subject_line2: subjectLine2 || null,
          service_from: serviceFrom || null,
          service_to: serviceTo || null,
          notes: notes || null,
        })
      } else {
        await updateDoc.mutateAsync({
          id: id!,
          contact_id: contactId || null,
          usage_id: usageId || null,
          subject_line2: subjectLine2 || null,
          service_from: serviceFrom || null,
          service_to: serviceTo || null,
          notes: notes || null,
        })
      }

      await saveItems.mutateAsync({
        documentId: docId!,
        items: items
          .filter(it => it.description.trim())
          .map((it, i) => ({
            document_id: docId!,
            position: i + 1,
            description: it.description.trim(),
            quantity: parseFloat(it.quantity) || 1,
            gross_unit_price: parseFloat(it.gross_unit_price) || 0,
            vat_rate: parseFloat(it.vat_rate) || 0,
            article_id: it.article_id,
          })),
      })

      if (!isEdit) {
        navigate(`/documents/${docId}/edit`)
      }
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  // ─── PDF erstellen ──────────────────────────────────────────────────────────
  const handleCreatePdf = async () => {
    if (!id || !existing) return
    if (!existing.items || existing.items.length === 0) {
      setPdfError('Keine Positionen vorhanden. Bitte zuerst speichern.')
      return
    }
    if (!existing.document_type) {
      setPdfError('Belegtyp nicht geladen.')
      return
    }

    setCreatingPdf(true); setPdfError(null)
    try {
      // ── Firmendaten aus Settings ──
      const firma: FirmaData = {
        name:              appSettings?.firma_name        ?? 'natureandfriends am Üdersee GmbH',
        strasse:           appSettings?.firma_strasse     ?? 'Üdersee Süd 111',
        plz:               appSettings?.firma_plz         ?? '16244',
        ort:               appSettings?.firma_ort         ?? 'Schorfheide',
        land:              appSettings?.firma_land        ?? 'Deutschland',
        steuernummer:      appSettings?.firma_steuernummer ?? undefined,
        ustid:             appSettings?.firma_ustid        ?? undefined,
        bankname:          appSettings?.firma_bankname    ?? 'Deutsche Bank AG',
        iban:              appSettings?.firma_iban        ?? 'DE42100700240627944200',
        bic:               appSettings?.firma_bic         ?? undefined,
        website:           'www.natureandfriends.de',
        handelsregister:   'AG Charlottenburg HRB 108817 B',
        geschaeftsfuehrer: 'Oliver Reetz',
      }

      // ── 1. PDF im Browser erzeugen ──
      const docForPdf = {
        ...existing,
        document_type: existing.document_type,
        items: existing.items,
      } as any

      let pdfBlob = await generateDocumentPdfBlob(docForPdf, firma)

      // ── 2. ZUGFeRD XML einbetten (nur bei Rechnungen) ──
      if (existing.document_type.name === 'Rechnung') {
        const xmlString = buildZugferdXml(docForPdf, firma)
        pdfBlob = await embedZugferdXml(pdfBlob, xmlString)
      }

      // ── 3. PDF-Dateiname bestimmen ──
      const fileName = `${existing.document_number}.pdf`

      // ── 4. Upload-Verzeichnis ermitteln ──
      // Priorität: verknüpfte Nutzung → Typ-spezifisches Verzeichnis
      let uploadFolder: string | null = null
      if (usageId && linkedUsage?.link_url) {
        // Wenn die Nutzung ein SharePoint-Verzeichnis hat, dorthin hochladen
        // link_url ist die SharePoint WebUrl des Ordners
        uploadFolder = null  // graph-service erkennt folder_url direkt
      }
      const typeFolderKey = existing.document_type.name === 'Rechnung'
        ? 'documents_folder_rechnung'
        : 'documents_folder_angebot'
      const typeFolder = appSettings?.[typeFolderKey] ?? null

      // ── 5. Upload via graph-service ──
      const { data: { session } } = await supabase.auth.getSession()

      // PDF als base64 für JSON-Transport
      const pdfArrayBuffer = await pdfBlob.arrayBuffer()
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)))

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'uploadPdf',
            payload: {
              fileName,
              pdfBase64,
              // Zielverzeichnis: Nutzungs-Ordner hat Vorrang
              folderUrl: (usageId && linkedUsage?.link_url) ? linkedUsage.link_url : null,
              folderPath: (usageId && linkedUsage?.link_url) ? null : typeFolder,
            },
          }),
        }
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Fehler beim PDF-Upload')

      // ── 6. Dokument als finalisiert markieren ──
      await updateDoc.mutateAsync({
        id,
        is_finalized: true,
        pdf_path: json.webUrl ?? json.downloadUrl ?? null,
        pdf_created_at: new Date().toISOString(),
      })

      // ── 7. Direktdownload anbieten ──
      const url = URL.createObjectURL(pdfBlob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)

    } catch (err: any) {
      setPdfError(err.message ?? 'Unbekannter Fehler')
    } finally {
      setCreatingPdf(false)
    }
  }

  const handleDuplicate = async () => {
    if (!id) return
    const newId = await duplicateDoc.mutateAsync(id)
    navigate(`/documents/${newId}/edit`)
  }

  if (isLoading && isEdit) return <div className="p-6 text-gray-500">Wird geladen…</div>

  // ─── Erste Betreff-Zeile (automatisch) ──────────────────────────────────────
  const docNumber = existing?.document_number ?? (selectedType ? `${selectedType.prefix}-…` : '…')
  const subjectLine1 = `${selectedType?.name ?? 'Beleg'} ${docNumber}${
    serviceFrom ? ` für Leistungszeitraum ${fmtDate(serviceFrom)}${serviceTo ? `–${fmtDate(serviceTo)}` : ''}` : ''
  }`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? (existing?.document_number ?? 'Beleg') : 'Neuer Beleg'}
            </h1>
            {isFinalized && (
              <Badge className="bg-gray-100 text-gray-600 border border-gray-200 gap-1">
                <Lock className="h-3 w-3" /> Abgeschlossen
              </Badge>
            )}
          </div>
          {existing?.document_type?.name && (
            <p className="text-sm text-gray-500">{existing.document_type.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isFinalized && (
            <Button variant="outline" className="gap-2" onClick={handleDuplicate}>
              <Copy className="h-4 w-4" /> Duplizieren
            </Button>
          )}
          {!isFinalized && isEdit && (
            <Button
              variant="outline"
              className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
              onClick={handleCreatePdf}
              disabled={creatingPdf}
            >
              {creatingPdf
                ? <><Loader2 className="h-4 w-4 animate-spin" /> PDF wird erstellt…</>
                : <><FileText className="h-4 w-4" /> PDF erstellen & abschließen</>}
            </Button>
          )}
          {!isFinalized && (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}
      {pdfError && <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">{pdfError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte */}
        <div className="lg:col-span-2 space-y-4">

          {/* Belegtyp – nur bei neuem Beleg */}
          {!isEdit && (
            <Card>
              <CardHeader><CardTitle className="text-base">Belegtyp</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {docTypes.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDocTypeId(t.id)}
                      className={`px-5 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
                        docTypeId === t.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-blue-200'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Betreff */}
          <Card>
            <CardHeader><CardTitle className="text-base">Betreff</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-gray-400">Zeile 1 (automatisch)</Label>
                <div className="mt-1 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 font-mono">
                  {subjectLine1}
                </div>
              </div>
              <div>
                <Label>Leistungszeitraum</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Input type="date" value={serviceFrom} disabled={isFinalized}
                    onChange={e => setServiceFrom(e.target.value)} placeholder="Von" />
                  <Input type="date" value={serviceTo} disabled={isFinalized}
                    onChange={e => setServiceTo(e.target.value)} placeholder="Bis" />
                </div>
              </div>
              <div>
                <Label>Zeile 2 (frei)</Label>
                <textarea
                  className="mt-1 w-full min-h-16 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  value={subjectLine2}
                  onChange={e => setSubjectLine2(e.target.value)}
                  disabled={isFinalized}
                  placeholder="z.B. Einheit XY, Hochzeit Müller …"
                />
              </div>
            </CardContent>
          </Card>

          {/* Belegpositionen */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Positionen
                {!isFinalized && (
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                    onClick={() => setItems(p => [...p, newItem()])}>
                    <Plus className="h-3.5 w-3.5" /> Position
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {/* Header */}
              <div className="grid text-xs font-semibold text-gray-400 uppercase tracking-wide px-2"
                style={{ gridTemplateColumns: '2.5rem 1fr 5rem 7rem 5rem 2rem' }}>
                <span>Nr.</span>
                <span>Bezeichnung</span>
                <span className="text-right">Menge</span>
                <span className="text-right">Brutto-EP</span>
                <span className="text-right">MwSt.</span>
                <span />
              </div>

              {items.map((item, idx) => (
                <div key={item.key} className="relative">
                  <div
                    className={`grid gap-1 items-start px-2 py-2 rounded-md ${isFinalized ? 'bg-gray-50' : 'bg-white border border-gray-100 hover:border-blue-100'}`}
                    style={{ gridTemplateColumns: '2.5rem 1fr 5rem 7rem 5rem 2rem' }}
                  >
                    <span className="text-sm text-gray-400 pt-2 text-center">{idx + 1}</span>

                    <div className="space-y-1">
                      <Input
                        value={item.description}
                        disabled={isFinalized}
                        onChange={e => setItem(item.key, 'description', e.target.value)}
                        placeholder="Bezeichnung"
                        className="text-sm"
                      />
                      {!isFinalized && (
                        <button
                          type="button"
                          onClick={() => { setShowArticlePicker(item.key); setArticleSearch('') }}
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Package className="h-3 w-3" /> Artikel wählen
                        </button>
                      )}
                      {/* Artikel-Picker Dropdown */}
                      {showArticlePicker === item.key && (
                        <div className="absolute left-10 z-20 mt-1 w-80 bg-white border rounded-md shadow-lg">
                          <div className="p-2 border-b">
                            <Input
                              autoFocus
                              placeholder="Artikel suchen…"
                              value={articleSearch}
                              onChange={e => setArticleSearch(e.target.value)}
                              className="text-sm h-8"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {articles
                              .filter(a => a.name.toLowerCase().includes(articleSearch.toLowerCase()))
                              .map(a => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => applyArticle(item.key, a.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                                >
                                  <span className="font-medium">{a.name}</span>
                                  {a.gross_price != null && (
                                    <span className="ml-2 text-gray-400 text-xs">{a.gross_price.toFixed(2)} € brutto</span>
                                  )}
                                </button>
                              ))}
                          </div>
                          <div className="p-2 border-t">
                            <Button size="sm" variant="ghost" className="w-full text-xs h-7"
                              onClick={() => { setShowArticlePicker(null) }}>
                              Schließen
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Input
                      value={item.quantity}
                      disabled={isFinalized}
                      onChange={e => setItem(item.key, 'quantity', e.target.value)}
                      type="number" min="0.001" step="0.001"
                      className="text-right text-sm"
                    />
                    <Input
                      value={item.gross_unit_price}
                      disabled={isFinalized}
                      onChange={e => setItem(item.key, 'gross_unit_price', e.target.value)}
                      type="number" min="0" step="0.01"
                      className="text-right text-sm"
                      placeholder="0,00"
                    />
                    <div className="relative">
                      <Input
                        value={item.vat_rate}
                        disabled={isFinalized}
                        onChange={e => setItem(item.key, 'vat_rate', e.target.value)}
                        type="number" min="0" max="100" step="0.01"
                        className="text-right text-sm pr-6"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    {!isFinalized && (
                      <button type="button" onClick={() => removeItem(item.key)}
                        className="text-red-300 hover:text-red-500 pt-2 flex justify-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Zeilensumme */}
                  {item.gross_unit_price && (
                    <div className="text-right text-xs text-gray-400 pr-10 pb-1">
                      = {fmtEur((parseFloat(item.quantity) || 1) * (parseFloat(item.gross_unit_price) || 0))} brutto
                    </div>
                  )}
                </div>
              ))}

              {/* MwSt-Aufschlüsselung + Summen */}
              {parsedItems.length > 0 && (
                <div className="border-t pt-3 mt-2 space-y-1">
                  {vatSummary.map(row => (
                    <div key={row.vatRate} className="flex justify-between text-sm text-gray-600 px-2">
                      <span>Netto ({row.vatRate} % MwSt.)</span>
                      <span className="tabular-nums">{fmtEur(row.netTotal)}</span>
                      <span className="text-gray-400">MwSt. {fmtEur(row.vatAmount)}</span>
                      <span className="font-medium">Brutto {fmtEur(row.grossTotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold text-gray-900 border-t pt-2 px-2">
                    <span>Gesamt Netto</span>
                    <span className="tabular-nums">{fmtEur(totalNet)}</span>
                    <span>MwSt. {fmtEur(totalVat)}</span>
                    <span className="text-blue-700 text-base">Brutto {fmtEur(totalGross)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-4">

          {/* Empfänger */}
          <Card>
            <CardHeader><CardTitle className="text-base">Empfänger</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {contactId && selectedContact ? (
                <div className="p-3 bg-blue-50 rounded-md text-sm space-y-0.5">
                  <div className="font-semibold text-gray-900">{contactName}</div>
                  {selectedContact.address_street && <div className="text-gray-600">{selectedContact.address_street}</div>}
                  {(selectedContact.address_zip || selectedContact.address_city) && (
                    <div className="text-gray-600">{[selectedContact.address_zip, selectedContact.address_city].filter(Boolean).join(' ')}</div>
                  )}
                  {!isFinalized && (
                    <button className="text-xs text-blue-600 hover:underline mt-1" onClick={() => setContactId('')}>
                      Ändern
                    </button>
                  )}
                </div>
              ) : !isFinalized ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      className="pl-10"
                      placeholder="Kontakt suchen…"
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                    />
                  </div>
                  {contactSearch && (
                    <div className="border rounded-md bg-white shadow-sm max-h-48 overflow-y-auto">
                      {filteredContacts.slice(0, 15).map(c => (
                        <button key={c.id}
                          onClick={() => { setContactId(c.id); setContactSearch('') }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0">
                          {c.is_company ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-400">Kein Empfänger</div>
              )}
            </CardContent>
          </Card>

          {/* Nutzungsverknüpfung */}
          <Card>
            <CardHeader><CardTitle className="text-base">Nutzung (optional)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {usageId && linkedUsage ? (
                <div className="p-3 bg-gray-50 rounded-md text-sm space-y-1">
                  <div className="font-medium text-gray-800">
                    {(linkedUsage as any).unit?.name ?? 'Einheit'}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {fmtDate(linkedUsage.date_from)} – {fmtDate(linkedUsage.date_to)}
                  </div>
                  {(linkedUsage as any).link_url ? (
                    <div className="text-xs text-green-600">✓ Verzeichnis vorhanden</div>
                  ) : (
                    <div className="text-xs text-amber-600">⚠ Kein Verzeichnis – PDF-Erstellung gesperrt</div>
                  )}
                  {!isFinalized && (
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => setUsageId('')}>
                      Verknüpfung entfernen
                    </button>
                  )}
                </div>
              ) : !isFinalized ? (
                <Input
                  placeholder="Nutzungs-ID eintragen…"
                  value={usageId}
                  onChange={e => setUsageId(e.target.value)}
                  className="font-mono text-xs"
                />
              ) : (
                <div className="text-sm text-gray-400">Keine Verknüpfung</div>
              )}
            </CardContent>
          </Card>

          {/* Notizen */}
          <Card>
            <CardHeader><CardTitle className="text-base">Interne Notizen</CardTitle></CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-20 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isFinalized}
                placeholder="Interne Bemerkungen (nicht auf dem Beleg)"
              />
            </CardContent>
          </Card>

          {/* PDF-Status */}
          {existing?.pdf_path && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3 space-y-1">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <FileText className="h-4 w-4" /> PDF erstellt
                </div>
                <div className="text-xs text-green-600">
                  {existing.pdf_created_at ? new Date(existing.pdf_created_at).toLocaleString('de-DE') : ''}
                </div>
                <a href={existing.pdf_path} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">
                  PDF öffnen →
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
