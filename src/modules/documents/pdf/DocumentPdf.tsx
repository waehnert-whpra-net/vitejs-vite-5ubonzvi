/**
 * DocumentPdf.tsx
 * Generates a PDF document (invoice / quote) using @react-pdf/renderer.
 * Layout replicates the natureandfriends letterhead design.
 */

import {
  Document, Page, View, Text, Image, StyleSheet, Font,
  pdf,
} from '@react-pdf/renderer'
import type { Document as DocType, DocumentItem, DocumentType } from '../hooks/useDocuments'
import { grossToNet, calcVatSummary } from '../hooks/useDocuments'

// ─── Logo (bundled as data-URL via Vite asset import) ────────────────────────
// @ts-ignore – png import
import nafLogoSrc from '@/assets/naf-logo-letterhead.png'

// ─── Farben aus dem Briefkopf ─────────────────────────────────────────────────
const SAND   = '#9B8A6E'   // Logo / Absenderzeile
const GRAY   = '#555555'
const LGRAY  = '#888888'
const BLACK  = '#222222'
const BORDER = '#CCCCCC'

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: BLACK,
    paddingTop: 28,
    paddingBottom: 60,
    paddingHorizontal: 36,
  },

  // ── Kopfzeile ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  logo: {
    width: 120,
    height: 28,
    objectFit: 'contain',
  },
  absenderzeile: {
    fontSize: 7,
    color: SAND,
    borderBottomWidth: 0.5,
    borderBottomColor: SAND,
    paddingBottom: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  // ── Adressblock ──
  addressBlock: {
    marginTop: 6,
    marginBottom: 14,
    minHeight: 40,
  },
  addressLine: {
    fontSize: 9,
    color: BLACK,
    lineHeight: 1.4,
  },

  // ── Metadaten rechts ──
  metaBlock: {
    position: 'absolute',
    right: 36,
    top: 85,
    width: 130,
    fontSize: 8.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: { color: LGRAY },
  metaValue: { color: BLACK, fontFamily: 'Helvetica-Bold' },

  // ── Beleg-Titel ──
  docTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: BLACK,
    marginBottom: 4,
    marginTop: 8,
  },
  subjectLine: {
    fontSize: 9,
    color: GRAY,
    marginBottom: 10,
  },

  // ── Positionen ──
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F4F1EC',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 18,
  },
  tableRowAlt: {
    backgroundColor: '#FAFAF8',
  },

  // Spalten-Breiten (A4 contentWidth ≈ 523pt)
  colNr:    { width: 20,  fontSize: 8, color: LGRAY },
  colDesc:  { flex: 1,   fontSize: 9 },
  colQty:   { width: 42, fontSize: 9, textAlign: 'right' },
  colUnit:  { width: 28, fontSize: 8, color: LGRAY, textAlign: 'center' },
  colBrutto:{ width: 56, fontSize: 9, textAlign: 'right' },
  colMwst:  { width: 36, fontSize: 8, textAlign: 'right', color: LGRAY },
  colTotal: { width: 60, fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  headerText: { fontSize: 7.5, color: GRAY, fontFamily: 'Helvetica-Bold' },

  // ── MwSt-Aufstellung ──
  vatBox: {
    marginTop: 10,
    alignSelf: 'flex-end',
    width: 240,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
  },
  vatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  vatRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F4F1EC',
  },
  vatLabel: { fontSize: 8, color: GRAY },
  vatAmount: { fontSize: 8, color: BLACK },
  vatTotalLabel: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: BLACK },
  vatTotalAmount: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: BLACK },

  // ── Notizen ──
  notesBox: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
  notesText: { fontSize: 8.5, color: GRAY, lineHeight: 1.5 },

  // ── Fußzeile ──
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLeft: { fontSize: 7, color: LGRAY, lineHeight: 1.5 },
  footerRight: { fontSize: 7, color: LGRAY, lineHeight: 1.5, textAlign: 'right' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(val: number): string {
  return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function contactBlock(c: DocType['contact']): string {
  if (!c) return ''
  const name = c.is_company
    ? (c.company_name ?? '')
    : [c.first_name, c.last_name].filter(Boolean).join(' ')
  const lines = [name, c.address_street, [c.address_zip, c.address_city].filter(Boolean).join(' '), c.address_country]
  return lines.filter(Boolean).join('\n')
}

// ─── Firma defaults (fallback wenn Setup noch nicht gefüllt) ──────────────────
export interface FirmaData {
  name: string
  strasse: string
  plz: string
  ort: string
  land?: string
  steuernummer?: string
  ustid?: string
  bankname?: string
  iban?: string
  bic?: string
  website?: string
  handelsregister?: string
  geschaeftsfuehrer?: string
}

// ─── PDF-Dokument ─────────────────────────────────────────────────────────────

interface Props {
  doc: DocType & { document_type: DocumentType; items: DocumentItem[] }
  firma: FirmaData
}

function DocumentPdfDoc({ doc, firma }: Props) {
  const vatSummary = calcVatSummary(doc.items)
  const totalBrutto = doc.items.reduce((s, i) => s + i.gross_unit_price * i.quantity, 0)

  const absender = `${firma.name}  ·  ${firma.strasse}  ·  ${firma.plz} ${firma.ort}`
  const docTypeName = doc.document_type.name  // "Rechnung" / "Angebot"

  const servicePeriod = doc.service_from
    ? doc.service_to && doc.service_to !== doc.service_from
      ? `${fmtDate(doc.service_from)} – ${fmtDate(doc.service_to)}`
      : fmtDate(doc.service_from)
    : null

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Kopfzeile: Logo rechts ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }} />
          <Image src={nafLogoSrc} style={s.logo} />
        </View>

        {/* ── Absenderzeile (Fensterkuvert) ── */}
        <Text style={s.absenderzeile}>{absender}</Text>

        {/* ── Adressblock + Meta (nebeneinander) ── */}
        <View style={{ flexDirection: 'row' }}>
          {/* Adresse links */}
          <View style={{ flex: 1 }}>
            <View style={s.addressBlock}>
              {contactBlock(doc.contact).split('\n').map((line, i) => (
                <Text key={i} style={s.addressLine}>{line}</Text>
              ))}
            </View>
          </View>

          {/* Meta rechts */}
          <View style={{ width: 150 }}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{docTypeName}snr.:</Text>
              <Text style={s.metaValue}>{doc.document_number}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Datum:</Text>
              <Text style={s.metaValue}>{fmtDate(doc.date)}</Text>
            </View>
            {servicePeriod && (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Leistungszeitraum:</Text>
                <Text style={s.metaValue}>{servicePeriod}</Text>
              </View>
            )}
            {firma.ustid && (
              <View style={[s.metaRow, { marginTop: 4 }]}>
                <Text style={s.metaLabel}>USt-IdNr.:</Text>
                <Text style={s.metaValue}>{firma.ustid}</Text>
              </View>
            )}
            {firma.steuernummer && !firma.ustid && (
              <View style={[s.metaRow, { marginTop: 4 }]}>
                <Text style={s.metaLabel}>Steuernr.:</Text>
                <Text style={s.metaValue}>{firma.steuernummer}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Beleg-Titel ── */}
        <Text style={s.docTitle}>{docTypeName}</Text>
        {doc.subject_line2 && (
          <Text style={s.subjectLine}>{doc.subject_line2}</Text>
        )}

        {/* ── Positionstabelle: Header ── */}
        <View style={s.tableHeader}>
          <Text style={[s.colNr,     s.headerText]}>Nr.</Text>
          <Text style={[s.colDesc,   s.headerText]}>Bezeichnung</Text>
          <Text style={[s.colQty,    s.headerText]}>Menge</Text>
          <Text style={[s.colUnit,   s.headerText]}>Einh.</Text>
          <Text style={[s.colBrutto, s.headerText]}>Brutto-EP</Text>
          <Text style={[s.colMwst,   s.headerText]}>MwSt.</Text>
          <Text style={[s.colTotal,  s.headerText]}>Gesamt</Text>
        </View>

        {/* ── Positionstabelle: Zeilen ── */}
        {doc.items.map((item, idx) => {
          const lineTotal = item.gross_unit_price * item.quantity
          return (
            <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={s.colNr}>{item.position}.</Text>
              <Text style={s.colDesc}>{item.description}</Text>
              <Text style={s.colQty}>{item.quantity.toLocaleString('de-DE')}</Text>
              <Text style={s.colUnit}>–</Text>
              <Text style={s.colBrutto}>{eur(item.gross_unit_price)}</Text>
              <Text style={s.colMwst}>{item.vat_rate} %</Text>
              <Text style={s.colTotal}>{eur(lineTotal)}</Text>
            </View>
          )
        })}

        {/* ── MwSt-Aufstellung ── */}
        <View style={s.vatBox}>
          {vatSummary.map(v => {
            const netto = grossToNet(v.grossTotal, v.vatRate)
            const tax   = v.grossTotal - netto
            return (
              <View key={v.vatRate} style={s.vatRow}>
                <Text style={s.vatLabel}>Netto {v.vatRate} %</Text>
                <Text style={s.vatAmount}>{eur(netto)}</Text>
                <Text style={[s.vatLabel, { marginLeft: 8 }]}>MwSt.</Text>
                <Text style={s.vatAmount}>{eur(tax)}</Text>
              </View>
            )
          })}
          <View style={s.vatRowTotal}>
            <Text style={s.vatTotalLabel}>Gesamtbetrag</Text>
            <Text style={s.vatTotalAmount}>{eur(totalBrutto)}</Text>
          </View>
        </View>

        {/* ── Zahlungsbedingungen (nur Rechnungen) ── */}
        {docTypeName === 'Rechnung' && (
          <Text style={{ fontSize: 8.5, color: GRAY, marginTop: 12 }}>
            Bitte überweisen Sie den Betrag von {eur(totalBrutto)} innerhalb von 14 Tagen auf das unten angegebene Konto.
          </Text>
        )}

        {/* ── Notizen ── */}
        {doc.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesText}>{doc.notes}</Text>
          </View>
        )}

        {/* ── Grußformel ── */}
        <Text style={{ fontSize: 9, color: GRAY, marginTop: 24 }}>Mit freundlichen Grüßen</Text>
        <Text style={{ fontSize: 9, color: BLACK, marginTop: 6, fontFamily: 'Helvetica-Bold' }}>
          {firma.geschaeftsfuehrer ?? firma.name}
        </Text>

        {/* ── Fußzeile ── */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            {firma.bankname && <Text>{firma.bankname}</Text>}
            {firma.iban     && <Text>IBAN: {firma.iban}</Text>}
            {firma.bic      && <Text>BIC: {firma.bic}</Text>}
            {firma.website  && <Text>{firma.website}</Text>}
          </View>
          <View style={s.footerRight}>
            <Text>{firma.name}</Text>
            {firma.handelsregister && <Text>{firma.handelsregister}</Text>}
            {firma.geschaeftsfuehrer && <Text>Geschäftsführer: {firma.geschaeftsfuehrer}</Text>}
          </View>
        </View>

      </Page>
    </Document>
  )
}

// ─── Export: PDF als Blob erzeugen ────────────────────────────────────────────

export async function generateDocumentPdfBlob(
  doc: DocType & { document_type: DocumentType; items: DocumentItem[] },
  firma: FirmaData,
): Promise<Blob> {
  const blob = await pdf(<DocumentPdfDoc doc={doc} firma={firma} />).toBlob()
  return blob
}
