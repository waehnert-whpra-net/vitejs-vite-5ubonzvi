import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useContacts } from '@/hooks/useContacts'
import { usePropertyUsages } from '@/modules/properties/hooks/useProperties'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useSaveUnitDocument } from '@/hooks/useDocuments'
import FolderPicker from '@/components/FolderPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, FileText, Search, FolderOpen, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

type Props = {
  unit: {
    id: string
    name: string | null
    short_code: string | null
    location: string | null
    document_folder?: string | null
    area?: { name: string } | null
  }
  onClose: () => void
}

type TemplateFile = { id: string; name: string }

const GRAPH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`
const CREATE_DOC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-document`

const SETTING_KEYS = ['default_template_folder', 'default_documents_folder']

async function callGraph(action: string, payload: any) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, payload }),
  })
  return res.json()
}

export default function CreateDocumentDialog({ unit, onClose }: Props) {
  const { data: settings } = useAppSettings(SETTING_KEYS)
  const { data: contactsResult } = useContacts('', 0, 1000)
  const { data: usages } = usePropertyUsages(unit.id)
  const saveUnitDocument = useSaveUnitDocument()

  const defaultTemplateFolder = settings?.default_template_folder ?? '/FLOX/Templates'
  const defaultDocumentsFolder = unit.document_folder ?? settings?.default_documents_folder ?? '/FLOX/Dokumente'

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const [templates, setTemplates] = useState<TemplateFile[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateFile | null>(null)
  const [fileName, setFileName] = useState(today + '_')
  const [contactSource, setContactSource] = useState<'all' | 'unit'>('unit')
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [outputFolder, setOutputFolder] = useState(defaultDocumentsFolder)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; webUrl?: string; error?: string } | null>(null)

  // Templates laden wenn Dialog öffnet
  useEffect(() => {
    loadTemplates(defaultTemplateFolder)
  }, [defaultTemplateFolder])

  // Output folder aktualisieren wenn Settings geladen
  useEffect(() => {
    if (unit.document_folder) {
      setOutputFolder(unit.document_folder)
    } else if (settings?.default_documents_folder) {
      setOutputFolder(settings.default_documents_folder)
    }
  }, [settings, unit.document_folder])

  const loadTemplates = async (path: string) => {
    setLoadingTemplates(true)
    try {
      const data = await callGraph('listFiles', { path })
      if (data.success) setTemplates(data.files ?? [])
    } finally {
      setLoadingTemplates(false)
    }
  }

  // Kontakte je nach Quelle
  const allContacts = contactsResult?.data ?? []
  const unitContactIds = new Set(usages?.map(u => u.contact_id).filter(Boolean) ?? [])
  const filteredContacts = (contactSource === 'unit'
    ? allContacts.filter(c => unitContactIds.has(c.id))
    : allContacts
  ).filter(c => {
    const name = c.is_company ? c.company_name ?? '' : [c.first_name, c.last_name].filter(Boolean).join(' ')
    return name.toLowerCase().includes(contactSearch.toLowerCase())
  })

  const selectedContact = allContacts.find(c => c.id === selectedContactId)
  const getContactName = (c: typeof selectedContact) => {
    if (!c) return ''
    return c.is_company ? c.company_name ?? '' : [c.first_name, c.last_name].filter(Boolean).join(' ')
  }

  const buildPlaceholders = () => {
    const c = selectedContact
    return {
      vorname: c?.first_name ?? '',
      nachname: c?.last_name ?? '',
      firma: c?.company_name ?? '',
      anrede: '',
      titel: '',
      position: c?.position ?? '',
      email: c?.email_main ?? '',
      telefon: c?.phone_main ?? '',
      mobil: c?.mobile_main ?? '',
      einheit_name: unit.name ?? unit.short_code ?? '',
      einheit_kuerzel: unit.short_code ?? '',
      einheit_lage: unit.location ?? '',
      einheit_bereich: unit.area?.name ?? '',
      erstellt_am: new Date().toLocaleDateString('de-DE'),
      datum_von: '',
      datum_bis: '',
      miete: '',
    }
  }

  const handleCreate = async () => {
    if (!selectedTemplate) return
    setCreating(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, display_name')
        .eq('id', user?.id)
        .maybeSingle()

      const creatorName = profile?.display_name
        || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        || user?.email
        || 'FLOX'

      const outputFileName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`
      const templatePath = `${defaultTemplateFolder}/${selectedTemplate.name}`
      const outputPath = `${outputFolder}/${outputFileName}`

      const res = await fetch(CREATE_DOC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          templatePath,
          outputPath,
          placeholders: buildPlaceholders(),
          creatorName,
          description: `${unit.name ?? unit.short_code} – ${selectedTemplate.name.replace('.docx', '')}`,
        }),
      })
      const data = await res.json()

      if (data.success) {
        // Dokument in DB speichern
        await saveUnitDocument.mutateAsync({
          unit_id: unit.id,
          contact_id: selectedContactId ?? undefined,
          name: outputFileName,
          onedrive_path: outputPath,
          onedrive_url: data.webUrl,
          created_by_name: creatorName,
        })
        setResult({ success: true, webUrl: data.webUrl })
      } else {
        setResult({ success: false, error: data.error })
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Dokument erstellen
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Einheit Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm text-blue-800">
            Einheit: <span className="font-medium">{unit.name ?? unit.short_code}</span>
            {unit.area && <span className="text-blue-600 ml-2">({unit.area.name})</span>}
          </div>

          {/* 1. Template wählen */}
          <div>
            <Label>1. Template wählen</Label>
            {loadingTemplates && (
              <div className="mt-2 text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Templates werden geladen...
              </div>
            )}
            {!loadingTemplates && templates.length === 0 && (
              <div className="mt-2 text-sm text-gray-400">
                Keine Templates im Verzeichnis <span className="font-mono">{defaultTemplateFolder}</span> gefunden.
              </div>
            )}
            {!loadingTemplates && templates.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left border transition-colors ${
                      selectedTemplate?.id === t.id
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    {t.name.replace('.docx', '')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Dateiname */}
          <div>
            <Label>2. Dateiname</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder={`${today}_Mietvertrag_Mustermann`}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 flex-shrink-0">.docx</span>
            </div>
          </div>

          {/* 3. Kontakt */}
          <div>
            <Label>3. Kontakt (Zieladresse)</Label>
            <div className="mt-2 flex gap-2 mb-2">
              <button
                onClick={() => setContactSource('unit')}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  contactSource === 'unit' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Bisherige Nutzer dieser Einheit
              </button>
              <button
                onClick={() => setContactSource('all')}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  contactSource === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Alle Kontakte
              </button>
            </div>

            {selectedContactId && (
              <div className="mb-2 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">
                ✅ {getContactName(selectedContact)}
                <button onClick={() => setSelectedContactId(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kontakt suchen..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {contactSearch && (
              <div className="border rounded-md bg-white shadow-sm max-h-40 overflow-y-auto mt-1">
                {filteredContacts.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">Keine Kontakte gefunden</div>
                )}
                {filteredContacts.slice(0, 20).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedContactId(c.id); setContactSearch('') }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                  >
                    <span className="font-medium">{getContactName(c)}</span>
                    {c.email_main && <span className="text-gray-400 ml-2 text-xs">{c.email_main}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Zielverzeichnis */}
          <div>
            <Label>4. Zielverzeichnis</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={outputFolder}
                readOnly
                className="flex-1 font-mono text-sm bg-gray-50"
              />
              <Button variant="outline" size="sm" onClick={() => setShowFolderPicker(true)} className="gap-1.5 flex-shrink-0">
                <FolderOpen className="h-4 w-4" />
                Ändern
              </Button>
            </div>
          </div>

          {/* Ergebnis */}
          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${
              result.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {result.success ? <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />}
              <div>
                {result.success ? (
                  <>
                    <p className="font-medium">Dokument erfolgreich erstellt!</p>
                    {result.webUrl && (
                      <a href={result.webUrl} target="_blank" rel="noreferrer" className="underline mt-1 block">
                        In SharePoint öffnen →
                      </a>
                    )}
                  </>
                ) : (
                  <p>{result.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Aktionen */}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" onClick={onClose}>
              {result?.success ? 'Schließen' : 'Abbrechen'}
            </Button>
            {!result?.success && (
              <Button
                onClick={handleCreate}
                disabled={!selectedTemplate || !fileName.trim() || creating}
                className="gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {creating ? 'Wird erstellt...' : 'Dokument erstellen'}
              </Button>
            )}
          </div>

        </CardContent>
      </Card>

      {showFolderPicker && (
        <FolderPicker
          initialPath={outputFolder}
          onSelect={(path) => { setOutputFolder(path); setShowFolderPicker(false) }}
          onClose={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  )
}
