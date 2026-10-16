// supabase/functions/create-document/index.ts
// Dokumenterzeugung aus Word-Templates mit MergeFields
// Unterstützt fldSimple und fldChar/instrText MergeField-Typen
// Entfernt alle Feld-Wrapper → kein grauer Hintergrund im Output
// Wiederverwendbar - keine FLOX-spezifische Logik

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const GRAPH_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/graph-service`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Graph-Service ────────────────────────────────────────────────────────────

async function readFileFromOneDrive(path: string): Promise<Uint8Array> {
  const res = await fetch(GRAPH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'readFile', payload: { path } }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(`Template lesen: ${data.error}`)
  const binaryString = atob(data.data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes
}

async function uploadFileToOneDrive(path: string, bytes: Uint8Array): Promise<{ id: string; webUrl: string; name: string }> {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  const res = await fetch(GRAPH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'uploadFile', payload: { path, contentBase64: btoa(binary) } }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(`Upload: ${data.error}`)
  return { id: data.id, webUrl: data.webUrl, name: data.name }
}

// ─── ZIP lesen/schreiben ──────────────────────────────────────────────────────

function r16(b: Uint8Array, o: number) { return b[o] | (b[o+1] << 8) }
function r32(b: Uint8Array, o: number) { return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0 }
function w16(b: Uint8Array, o: number, v: number) { b[o]=v&0xff; b[o+1]=(v>>8)&0xff }
function w32(b: Uint8Array, o: number, v: number) { b[o]=v&0xff; b[o+1]=(v>>8)&0xff; b[o+2]=(v>>16)&0xff; b[o+3]=(v>>24)&0xff }

const CRC = (() => { const t=new Uint32Array(256); for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[i]=c} return t })()
function crc32(d: Uint8Array) { let c=0xffffffff; for(let i=0;i<d.length;i++) c=CRC[(c^d[i])&0xff]^(c>>>8); return (c^0xffffffff)>>>0 }

async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const entries = new Map<string, Uint8Array>()
  let eocd = -1
  for (let i = bytes.length-22; i >= 0; i--) {
    if (bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06) { eocd=i; break }
  }
  if (eocd===-1) throw new Error('Kein gültiges ZIP')
  const cdOff = r32(bytes, eocd+16), cdCnt = r16(bytes, eocd+8)
  let pos = cdOff
  for (let i = 0; i < cdCnt; i++) {
    if (r32(bytes,pos) !== 0x02014b50) break
    const method=r16(bytes,pos+10), csz=r32(bytes,pos+20), fnLen=r16(bytes,pos+28)
    const exLen=r16(bytes,pos+30), cmLen=r16(bytes,pos+32), lOff=r32(bytes,pos+42)
    const fn=new TextDecoder().decode(bytes.slice(pos+46,pos+46+fnLen))
    if (!fn.endsWith('/')) {
      const lfnLen=r16(bytes,lOff+26), lexLen=r16(bytes,lOff+28)
      const dOff=lOff+30+lfnLen+lexLen
      const cd=bytes.slice(dOff,dOff+csz)
      let fd: Uint8Array
      if (method===8) {
        const ds=new DecompressionStream('deflate-raw')
        const w=ds.writable.getWriter(); w.write(cd); w.close()
        fd=new Uint8Array(await new Response(ds.readable).arrayBuffer())
      } else { fd=cd }
      entries.set(fn, fd)
    }
    pos+=46+fnLen+exLen+cmLen
  }
  return entries
}

async function writeZip(entries: Map<string, Uint8Array>): Promise<Uint8Array> {
  const lp: Uint8Array[]=[], cd: Uint8Array[]=[], offs: number[]=[]
  let cur=0
  const enc=new TextEncoder()
  const now=new Date()
  const dd=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate()
  const dt=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1)
  for (const [fn, data] of entries) {
    const cs=new CompressionStream('deflate-raw')
    const wr=cs.writable.getWriter(); wr.write(data); wr.close()
    const comp=new Uint8Array(await new Response(cs.readable).arrayBuffer())
    const useC=comp.length<data.length, fd=useC?comp:data, cm=useC?8:0
    const fnb=enc.encode(fn), crc=crc32(data)
    const lh=new Uint8Array(30+fnb.length)
    w32(lh,0,0x04034b50);w16(lh,4,20);w16(lh,6,0);w16(lh,8,cm);w16(lh,10,dt);w16(lh,12,dd)
    w32(lh,14,crc);w32(lh,18,fd.length);w32(lh,22,data.length);w16(lh,26,fnb.length);w16(lh,28,0)
    lh.set(fnb,30); offs.push(cur); lp.push(lh,fd); cur+=lh.length+fd.length
    const ce=new Uint8Array(46+fnb.length)
    w32(ce,0,0x02014b50);w16(ce,4,20);w16(ce,6,20);w16(ce,8,0);w16(ce,10,cm);w16(ce,12,dt);w16(ce,14,dd)
    w32(ce,16,crc);w32(ce,20,fd.length);w32(ce,24,data.length);w16(ce,28,fnb.length)
    w16(ce,30,0);w16(ce,32,0);w16(ce,34,0);w16(ce,36,0);w32(ce,38,0);w32(ce,42,offs[offs.length-1])
    ce.set(fnb,46); cd.push(ce)
  }
  const cds=cd.reduce((s,e)=>s+e.length,0), tot=cur+cds+22
  const res=new Uint8Array(tot); let p=0
  for (const part of lp) { res.set(part,p); p+=part.length }
  const cds_=p
  for (const e of cd) { res.set(e,p); p+=e.length }
  const eocd=new Uint8Array(22)
  w32(eocd,0,0x06054b50);w16(eocd,4,0);w16(eocd,6,0);w16(eocd,8,entries.size);w16(eocd,10,entries.size)
  w32(eocd,12,cds);w32(eocd,16,cds_);w16(eocd,20,0); res.set(eocd,p)
  return res
}

// ─── MergeField Ersetzung ─────────────────────────────────────────────────────

function safeXml(v: string) { return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function replaceMergeFields(xml: string, placeholders: Record<string, string>): string {
  // Typ 1: <w:fldSimple w:instr="MERGEFIELD key">...</w:fldSimple>
  xml = xml.replace(/<w:fldSimple w:instr="([^"]*)"[\s\S]*?<\/w:fldSimple>/g, (match, instr) => {
    const key = instr.match(/MERGEFIELD\s+(\w+)/)?.[1]
    if (!key) return match
    const value = placeholders[key] ?? ''
    if (!value) return ''
    const rprRaw = match.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? ''
    const rprInner = rprRaw.replace(/<w:noProof\/>/g,'').trim()
    const rpr = rprInner ? `<w:rPr>${rprInner}</w:rPr>` : ''
    return `<w:r>${rpr}<w:t xml:space="preserve">${safeXml(value)}</w:t></w:r>`
  })

  // Typ 2: <w:fldChar begin>...<w:fldChar end> — wiederholen bis alle ersetzt
  // rPr zwischen w:r und w:fldChar erlauben (Word fügt das manchmal ein)
  const pattern = /<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:fldChar w:fldCharType="begin"[^/]*\/><\/w:r>(?:(?!<w:fldChar w:fldCharType="begin").)*?<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:fldChar w:fldCharType="end"[^/]*\/><\/w:r>/gs

  for (let i = 0; i < 10; i++) {
    const next = xml.replace(pattern, (match) => {
      const instr = [...match.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map(m=>m[1]).join('')
      const key = instr.match(/MERGEFIELD\s+(\w+)/)?.[1]
      if (!key) return match
      const value = placeholders[key] ?? ''
      if (!value) return ''
      const rprRaw = match.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? ''
      const rprInner = rprRaw.replace(/<w:noProof\/>/g,'').trim()
      const rpr = rprInner ? `<w:rPr>${rprInner}</w:rPr>` : ''
      return `<w:r>${rpr}<w:t xml:space="preserve">${safeXml(value)}</w:t></w:r>`
    })
    if (next === xml) break
    xml = next
  }

  // Verbleibende fldChar-Runs und instrText-Runs entfernen (keine Felder im Output)
  xml = xml.replace(/<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:fldChar[^/]*\/>\s*<\/w:r>/g, '')
  xml = xml.replace(/<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:instrText[^>]*>[^<]*<\/w:instrText><\/w:r>/g, '')

  return xml
}

function buildCoreXml(creator: string, description: string, created: string): Uint8Array {
  return new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>${creator}</dc:creator>
  <cp:lastModifiedBy>${creator}</cp:lastModifiedBy>
  <dc:description>${description}</dc:description>
  <dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>`
  )
}

// ─── Haupthandler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { templatePath, outputPath, placeholders, creatorName, description } = await req.json()
    if (!templatePath || !outputPath || !placeholders) throw new Error('templatePath, outputPath und placeholders sind Pflichtfelder')

    const templateBytes = await readFileFromOneDrive(templatePath)
    const entries = await readZip(templateBytes)

    const docXml = entries.get('word/document.xml')
    if (docXml) {
      const replaced = replaceMergeFields(new TextDecoder().decode(docXml), placeholders)
      entries.set('word/document.xml', new TextEncoder().encode(replaced))
    }

    const now = new Date().toISOString()
    entries.set('docProps/core.xml', buildCoreXml(
      creatorName ?? 'FLOX',
      description ?? `Erstellt über FLOX am ${new Date().toLocaleDateString('de-DE')}`,
      now
    ))

    const resultBytes = await writeZip(entries)
    const result = await uploadFileToOneDrive(outputPath, resultBytes)

    return new Response(
      JSON.stringify({ success: true, id: result.id, webUrl: result.webUrl, name: result.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
