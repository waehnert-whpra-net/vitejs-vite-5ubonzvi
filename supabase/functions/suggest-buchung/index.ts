// supabase/functions/suggest-buchung/index.ts
// Schlägt SKR03-konforme Buchungszeilen basierend auf Geldkontobewegungen vor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      betrag,
      counterpart_name,
      purpose,
      belegtyp,       // 'eingangsrechnung' | 'ausgangsrechnung' | 'sonstiges' | ''
      buchungstext,   // Buchungstext des Buchungssatzes
    } = await req.json()

    if (!betrag) throw new Error('Betrag ist erforderlich')

    // Eigenen Prompt aus app_settings laden
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: promptSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'buchungs_prompt')
      .maybeSingle()
    const customPrompt = promptSetting?.value?.trim() ?? ''

    // Historische Buchungssätze der letzten 12 Monate als Vorlage laden
    const zwolfMonate = new Date()
    zwolfMonate.setFullYear(zwolfMonate.getFullYear() - 1)
    const { data: historischeBs } = await supabase
      .from('buchungssaetze')
      .select(`
        nummer, datum, buchungstext, belegtyp,
        beleg_sharepoint_url, beleg_storage_path,
        contact:contacts(company_name, first_name, last_name, is_company),
        buchungen(betrag, buchungstext, sollkonto:skr03!sollkonto_id(kontonummer, beschriftung), habenkonto:skr03!habenkonto_id(kontonummer, beschriftung))
      `)
      .eq('is_active', true)
      .eq('ki_vorlage', true)
      .gte('datum', zwolfMonate.toISOString().split('T')[0])
      .order('datum', { ascending: false })
      .limit(50)

    let historischKontext = ''
    if (historischeBs && historischeBs.length > 0) {
      historischKontext = `\nHISTORISCHE BUCHUNGSSÄTZE ALS VORLAGE (letzte 12 Monate, ähnliche verwenden falls passend):\n`
      for (const bs of historischeBs as any[]) {
        const buchungen = bs.buchungen ?? []
        if (buchungen.length === 0) continue
        // Kontakt-Name
        const kontakt = bs.contact
        const kontaktName = kontakt
          ? (kontakt.is_company ? kontakt.company_name : [kontakt.first_name, kontakt.last_name].filter(Boolean).join(' '))
          : ''
        // Beleg-URL (SharePoint bevorzugt, dann Storage-Hinweis)
        const belegHinweis = bs.beleg_sharepoint_url
          ? `Beleg: ${bs.beleg_sharepoint_url}`
          : bs.beleg_storage_path
          ? `Beleg: [hochgeladen: ${bs.beleg_storage_path}]`
          : ''
        historischKontext += `BS#${bs.nummer} ${bs.datum} "${bs.buchungstext ?? ''}" [${bs.belegtyp ?? ''}]`
        if (kontaktName) historischKontext += ` Kontakt: ${kontaktName}`
        if (belegHinweis) historischKontext += ` | ${belegHinweis}`
        historischKontext += `:\n`
        for (const b of buchungen) {
          const soll = b.sollkonto ? `${b.sollkonto.kontonummer} ${b.sollkonto.beschriftung}` : '?'
          const haben = b.habenkonto ? `${b.habenkonto.kontonummer} ${b.habenkonto.beschriftung}` : '?'
          historischKontext += `  ${b.betrag}€ | SOLL: ${soll} | HABEN: ${haben} | ${b.buchungstext ?? ''}\n`
        }
      }
    }

    // SKR03-Kontext für die KI — häufigste Konten
    const skr03Kontext = `
Wichtige SKR03-Konten (Auswahl):
AKTIVA / AUFWAND:
1000 Kasse | 1200 Bank | 1400 Forderungen LuL | 1576 Vorsteuer 19% | 1571 Vorsteuer 7%
3200 Wareneinkauf 19% | 3300 Wareneinkauf 7% | 4100 Löhne | 4120 Gehälter
4200 Raumkosten | 4300 Versicherungen | 4400 Kfz-Kosten | 4500 Bürobedarf
4600 Werbung | 4700 Reisekosten | 4800 Sonstige Kosten | 4900 Abschreibungen
PASSIVA / ERTRAG:
1600 Verbindlichkeiten LuL | 1700 Sonstige Verbindlichkeiten | 1776 Umsatzsteuer 19%
8000 Erlöse 19% | 8100 Erlöse 7% | 8200 Steuerfreie Erlöse | 8400 Provisionserlöse
EIGENE KONTEN IM 69000er-BEREICH: Individuelle Lieferanten- und Debitorenkonten`

    const betragsInfo = parseFloat(betrag) >= 0
      ? `Eingehende Zahlung: ${betrag} EUR`
      : `Ausgehende Zahlung: ${Math.abs(parseFloat(betrag))} EUR`

    const prompt = `Du bist ein erfahrener deutscher Buchhalter mit SKR03-Kenntnissen.
${customPrompt ? `\nBETRIEBSSPEZIFISCHE ANWEISUNGEN (höchste Priorität, diese gehen allen anderen Regeln vor):\n${customPrompt}\n` : ''}
${historischKontext}
Analysiere diese Geldkontobewegung und schlage 1-2 passende SKR03-Buchungszeilen vor:

${betragsInfo}
Empfänger/Absender: ${counterpart_name || 'unbekannt'}
Verwendungszweck: ${purpose || 'nicht angegeben'}
Belegtyp: ${belegtyp || 'nicht angegeben'}
Buchungstext des Buchungssatzes: ${buchungstext || 'nicht angegeben'}

${skr03Kontext}

REGELN:
- Bei Eingangsrechnungen: Aufwandskonto SOLL an Verbindlichkeiten LuL (1600) HABEN, plus ggf. Vorsteuer
- Bei Ausgangsrechnungen: Forderungen LuL (1400) SOLL an Erlöskonto HABEN, plus ggf. USt
- Bei Bankzahlung einer Eingangsrechnung: Verbindlichkeiten (1600) SOLL an Bank (1200) HABEN
- Bei Bankeingang einer Ausgangsrechnung: Bank (1200) SOLL an Forderungen (1400) HABEN
- Erkenne aus Verwendungszweck und Name den wahrscheinlichsten Buchungsfall
- Trenne Netto und MwSt wenn erkennbar (19% oder 7%)
- Verwende KEINE Konten außerhalb SKR03 außer dem 69000er-Bereich

Antworte NUR mit diesem JSON-Format (kein weiterer Text):
{
  "vorschlaege": [
    {
      "beschreibung": "Kurze Erklärung warum diese Buchung",
      "vorlage_bs_nummer": 42,
      "vorlage_beleg_url": "https://... oder null",
      "vorlage_kontakt_name": "Musterfirma GmbH oder null",
      "buchungen": [
        {
          "buchungstext": "Text für die Buchungszeile",
          "betrag": 100.00,
          "sollkonto_nr": "3200",
          "sollkonto_name": "Wareneinkauf 19%",
          "habenkonto_nr": "1600",
          "habenkonto_name": "Verbindlichkeiten aus Lieferungen und Leistungen"
        }
      ]
    }
  ],
  "begruendung": "Kurze Erklärung der Analyse"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic API Fehler: ${err}`)
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    // JSON aus Antwort extrahieren
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('KI hat kein gültiges JSON zurückgegeben')

    const result = JSON.parse(jsonMatch[0])

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
