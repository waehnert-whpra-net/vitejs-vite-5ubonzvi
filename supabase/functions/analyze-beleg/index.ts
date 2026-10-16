// supabase/functions/analyze-beleg/index.ts
// Analysiert Belege (Rechnungen etc.) mit Azure Document Intelligence
// Gibt strukturierte Daten zurück: Datum, Nummer, Absender, Positionen

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ENDPOINT = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT')!
const KEY = Deno.env.get('AZURE_DOC_INTEL_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Warte auf Analyse-Ergebnis (polling)
async function pollResult(operationUrl: string): Promise<any> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': KEY }
    })
    const data = await res.json()
    if (data.status === 'succeeded') return data.analyzeResult
    if (data.status === 'failed') throw new Error('Azure Analyse fehlgeschlagen: ' + JSON.stringify(data.error))
  }
  throw new Error('Timeout: Azure Analyse dauert zu lange')
}

// Hilfsfunktion: Wert aus Azure-Feld extrahieren
function val(field: any): string {
  if (!field) return ''
  if (typeof field.content === 'string') return field.content.trim()
  if (typeof field.valueString === 'string') return field.valueString.trim()
  if (field.valueDate) return field.valueDate
  if (field.valueNumber !== undefined) return field.valueNumber.toString()
  if (field.valueCurrency) return field.valueCurrency.amount?.toString() ?? ''
  return ''
}

function valAddress(field: any): string {
  if (!field) return ''
  if (field.valueAddress) {
    const a = field.valueAddress
    return [a.streetAddress, a.city, a.postalCode, a.countryRegion].filter(Boolean).join(', ')
  }
  return val(field)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { storageUrl, base64Data, mimeType } = await req.json()

    if (!storageUrl && !base64Data) {
      throw new Error('storageUrl oder base64Data ist erforderlich')
    }

    // Azure Document Intelligence: Analyse starten
    const analyzeUrl = `${ENDPOINT}formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`

    let body: any
    let contentType: string

    if (base64Data) {
      // Base64-kodierte Datei direkt senden
      body = JSON.stringify({ base64Source: base64Data })
      contentType = 'application/json'
    } else {
      // URL zur Datei senden
      body = JSON.stringify({ urlSource: storageUrl })
      contentType = 'application/json'
    }

    const startRes = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': contentType,
      },
      body,
    })

    if (!startRes.ok) {
      const err = await startRes.text()
      throw new Error(`Azure Analyse starten fehlgeschlagen: ${err}`)
    }

    const operationUrl = startRes.headers.get('Operation-Location')
    if (!operationUrl) throw new Error('Keine Operation-Location in Azure-Antwort')

    // Ergebnis abrufen
    const result = await pollResult(operationUrl)
    const doc = result.documents?.[0]

    if (!doc) throw new Error('Kein Dokument erkannt')

    const fields = doc.fields ?? {}

    // Positionen extrahieren
    const positionen: any[] = []
    const items = fields.Items?.valueArray ?? []
    for (const item of items) {
      const f = item.valueObject ?? {}
      positionen.push({
        beschreibung: val(f.Description),
        menge: val(f.Quantity),
        einheit: val(f.Unit),
        einzelpreis: val(f.UnitPrice),
        gesamtpreis: val(f.Amount),
        steuersatz: val(f.TaxRate),
        steuerbetrag: val(f.Tax),
      })
    }

    // Adresse zusammenbauen
    const adresse = {
      name: val(fields.VendorName),
      adresszeile: valAddress(fields.VendorAddress),
      strasse: fields.VendorAddress?.valueAddress?.streetAddress ?? '',
      plz: fields.VendorAddress?.valueAddress?.postalCode ?? '',
      ort: fields.VendorAddress?.valueAddress?.city ?? '',
      land: fields.VendorAddress?.valueAddress?.countryRegion ?? '',
      email: val(fields.VendorEmail ?? fields.BillingAddress),
      steuernummer: val(fields.VendorTaxId),
    }

    const strukturiert = {
      belegdatum: val(fields.InvoiceDate),
      belegnummer: val(fields.InvoiceId),
      faelligkeitsdatum: val(fields.DueDate),
      gesamtbetrag: val(fields.InvoiceTotal),
      nettobetrag: val(fields.SubTotal),
      steuerbetrag: val(fields.TotalTax),
      waehrung: fields.InvoiceTotal?.valueCurrency?.currencyCode ?? 'EUR',
      absender: adresse,
      positionen,
      konfidenz: doc.confidence ?? 0,
      rohfelder: Object.keys(fields), // Welche Felder wurden erkannt
    }

    return new Response(
      JSON.stringify({ success: true, data: strukturiert }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
