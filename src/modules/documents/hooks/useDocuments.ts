import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Typen ───────────────────────────────────────────────────────────────────

export type DocumentType = {
  id: string
  name: string
  prefix: string
  counter: number
  default_folder: string | null
  is_active: boolean
  sort_order: number
}

export type Document = {
  id: string
  document_type_id: string
  document_number: string
  date: string
  contact_id: string | null
  usage_id: string | null
  subject_line2: string | null
  service_from: string | null
  service_to: string | null
  notes: string | null
  is_finalized: boolean
  pdf_path: string | null
  pdf_created_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  document_type?: DocumentType
  contact?: {
    id: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    is_company: boolean
    address_street: string | null
    address_zip: string | null
    address_city: string | null
    address_country: string | null
  }
  items?: DocumentItem[]
}

export type Article = {
  id: string
  name: string
  description: string | null
  unit: string | null
  quantity: number
  net_price: number | null
  gross_price: number | null
  vat_rate: number
  sort_order: number
  is_active: boolean
}

export type DocumentItem = {
  id: string
  document_id: string
  position: number
  description: string
  quantity: number
  gross_unit_price: number
  vat_rate: number
  article_id: string | null
}

// ─── Belegarten ──────────────────────────────────────────────────────────────

export function useDocumentTypes() {
  return useQuery({
    queryKey: ['document_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as DocumentType[]
    },
  })
}

export function useSaveDocumentType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dt: Partial<DocumentType> & { id?: string }) => {
      if (dt.id) {
        const { error } = await supabase.from('document_types').update(dt).eq('id', dt.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('document_types').insert(dt)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document_types'] }),
  })
}

// ─── Belege ───────────────────────────────────────────────────────────────────

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_type:document_types(*),
          contact:contacts(id, first_name, last_name, company_name, is_company,
            address_street, address_zip, address_city, address_country)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Document[]
    },
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_type:document_types(*),
          contact:contacts(id, first_name, last_name, company_name, is_company,
            address_street, address_zip, address_city, address_country)
        `)
        .eq('id', id)
        .single()
      if (error) throw error

      const { data: items, error: itemsErr } = await supabase
        .from('document_items')
        .select('*')
        .eq('document_id', id)
        .order('position')
      if (itemsErr) throw itemsErr

      return { ...(data as unknown as Document), items: items as DocumentItem[] }
    },
    enabled: !!id,
  })
}

/** Erstellt einen neuen Beleg mit automatisch generierter Belegnummer */
export function useCreateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      document_type_id: string
      prefix: string
      contact_id?: string | null
      usage_id?: string | null
      subject_line2?: string | null
      service_from?: string | null
      service_to?: string | null
      notes?: string | null
    }) => {
      // Belegnummer: Prefix-yyyy-mm-dd + 3-stellige Tagesnummer
      const today = new Date().toISOString().slice(0, 10)  // yyyy-mm-dd

      // Tageszähler aus dem Datensatz der Belegart lesen + erhöhen
      const { data: existing, error: cntErr } = await supabase
        .from('documents')
        .select('id')
        .eq('document_type_id', params.document_type_id)
        .gte('date', today)
        .lt('date', today.slice(0, 8) + String(Number(today.slice(8)) + 1).padStart(2, '0'))
      if (cntErr) throw cntErr

      const seq = String((existing?.length ?? 0) + 1).padStart(3, '0')
      const document_number = `${params.prefix}-${today}${seq}`

      const { data, error } = await supabase
        .from('documents')
        .insert({
          document_type_id: params.document_type_id,
          document_number,
          date: today,
          contact_id: params.contact_id ?? null,
          usage_id: params.usage_id ?? null,
          subject_line2: params.subject_line2 ?? null,
          service_from: params.service_from ?? null,
          service_to: params.service_to ?? null,
          notes: params.notes ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: Partial<Document> & { id: string }) => {
      const { items, document_type, contact, ...data } = doc as any
      const { error } = await supabase.from('documents').update(data).eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['document', v.id] })
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

/** Dupliziert einen bestehenden Beleg (inkl. Positionen) als neuen, bearbeitbaren Beleg */
export function useDuplicateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string) => {
      // Original laden
      const { data: src, error: srcErr } = await supabase
        .from('documents')
        .select('*, document_type:document_types(prefix)')
        .eq('id', sourceId)
        .single()
      if (srcErr) throw srcErr

      const { data: srcItems, error: itemErr } = await supabase
        .from('document_items')
        .select('*')
        .eq('document_id', sourceId)
        .order('position')
      if (itemErr) throw itemErr

      const today = new Date().toISOString().slice(0, 10)
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('document_type_id', (src as any).document_type_id)
        .gte('date', today)
        .lt('date', today.slice(0, 8) + String(Number(today.slice(8)) + 1).padStart(2, '0'))

      const seq = String(((existing?.length ?? 0) + 1)).padStart(3, '0')
      const prefix = (src as any).document_type?.prefix ?? 'X'
      const document_number = `${prefix}-${today}${seq}`

      const { data: newDoc, error: insertErr } = await supabase
        .from('documents')
        .insert({
          document_type_id: (src as any).document_type_id,
          document_number,
          date: today,
          contact_id: (src as any).contact_id,
          usage_id: (src as any).usage_id,
          subject_line2: (src as any).subject_line2,
          service_from: (src as any).service_from,
          service_to: (src as any).service_to,
          notes: (src as any).notes,
          is_finalized: false,
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      // Positionen kopieren
      if (srcItems && srcItems.length > 0) {
        const { error: itemsInsertErr } = await supabase.from('document_items').insert(
          srcItems.map(({ id, document_id, ...item }: any) => ({
            ...item,
            document_id: newDoc.id,
          }))
        )
        if (itemsInsertErr) throw itemsInsertErr
      }

      return newDoc.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

// ─── Belegpositionen ──────────────────────────────────────────────────────────

export function useSaveDocumentItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId, items }: { documentId: string; items: Omit<DocumentItem, 'id' | 'created_at'>[] }) => {
      // Alle bestehenden Positionen löschen und neu einfügen
      await supabase.from('document_items').delete().eq('document_id', documentId)
      if (items.length > 0) {
        const { error } = await supabase.from('document_items').insert(
          items.map((item, i) => ({ ...item, document_id: documentId, position: i + 1 }))
        )
        if (error) throw error
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['document', v.documentId] }),
  })
}

// ─── Artikel ─────────────────────────────────────────────────────────────────

export function useArticles() {
  return useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as Article[]
    },
  })
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('articles').select('*').eq('id', id).single()
      if (error) throw error
      return data as Article
    },
    enabled: !!id,
  })
}

export function useSaveArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: Partial<Article> & { id?: string }) => {
      if (a.id) {
        const { error } = await supabase.from('articles').update(a).eq('id', a.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('articles').insert(a)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  })
}

export function useDeleteArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('articles').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  })
}

// ─── MwSt-Hilfsfunktionen ────────────────────────────────────────────────────

/** Berechnet den Brutto-Einzelpreis aus Netto + MwSt-Satz */
export function netToGross(net: number, vatRate: number): number {
  return Math.round(net * (1 + vatRate / 100) * 100) / 100
}

/** Berechnet den Netto-Einzelpreis aus Brutto + MwSt-Satz */
export function grossToNet(gross: number, vatRate: number): number {
  return Math.round(gross / (1 + vatRate / 100) * 100) / 100
}

/** Summiert Positionen nach MwSt-Satz */
export type VatSummary = {
  vatRate: number
  netTotal: number
  vatAmount: number
  grossTotal: number
}

export function calcVatSummary(items: Pick<DocumentItem, 'quantity' | 'gross_unit_price' | 'vat_rate'>[]): VatSummary[] {
  const map = new Map<number, { net: number; vat: number; gross: number }>()
  for (const item of items) {
    const gross = item.quantity * item.gross_unit_price
    const net = grossToNet(gross, item.vat_rate)
    const vatAmt = gross - net
    const existing = map.get(item.vat_rate) ?? { net: 0, vat: 0, gross: 0 }
    map.set(item.vat_rate, {
      net: existing.net + net,
      vat: existing.vat + vatAmt,
      gross: existing.gross + gross,
    })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([vatRate, s]) => ({
      vatRate,
      netTotal: Math.round(s.net * 100) / 100,
      vatAmount: Math.round(s.vat * 100) / 100,
      grossTotal: Math.round(s.gross * 100) / 100,
    }))
}
