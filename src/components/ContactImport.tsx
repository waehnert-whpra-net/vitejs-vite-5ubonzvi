import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, X, CheckCircle, AlertCircle, FileText, Pause, Play } from 'lucide-react'

type ImportResult = {
  success: number
  errors: { row: number; message: string }[]
  total: number
}

type Props = {
  onClose: () => void
  onSuccess: () => void
}

const CHUNK_SIZE = 50 // Zeilen pro Batch

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const rows = lines.slice(1).map(line =>
    line.split(';').map(v => v.trim().replace(/"/g, ''))
  )
  return { headers, rows }
}

function parseCSVRow(headers: string[], values: string[]) {
  const row: Record<string, string> = {}
  headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
  return row
}

function rowToContact(row: Record<string, string>) {
  return {
    is_company: row['firma'] === 'ja' || row['is_company'] === 'true',
    first_name: row['vorname'] || row['first_name'] || null,
    last_name: row['nachname'] || row['last_name'] || null,
    company_name: row['firmenname'] || row['company_name'] || null,
    email_main: row['email'] || row['email_main'] || null,
    phone_main: row['telefon'] || row['phone_main'] || null,
    mobile_main: row['mobil'] || row['mobile_main'] || null,
    position: row['position'] || null,
    department: row['abteilung'] || row['department'] || null,
    website: row['website'] || null,
    tax_number: row['steuernummer'] || row['tax_number'] || null,
    vat_id: row['ust_id'] || row['vat_id'] || null,
    customer_number: row['kundennummer'] || row['customer_number'] || null,
    notes: row['notizen'] || row['notes'] || null,
  }
}

function rowToAddress(row: Record<string, string>, contactId: string) {
  const hasAddress = row['strasse'] || row['street'] || row['ort'] || row['city'] || row['plz']
  if (!hasAddress) return null
  return {
    contact_id: contactId,
    address_type: 'Haupt',
    street: row['strasse'] || row['street'] || null,
    street_number: row['hausnummer'] || row['street_number'] || null,
    postal_code: row['plz'] || row['postal_code'] || null,
    city: row['ort'] || row['city'] || null,
    state: row['bundesland'] || row['state'] || null,
    country: row['land'] || row['country'] || 'Deutschland',
    is_primary: true,
  }
}

async function importChunk(
  headers: string[],
  rows: string[][],
  startIndex: number
): Promise<{ success: number; errors: { row: number; message: string }[] }> {
  const errors: { row: number; message: string }[] = []
  let success = 0

  // Alle Kontakte des Chunks auf einmal vorbereiten
  const contacts: ReturnType<typeof rowToContact>[] = []
  const validRowIndices: number[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = parseCSVRow(headers, rows[i])
    const contact = rowToContact(row)

    if (!contact.last_name && !contact.company_name && !contact.first_name) {
      errors.push({ row: startIndex + i + 2, message: 'Kein Name oder Firma' })
      continue
    }

    contacts.push(contact)
    validRowIndices.push(i)
  }

  if (contacts.length === 0) return { success, errors }

  // Alle Kontakte des Chunks auf einmal einfügen (bulk insert)
  const { data: inserted, error: insertError } = await supabase
    .from('contacts')
    .insert(contacts)
    .select('id')

  if (insertError) {
    // Fallback: einzeln einfügen wenn bulk fehlschlägt
    for (let i = 0; i < contacts.length; i++) {
      const { data, error } = await supabase
        .from('contacts')
        .insert(contacts[i])
        .select('id')
        .single()

      if (error) {
        errors.push({
          row: startIndex + validRowIndices[i] + 2,
          message: error.message
        })
      } else if (data) {
        const row = parseCSVRow(headers, rows[validRowIndices[i]])
        const address = rowToAddress(row, data.id)
        if (address) {
          await supabase.from('contact_addresses').insert(address)
        }
        success++
      }
    }
    return { success, errors }
  }

  // Adressen für alle erfolgreich eingefügten Kontakte
  if (inserted && inserted.length > 0) {
    const addresses = inserted
      .map((contact, i) => {
        const row = parseCSVRow(headers, rows[validRowIndices[i]])
        return rowToAddress(row, contact.id)
      })
      .filter(Boolean)

    if (addresses.length > 0) {
      await supabase.from('contact_addresses').insert(addresses)
    }

    success = inserted.length
  }

  return { success, errors }
}

export default function ContactImport({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [importing, setImporting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const pausedRef = useRef(false)
  const csvDataRef = useRef<{ headers: string[]; rows: string[][] } | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setProgress(0)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      csvDataRef.current = parsed
      setTotalRows(parsed.rows.length)
      const previewRows = parsed.rows.slice(0, 3).map(r =>
        parseCSVRow(parsed.headers, r)
      )
      setPreview(previewRows)
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handlePause = () => {
    pausedRef.current = true
    setPaused(true)
  }

  const handleResume = () => {
    pausedRef.current = false
    setPaused(false)
  }

  const handleImport = async () => {
    if (!csvDataRef.current) return
    const { headers, rows } = csvDataRef.current

    setImporting(true)
    setPaused(false)
    pausedRef.current = false

    const allErrors: { row: number; message: string }[] = []
    let totalSuccess = 0
    let processed = 0

    // In Chunks aufteilen
    const chunks: string[][][] = []
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + CHUNK_SIZE))
    }

    for (let c = 0; c < chunks.length; c++) {
      // Pause abwarten
      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 500))
      }

      const chunk = chunks[c]
      const { success, errors } = await importChunk(headers, chunk, c * CHUNK_SIZE)

      totalSuccess += success
      allErrors.push(...errors)
      processed += chunk.length

      // Fortschritt aktualisieren
      setProgress(Math.round((processed / rows.length) * 100))

      // Kurze Pause zwischen Chunks (verhindert Überlastung)
      await new Promise(r => setTimeout(r, 100))
    }

    setResult({ success: totalSuccess, errors: allErrors, total: rows.length })
    setImporting(false)
    if (totalSuccess > 0) onSuccess()
  }

  const progressColor = progress < 33 ? 'bg-blue-500' :
    progress < 66 ? 'bg-indigo-500' : 'bg-green-500'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Import aus CSV</CardTitle>
          {!importing && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">

          {/* CSV Format Hinweis */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">CSV Format (Semikolon-getrennt, UTF-8):</p>
            <p className="font-mono text-xs break-all">
              vorname;nachname;firmenname;email;telefon;mobil;position;strasse;hausnummer;plz;ort;land
            </p>
            <p className="mt-1 text-xs">
              Große Dateien werden automatisch in Pakete à {CHUNK_SIZE} Zeilen aufgeteilt.
            </p>
          </div>

          {/* Datei auswählen */}
          {!importing && !result && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              {file ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {totalRows.toLocaleString('de')} Zeilen gefunden
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">CSV Datei hier klicken oder ablegen</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          )}

          {/* Vorschau */}
          {preview.length > 0 && !importing && !result && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Vorschau (erste 3 Zeilen):
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(preview[0]).map(k => (
                        <th key={k} className="border px-2 py-1 text-left font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="border px-2 py-1 truncate max-w-24">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fortschritt */}
          {importing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {paused ? '⏸ Pausiert' : '⏳ Importiere...'}
                </span>
                <span className="text-gray-500">
                  {progress}% ({Math.round(progress * totalRows / 100).toLocaleString('de')} / {totalRows.toLocaleString('de')} Zeilen)
                </span>
              </div>
              {/* Fortschrittsbalken */}
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all duration-300 ${progressColor} ${!paused ? 'animate-pulse' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Pakete à {CHUNK_SIZE} Zeilen · Bitte Fenster nicht schließen
              </p>
            </div>
          )}

          {/* Ergebnis */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  {result.success.toLocaleString('de')} von {result.total.toLocaleString('de')} Kontakten erfolgreich importiert
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.errors.length} Fehler:
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="text-sm text-red-600 space-y-1">
                      {result.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>Zeile {e.row}: {e.message}</li>
                      ))}
                      {result.errors.length > 20 && (
                        <li className="text-gray-500">
                          ... und {result.errors.length - 20} weitere Fehler
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-between items-center pt-2">
            <div>
              {importing && (
                paused ? (
                  <Button variant="outline" onClick={handleResume} className="gap-2">
                    <Play className="h-4 w-4" />
                    Fortsetzen
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handlePause} className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pausieren
                  </Button>
                )
              )}
            </div>
            <div className="flex gap-3">
              {!importing && (
                <Button variant="outline" onClick={onClose}>
                  {result ? 'Schließen' : 'Abbrechen'}
                </Button>
              )}
              {!result && file && !importing && (
                <Button onClick={handleImport} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {totalRows.toLocaleString('de')} Zeilen importieren
                </Button>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}