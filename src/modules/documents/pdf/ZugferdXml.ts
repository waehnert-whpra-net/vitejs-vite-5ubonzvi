/**
 * ZugferdXml.ts
 * Generates ZUGFeRD 2.3 MINIMUM profile XML (EN 16931 subset).
 * Only mandatory fields — suitable for simple invoices.
 * Note: ZUGFeRD MINIMUM is only valid for Rechnungen (invoices), not Angebote.
 */

import type { Document as DocType, DocumentItem, DocumentType } from '../hooks/useDocuments'
import { grossToNet, calcVatSummary } from '../hooks/useDocuments'
import type { FirmaData } from './DocumentPdf'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isoDate(iso: string): string {
  // Convert "2026-11-09" → "20261109"
  return iso.replace(/-/g, '')
}

export function buildZugferdXml(
  doc: DocType & { document_type: DocumentType; items: DocumentItem[] },
  firma: FirmaData,
): string {
  const vatSummary = calcVatSummary(doc.items)
  const totalBrutto = doc.items.reduce((s, i) => s + i.gross_unit_price * i.quantity, 0)

  // Calculate totals per VAT rate
  const taxLines = vatSummary.map(v => {
    const netto = grossToNet(v.grossTotal, v.vatRate)
    const tax   = v.grossTotal - netto
    return { rate: v.vatRate, netto, tax, brutto: v.grossTotal }
  })

  const totalNetto = taxLines.reduce((s, t) => s + t.netto, 0)
  const totalTax   = taxLines.reduce((s, t) => s + t.tax,   0)

  const fmt2 = (n: number) => n.toFixed(2)

  // Seller address
  const sellerAddr = `
      <ram:PostalTradeAddress>
        <ram:PostcodeCode>${esc(firma.plz)}</ram:PostcodeCode>
        <ram:LineOne>${esc(firma.strasse)}</ram:LineOne>
        <ram:CityName>${esc(firma.ort)}</ram:CityName>
        <ram:CountryID>${firma.land === 'Deutschland' || !firma.land ? 'DE' : esc(firma.land.substring(0, 2).toUpperCase())}</ram:CountryID>
      </ram:PostalTradeAddress>`

  // Buyer address
  const buyer = doc.contact
  const buyerName = buyer
    ? buyer.is_company
      ? (buyer.company_name ?? '')
      : [buyer.first_name, buyer.last_name].filter(Boolean).join(' ')
    : 'Unbekannt'

  const buyerAddr = buyer && buyer.address_zip
    ? `
      <ram:PostalTradeAddress>
        <ram:PostcodeCode>${esc(buyer.address_zip ?? '')}</ram:PostcodeCode>
        <ram:LineOne>${esc(buyer.address_street ?? '')}</ram:LineOne>
        <ram:CityName>${esc(buyer.address_city ?? '')}</ram:CityName>
        <ram:CountryID>DE</ram:CountryID>
      </ram:PostalTradeAddress>`
    : ''

  // Tax lines XML
  const taxLinesXml = taxLines.map(t => `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount currencyID="EUR">${fmt2(t.tax)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount currencyID="EUR">${fmt2(t.netto)}</ram:BasisAmount>
      <ram:CategoryCode>${t.rate === 0 ? 'Z' : 'S'}</ram:CategoryCode>
      <ram:RateApplicablePercent>${fmt2(t.rate)}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`).join('')

  // Line items XML
  const lineItemsXml = doc.items.map((item, idx) => {
    const lineNetto  = grossToNet(item.gross_unit_price * item.quantity, item.vat_rate)
    const lineGross  = item.gross_unit_price * item.quantity
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount currencyID="EUR">${fmt2(grossToNet(item.gross_unit_price, item.vat_rate))}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${item.vat_rate === 0 ? 'Z' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt2(item.vat_rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount currencyID="EUR">${fmt2(lineNetto)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
  }).join('')

  // Payment terms (30 days)
  const dueDate = new Date(doc.date)
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = dueDate.toISOString().slice(0, 10)

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${esc(doc.document_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${isoDate(doc.date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>

    ${lineItemsXml}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(firma.name)}</ram:Name>${sellerAddr}
        ${firma.ustid ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(firma.ustid)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : firma.steuernummer ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${esc(firma.steuernummer)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(buyerName)}</ram:Name>${buyerAddr}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      ${doc.service_from ? `<ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${isoDate(doc.service_from)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>` : ''}
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${firma.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(firma.iban.replace(/\s/g, ''))}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      ${taxLinesXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${isoDate(dueDateStr)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount currencyID="EUR">${fmt2(totalNetto)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount currencyID="EUR">${fmt2(totalNetto)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmt2(totalTax)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount currencyID="EUR">${fmt2(totalBrutto)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount currencyID="EUR">${fmt2(totalBrutto)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
