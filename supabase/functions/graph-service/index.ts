// supabase/functions/graph-service/index.ts
// Generischer Microsoft Graph API Service
// Wiederverwendbar in anderen Projekten - keine FLOX-spezifische Logik

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TENANT_ID = Deno.env.get('GRAPH_TENANT_ID')!
const CLIENT_ID = Deno.env.get('GRAPH_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GRAPH_CLIENT_SECRET')!
const SENDER_EMAIL = Deno.env.get('GRAPH_SENDER_EMAIL')!
const DRIVE_ID = Deno.env.get('GRAPH_DRIVE_ID')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Token holen (Client Credentials Flow) ───────────────────────────────────
async function getGraphToken(): Promise<string> {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token-Fehler: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

// ─── Datei aus OneDrive/SharePoint lesen (als ArrayBuffer) ──────────────────
async function readFile(token: string, driveItemPath: string): Promise<ArrayBuffer> {
  // driveItemPath z.B. "/FLOX/Templates/Mietvertrag.docx"
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${driveItemPath}:/content`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Datei lesen fehlgeschlagen: ${err}`)
  }

  return res.arrayBuffer()
}

// ─── Datei in OneDrive/SharePoint hochladen ───────────────────────────────────
async function uploadFile(
  token: string,
  driveItemPath: string,
  content: ArrayBuffer,
  mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
): Promise<{ id: string; webUrl: string; name: string }> {
  // driveItemPath z.B. "/FLOX/Dokumente/Mietvertrag_Mustermann.docx"
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${driveItemPath}:/content`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType,
    },
    body: content,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Upload fehlgeschlagen: ${err}`)
  }

  const data = await res.json()
  return {
    id: data.id,
    webUrl: data.webUrl,
    name: data.name,
  }
}

// ─── E-Mail senden ────────────────────────────────────────────────────────────
async function sendMail(
  token: string,
  to: string[],
  subject: string,
  body: string
): Promise<void> {
  const url = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`
  const payload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: body },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mail-Versand fehlgeschlagen: ${err}`)
  }
}

// ─── Haupthandler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, payload } = await req.json()
    const token = await getGraphToken()

    switch (action) {
      case 'debugFile': {
        // payload: { path: string } - zeigt Headers und ersten Bytes
        const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${payload.path}:/content`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const headers: Record<string, string> = {}
        res.headers.forEach((v, k) => { headers[k] = v })
        const buffer = await res.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        // Ersten 4 Bytes als Hex (PK = 50 4B = ZIP-Magic-Bytes)
        const magic = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        return new Response(
          JSON.stringify({ success: true, headers, size: bytes.length, magic }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'listSite': {
        // payload: { siteUrl: string } - z.B. "whpraede.sharepoint.com:/sites/WHPAkten"
        const siteRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${payload.siteUrl}:/drive`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const siteData = await siteRes.json()
        return new Response(
          JSON.stringify({ success: siteRes.ok, data: siteData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'listFolderWithFiles': {
        // payload: { path: string } - listet Ordner UND Dateien
        const lfPath = payload.path && payload.path !== '/' ? payload.path : ''
        const lfUrl = lfPath
          ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${lfPath}:/children?$select=id,name,folder,file,size,webUrl&$top=200`
          : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children?$select=id,name,folder,file,size,webUrl&$top=200`
        const lfRes = await fetch(lfUrl, { headers: { Authorization: `Bearer ${token}` } })
        const lfData = await lfRes.json()
        if (!lfRes.ok) return new Response(JSON.stringify({ success: false, error: JSON.stringify(lfData) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        const folders = (lfData.value ?? [])
          .filter((item: any) => item.folder)
          .map((item: any) => ({ id: item.id, name: item.name, isFolder: true, webUrl: item.webUrl }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        const files = (lfData.value ?? [])
          .filter((item: any) => item.file)
          .map((item: any) => ({ id: item.id, name: item.name, isFolder: false, size: item.size, webUrl: item.webUrl }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        return new Response(JSON.stringify({ success: true, items: [...folders, ...files] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'listFiles': {
        // payload: { path: string } - listet .docx Dateien in einem Ordner
        const fPath = payload.path && payload.path !== '/' ? payload.path : ''
        const fUrl = fPath
          ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${fPath}:/children?$select=id,name,file&$top=200`
          : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children?$select=id,name,file&$top=200`
        const fRes = await fetch(fUrl, { headers: { Authorization: `Bearer ${token}` } })
        const fData = await fRes.json()
        if (!fRes.ok) return new Response(JSON.stringify({ success: false, error: JSON.stringify(fData) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        const files = (fData.value ?? [])
          .filter((item: any) => item.file && item.name?.toLowerCase().endsWith('.docx'))
          .map((item: any) => ({ id: item.id, name: item.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        return new Response(JSON.stringify({ success: true, files }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'listFolder': {
        // payload: { path: string } - z.B. "/FLOX" oder "/" für root
        const path = payload.path && payload.path !== '/' ? payload.path : ''
        const url = path
          ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${path}:/children?$select=id,name,folder,file&$top=200`
          : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children?$select=id,name,folder,file&$top=200`
        const listRes = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const listData = await listRes.json()
        if (!listRes.ok) {
          return new Response(
            JSON.stringify({ success: false, error: JSON.stringify(listData) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const items = (listData.value ?? [])
          .filter((item: any) => item.folder) // nur Ordner
          .map((item: any) => ({ id: item.id, name: item.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        return new Response(
          JSON.stringify({ success: true, folders: items }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'createFolder': {
        // payload: { path: string, name: string } - erstellt Unterordner
        const encodedPath = payload.path && payload.path !== '/' ? payload.path : ''
        const url = encodedPath
          ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:${encodedPath}:/children`
          : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children`
        const createRes = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: payload.name,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok) {
          return new Response(
            JSON.stringify({ success: false, error: JSON.stringify(createData) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ success: true, id: createData.id, name: createData.name }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'readFile': {
        // payload: { path: string }
        const buffer = await readFile(token, payload.path)
        const bytes = new Uint8Array(buffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          binary += String.fromCharCode(...chunk)
        }
        const base64 = btoa(binary)
        return new Response(
          JSON.stringify({ success: true, data: base64 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'uploadFile': {
        // payload: { path: string, contentBase64: string, mimeType?: string }
        const binaryString = atob(payload.contentBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const result = await uploadFile(token, payload.path, bytes.buffer, payload.mimeType)
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'sendMail': {
        // payload: { to: string[], subject: string, body: string }
        await sendMail(token, payload.to, payload.subject, payload.body)
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error(`Unbekannte Aktion: ${action}`)
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
