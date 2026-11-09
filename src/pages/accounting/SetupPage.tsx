import { useState } from 'react'
import { useAppSettings, useSetAppSetting } from '@/hooks/useAppSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FolderPicker from '@/components/FolderPicker'
import { FolderOpen, Save, Settings, Building2 } from 'lucide-react'

const SETTING_KEYS = [
  'default_template_folder', 'default_documents_folder', 'default_belege_folder',
  'default_belege_folder_eingang', 'default_belege_folder_sonstiges',
  'buchungs_prompt',
  // Firmendaten
  'firma_name', 'firma_strasse', 'firma_plz', 'firma_ort', 'firma_land',
  'firma_steuernummer', 'firma_ustid', 'firma_bankname', 'firma_iban', 'firma_bic',
  // Beleg-Verzeichnisse
  'documents_folder_rechnung', 'documents_folder_angebot',
]

export default function SetupPage() {
  const { data: settings, isLoading } = useAppSettings(SETTING_KEYS)
  const setSetting = useSetAppSetting()

  const [templateFolder, setTemplateFolder] = useState<string | null>(null)
  const [documentsFolder, setDocumentsFolder] = useState<string | null>(null)
  const [belegeFolder, setBelegeFolder] = useState<string | null>(null)
  const [belegeFolderEingang, setBelegeFolderEingang] = useState<string | null>(null)

  const [belegeFolderSonstiges, setBelegeFolderSonstiges] = useState<string | null>(null)
  const [buchungsPrompt, setBuchungsPrompt] = useState<string | null>(null)
  // Firmendaten
  const [firmaName, setFirmaName] = useState<string | null>(null)
  const [firmaStrasse, setFirmaStrasse] = useState<string | null>(null)
  const [firmaPlz, setFirmaPlz] = useState<string | null>(null)
  const [firmaOrt, setFirmaOrt] = useState<string | null>(null)
  const [firmaLand, setFirmaLand] = useState<string | null>(null)
  const [firmaSteuernummer, setFirmaSteuernummer] = useState<string | null>(null)
  const [firmaUstid, setFirmaUstid] = useState<string | null>(null)
  const [firmaBankname, setFirmaBankname] = useState<string | null>(null)
  const [firmaIban, setFirmaIban] = useState<string | null>(null)
  const [firmaBic, setFirmaBic] = useState<string | null>(null)
  // Beleg-Verzeichnisse
  const [belegeFolderRechnung, setBelegeFolderRechnung] = useState<string | null>(null)
  const [belegeFolderAngebot, setBelegeFolderAngebot] = useState<string | null>(null)
  const [showBelegePickerRechnung, setShowBelegePickerRechnung] = useState(false)
  const [showBelegePickerAngebot, setShowBelegePickerAngebot] = useState(false)
  const [showBelegePicker, setShowBelegePicker] = useState(false)
  const [showBelegePickerEingang, setShowBelegePickerEingang] = useState(false)

  const [showBelegePickerSonstiges, setShowBelegePickerSonstiges] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showDocumentsPicker, setShowDocumentsPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lokale Werte initialisieren sobald Settings geladen
  const effectiveTemplateFolder = templateFolder ?? settings?.default_template_folder ?? '/FLOX/Templates'
  const effectiveDocumentsFolder = documentsFolder ?? settings?.default_documents_folder ?? '/FLOX/Dokumente'
  const effectiveBelegeFolder = belegeFolder ?? settings?.default_belege_folder ?? '/FLOX/Belege'
  const effectiveBelegeFolderEingang = belegeFolderEingang ?? settings?.default_belege_folder_eingang ?? '/FLOX/Belege/Eingangsrechnungen'

  const effectiveBelegeFolderSonstiges = belegeFolderSonstiges ?? settings?.default_belege_folder_sonstiges ?? '/FLOX/Belege/Sonstiges'
  const effectiveBuchungsPrompt = buchungsPrompt ?? settings?.buchungs_prompt ?? ''
  // Firmendaten effektive Werte
  const effectiveFirmaName = firmaName ?? settings?.firma_name ?? ''
  const effectiveFirmaStrasse = firmaStrasse ?? settings?.firma_strasse ?? ''
  const effectiveFirmaPlz = firmaPlz ?? settings?.firma_plz ?? ''
  const effectiveFirmaOrt = firmaOrt ?? settings?.firma_ort ?? ''
  const effectiveFirmaLand = firmaLand ?? settings?.firma_land ?? 'Deutschland'
  const effectiveFirmaSteuernummer = firmaSteuernummer ?? settings?.firma_steuernummer ?? ''
  const effectiveFirmaUstid = firmaUstid ?? settings?.firma_ustid ?? ''
  const effectiveFirmaBankname = firmaBankname ?? settings?.firma_bankname ?? ''
  const effectiveFirmaIban = firmaIban ?? settings?.firma_iban ?? ''
  const effectiveFirmaBic = firmaBic ?? settings?.firma_bic ?? ''
  // Beleg-Verzeichnisse effektive Werte
  const effectiveBelegeFolderRechnung = belegeFolderRechnung ?? settings?.documents_folder_rechnung ?? '/FLOX/Belege/Rechnungen'
  const effectiveBelegeFolderAngebot = belegeFolderAngebot ?? settings?.documents_folder_angebot ?? '/FLOX/Belege/Angebote'

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await setSetting.mutateAsync({ key: 'default_template_folder', value: effectiveTemplateFolder })
      await setSetting.mutateAsync({ key: 'default_documents_folder', value: effectiveDocumentsFolder })
      await setSetting.mutateAsync({ key: 'default_belege_folder', value: effectiveBelegeFolder })
      await setSetting.mutateAsync({ key: 'default_belege_folder_eingang', value: effectiveBelegeFolderEingang })

      await setSetting.mutateAsync({ key: 'default_belege_folder_sonstiges', value: effectiveBelegeFolderSonstiges })
      await setSetting.mutateAsync({ key: 'buchungs_prompt', value: effectiveBuchungsPrompt })
      // Firmendaten
      await setSetting.mutateAsync({ key: 'firma_name', value: effectiveFirmaName })
      await setSetting.mutateAsync({ key: 'firma_strasse', value: effectiveFirmaStrasse })
      await setSetting.mutateAsync({ key: 'firma_plz', value: effectiveFirmaPlz })
      await setSetting.mutateAsync({ key: 'firma_ort', value: effectiveFirmaOrt })
      await setSetting.mutateAsync({ key: 'firma_land', value: effectiveFirmaLand })
      await setSetting.mutateAsync({ key: 'firma_steuernummer', value: effectiveFirmaSteuernummer })
      await setSetting.mutateAsync({ key: 'firma_ustid', value: effectiveFirmaUstid })
      await setSetting.mutateAsync({ key: 'firma_bankname', value: effectiveFirmaBankname })
      await setSetting.mutateAsync({ key: 'firma_iban', value: effectiveFirmaIban })
      await setSetting.mutateAsync({ key: 'firma_bic', value: effectiveFirmaBic })
      // Beleg-Verzeichnisse
      await setSetting.mutateAsync({ key: 'documents_folder_rechnung', value: effectiveBelegeFolderRechnung })
      await setSetting.mutateAsync({ key: 'documents_folder_angebot', value: effectiveBelegeFolderAngebot })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="h-7 w-7 text-blue-600" />
          Setup
        </h1>
        <p className="text-gray-500 mt-1">Globale Einstellungen für FLOX</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          ✅ Einstellungen gespeichert
        </div>
      )}

      <div className="grid gap-6">

        {/* Firmendaten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Firmendaten
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Diese Daten werden auf Rechnungen und Angeboten verwendet.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Firmenname *</Label>
              <Input className="mt-1" value={isLoading ? '' : effectiveFirmaName}
                onChange={e => setFirmaName(e.target.value)} placeholder="z.B. natureandfriends am Üdersee GmbH" disabled={isLoading} />
            </div>
            <div>
              <Label>Straße & Hausnummer</Label>
              <Input className="mt-1" value={isLoading ? '' : effectiveFirmaStrasse}
                onChange={e => setFirmaStrasse(e.target.value)} placeholder="z.B. Musterstraße 1" disabled={isLoading} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>PLZ</Label>
                <Input className="mt-1" value={isLoading ? '' : effectiveFirmaPlz}
                  onChange={e => setFirmaPlz(e.target.value)} placeholder="12345" disabled={isLoading} />
              </div>
              <div className="col-span-2">
                <Label>Ort</Label>
                <Input className="mt-1" value={isLoading ? '' : effectiveFirmaOrt}
                  onChange={e => setFirmaOrt(e.target.value)} placeholder="Musterstadt" disabled={isLoading} />
              </div>
            </div>
            <div>
              <Label>Land</Label>
              <Input className="mt-1" value={isLoading ? '' : effectiveFirmaLand}
                onChange={e => setFirmaLand(e.target.value)} placeholder="Deutschland" disabled={isLoading} />
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-3">
              <div>
                <Label>Steuernummer</Label>
                <Input className="mt-1 font-mono" value={isLoading ? '' : effectiveFirmaSteuernummer}
                  onChange={e => setFirmaSteuernummer(e.target.value)} placeholder="12/345/67890" disabled={isLoading} />
              </div>
              <div>
                <Label>USt-IdNr.</Label>
                <Input className="mt-1 font-mono" value={isLoading ? '' : effectiveFirmaUstid}
                  onChange={e => setFirmaUstid(e.target.value)} placeholder="DE123456789" disabled={isLoading} />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Bankverbindung</p>
              <div>
                <Label>Bank</Label>
                <Input className="mt-1" value={isLoading ? '' : effectiveFirmaBankname}
                  onChange={e => setFirmaBankname(e.target.value)} placeholder="z.B. Sparkasse Musterstadt" disabled={isLoading} />
              </div>
              <div>
                <Label>IBAN</Label>
                <Input className="mt-1 font-mono tracking-wider" value={isLoading ? '' : effectiveFirmaIban}
                  onChange={e => setFirmaIban(e.target.value)} placeholder="DE12 3456 7890 1234 5678 90" disabled={isLoading} />
              </div>
              <div>
                <Label>BIC</Label>
                <Input className="mt-1 font-mono" value={isLoading ? '' : effectiveFirmaBic}
                  onChange={e => setFirmaBic(e.target.value)} placeholder="MUSTDEXXXX" disabled={isLoading} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verzeichnis-Einstellungen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-600" />
              Standard-Verzeichnisse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Template-Verzeichnis */}
            <div>
              <Label>Standard-Template-Verzeichnis</Label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">
                Hier werden Word-Templates gesucht, wenn kein anderes Verzeichnis gewählt wird
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={isLoading ? 'Lädt...' : effectiveTemplateFolder}
                  readOnly
                  className="flex-1 font-mono text-sm bg-gray-50"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowTemplatePicker(true)}
                  className="gap-2 flex-shrink-0"
                  disabled={isLoading}
                >
                  <FolderOpen className="h-4 w-4" />
                  Ändern
                </Button>
              </div>
            </div>

            {/* Dokumente-Verzeichnis */}
            <div>
              <Label>Standard-Dokumente-Verzeichnis</Label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">
                Hier werden erstellte Dokumente abgelegt, wenn einer Einheit kein eigenes Verzeichnis zugewiesen ist
              </p>
              <div className="flex items-center gap-2">
                <Input value={isLoading ? 'Lädt...' : effectiveDocumentsFolder} readOnly className="flex-1 font-mono text-sm bg-gray-50" />
                <Button variant="outline" onClick={() => setShowDocumentsPicker(true)} className="gap-2 flex-shrink-0" disabled={isLoading}>
                  <FolderOpen className="h-4 w-4" />Ändern
                </Button>
              </div>
            </div>

            {/* Belege-Verzeichnis */}
            <div>
              <Label>Standard-Belege-Verzeichnis (allgemein)</Label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">
                Standardpfad für Belege wenn kein spezifischer Typ gewählt ist
              </p>
              <div className="flex items-center gap-2">
                <Input value={isLoading ? 'Lädt...' : effectiveBelegeFolder} readOnly className="flex-1 font-mono text-sm bg-gray-50" />
                <Button variant="outline" onClick={() => setShowBelegePicker(true)} className="gap-2 flex-shrink-0" disabled={isLoading}>
                  <FolderOpen className="h-4 w-4" />Ändern
                </Button>
              </div>
            </div>

            {/* Typspezifische Belegverzeichnisse */}
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">Belegverzeichnisse nach Typ</p>
              <p className="text-xs text-gray-400">Der FilePicker öffnet automatisch das passende Verzeichnis je nach Belegtyp. PDF-Ausgangsbelege werden ebenfalls hier abgelegt.</p>

              <div>
                <Label className="text-xs">📥 Eingangsrechnungen</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={isLoading ? 'Lädt...' : effectiveBelegeFolderEingang} readOnly className="flex-1 font-mono text-sm bg-white" />
                  <Button variant="outline" size="sm" onClick={() => setShowBelegePickerEingang(true)} className="gap-2 flex-shrink-0" disabled={isLoading}>
                    <FolderOpen className="h-4 w-4" />Ändern
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">📁 Sonstiges</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={isLoading ? 'Lädt...' : effectiveBelegeFolderSonstiges} readOnly className="flex-1 font-mono text-sm bg-white" />
                  <Button variant="outline" size="sm" onClick={() => setShowBelegePickerSonstiges(true)} className="gap-2 flex-shrink-0" disabled={isLoading}>
                    <FolderOpen className="h-4 w-4" />Ändern
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">🧾 Rechnungen (PDF-Ausgangsbelege)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={isLoading ? 'Lädt...' : effectiveBelegeFolderRechnung} readOnly className="flex-1 font-mono text-sm bg-white" />
                  <Button variant="outline" size="sm" onClick={() => setShowBelegePickerRechnung(true)} className="gap-2 flex-shrink-0" disabled={isLoading}>
                    <FolderOpen className="h-4 w-4" />Ändern
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">📋 Angebote (PDF-Ausgangsbelege)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={isLoading ? 'Lädt...' : effectiveBelegeFolderAngebot} readOnly className="flex-1 font-mono text-sm bg-white" />
                  <Button variant="outline" size="sm" onClick={() => setShowBelegePickerAngebot(true)} className="gap-2 flex-shrink-0" disabled={isLoading}>
                    <FolderOpen className="h-4 w-4" />Ändern
                  </Button>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* KI-Buchungsanweisungen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KI-Buchungsanweisungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Eigener Prompt für Buchungsvorschläge</Label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">
                Diese Anweisungen werden bei jedem KI-Buchungsvorschlag mitgeschickt. Hier können betriebsspezifische Regeln definiert werden, z.B. abweichende Steuersätze, häufige Lieferanten oder Buchungskonventionen.
              </p>
              <textarea
                className="w-full min-h-40 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                placeholder={`Beispiel:\n- Wir betreiben ein Hotel, daher gilt für Übernachtungsleistungen 7% USt statt 19%\n- Lieferant "Stadtwerke GmbH" buche immer auf Konto 4200 (Raumkosten)\n- Bei Rechnungen von "Getränke Meyer" verwende Konto 3300 (Wareneinkauf 7%)\n- Unsere Hausbank ist die Sparkasse (Konto 1200)`}
                value={isLoading ? '' : effectiveBuchungsPrompt}
                onChange={e => setBuchungsPrompt(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-400 mt-1">
                Tipp: Je konkreter die Anweisungen, desto besser die Buchungsvorschläge.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Speichern */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || isLoading} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Speichert...' : 'Einstellungen speichern'}
          </Button>
        </div>

      </div>

      {/* Folder Picker Modals */}
      {showTemplatePicker && (
        <FolderPicker
          initialPath={effectiveTemplateFolder}
          onSelect={(path) => { setTemplateFolder(path); setShowTemplatePicker(false) }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
      {showBelegePicker && (
        <FolderPicker
          initialPath={effectiveBelegeFolder}
          onSelect={(path) => { setBelegeFolder(path); setShowBelegePicker(false) }}
          onClose={() => setShowBelegePicker(false)}
        />
      )}
      {showBelegePickerEingang && (
        <FolderPicker
          initialPath={effectiveBelegeFolderEingang}
          onSelect={(path) => { setBelegeFolderEingang(path); setShowBelegePickerEingang(false) }}
          onClose={() => setShowBelegePickerEingang(false)}
        />
      )}
      {showBelegePickerSonstiges && (
        <FolderPicker
          initialPath={effectiveBelegeFolderSonstiges}
          onSelect={(path) => { setBelegeFolderSonstiges(path); setShowBelegePickerSonstiges(false) }}
          onClose={() => setShowBelegePickerSonstiges(false)}
        />
      )}
      {showDocumentsPicker && (
        <FolderPicker
          initialPath={effectiveDocumentsFolder}
          onSelect={(path) => { setDocumentsFolder(path); setShowDocumentsPicker(false) }}
          onClose={() => setShowDocumentsPicker(false)}
        />
      )}
      {showBelegePickerRechnung && (
        <FolderPicker
          initialPath={effectiveBelegeFolderRechnung}
          onSelect={(path) => { setBelegeFolderRechnung(path); setShowBelegePickerRechnung(false) }}
          onClose={() => setShowBelegePickerRechnung(false)}
        />
      )}
      {showBelegePickerAngebot && (
        <FolderPicker
          initialPath={effectiveBelegeFolderAngebot}
          onSelect={(path) => { setBelegeFolderAngebot(path); setShowBelegePickerAngebot(false) }}
          onClose={() => setShowBelegePickerAngebot(false)}
        />
      )}
    </div>
  )
}
