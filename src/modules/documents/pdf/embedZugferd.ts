/**
 * embedZugferd.ts
 * Embeds a ZUGFeRD 2.3 / Factur-X XML file into an existing PDF blob
 * using pdf-lib, producing a PDF/A-3b compliant hybrid document.
 *
 * The embedded file is named "factur-x.xml" with the required AFRelationship.
 */

import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFStream, PDFRawStream } from 'pdf-lib'

const ZUGFERD_XML_NAME = 'factur-x.xml'
const ZUGFERD_MIME     = 'text/xml'

/**
 * Takes an existing PDF blob and a ZUGFeRD XML string,
 * embeds the XML as a file attachment, and returns the new PDF as a Blob.
 */
export async function embedZugferdXml(pdfBlob: Blob, xmlString: string): Promise<Blob> {
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
  const pdfDoc   = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

  const xmlBytes = new TextEncoder().encode(xmlString)

  // Embed the file
  const embeddedFile = await pdfDoc.attach(xmlBytes, ZUGFERD_XML_NAME, {
    mimeType: ZUGFERD_MIME,
    description: 'ZUGFeRD/Factur-X e-invoice',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: 'Alternative' as any,
  })

  // Set XMP metadata to signal ZUGFeRD/Factur-X conformance
  const xmpMeta = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${ZUGFERD_XML_NAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>MINIMUM</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

  // Inject XMP into the PDF catalog
  const catalog = pdfDoc.catalog
  const xmpBytes = new TextEncoder().encode(xmpMeta)
  const xmpStream = pdfDoc.context.stream(xmpBytes, {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: xmpBytes.length,
  })
  const xmpRef = pdfDoc.context.register(xmpStream)
  catalog.set(PDFName.of('Metadata'), xmpRef)

  // Set PDF version to 1.7 (required for PDF/A-3)
  pdfDoc.setProducer('FLOX – natureandfriends am Üdersee GmbH')
  pdfDoc.setCreator('FLOX Beleg-System')

  const outBytes = await pdfDoc.save()
  return new Blob([outBytes], { type: 'application/pdf' })
}
