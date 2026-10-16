import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Skr03Entry } from './useSkr03'
import type { Transaction } from './useAccounting'

// ─── Typen ────────────────────────────────────────────────────────────────────

export type Buchung = {
  id: string
  buchungssatz_id: string
  datum: string
  betrag: number
  sollkonto_id: string | null
  habenkonto_id: string | null
  buchungstext: string | null
  anmerkungen: string | null
  sort_order: number
  sollkonto?: Pick<Skr03Entry, 'id' | 'kontonummer' | 'beschriftung'> | null
  habenkonto?: Pick<Skr03Entry, 'id' | 'kontonummer' | 'beschriftung'> | null
}

export type Buchungssatz = {
  id: string
  nummer: number
  datum: string
  buchungstext: string | null
  belegnummer: string | null
  belegdatum: string | null
  beleg_sharepoint_url: string | null
  beleg_sharepoint_path: string | null
  beleg_storage_path: string | null
  beleg_storage_name: string | null
  beleg_storage_mime: string | null
  belegtyp: string | null
  contact_id: string | null
  status: 'offen' | 'teilbezahlt' | 'bezahlt' | 'storniert'
  herkunft: 'manuell' | 'geldkontobewegung' | 'beleg_ocr'
  anmerkungen: string | null
  is_active: boolean
  ki_vorlage: boolean
  created_at: string
  created_by_name: string | null
  updated_at: string
  buchungen?: Buchung[]
  transactions?: Transaction[]
  buchungssatz_transactions?: { transaction_id: string; transactions?: Transaction }[]
}

// ─── Buchungssätze ────────────────────────────────────────────────────────────

export function useBuchungssaetze(filters?: {
  status?: string
  date_from?: string
  date_to?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['buchungssaetze', filters],
    queryFn: async () => {
      let query = supabase
        .from('buchungssaetze')
        .select(`
          *,
          contact:contacts(id, is_company, first_name, last_name, company_name, email_main),
          buchungen(
            *,
            sollkonto:skr03!sollkonto_id(id, kontonummer, beschriftung),
            habenkonto:skr03!habenkonto_id(id, kontonummer, beschriftung)
          ),
          buchungssatz_transactions(
            transaction_id,
            transactions(id, booking_date, amount, counterpart_name, purpose, counterpart_iban)
          )
        `)
        .eq('is_active', true)
        .order('datum', { ascending: false })
        .order('nummer', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.date_from) query = query.gte('datum', filters.date_from)
      if (filters?.date_to) query = query.lte('datum', filters.date_to)
      if (filters?.search) {
        query = query.or(
          `buchungstext.ilike.%${filters.search}%,belegnummer.ilike.%${filters.search}%,anmerkungen.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Buchungssatz[]
    }
  })
}

export function useSaveBuchungssatz() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      buchungssatz,
      buchungen,
      transaction_ids,
    }: {
      buchungssatz: Partial<Buchungssatz> & { id?: string }
      buchungen: Partial<Buchung>[]
      transaction_ids: string[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles').select('first_name, last_name, display_name')
        .eq('id', user?.id).maybeSingle()
      const creatorName = profile?.display_name
        || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        || user?.email || 'FLOX'

      let bsId: string

      if (buchungssatz.id) {
        // Update
        const { error } = await supabase.from('buchungssaetze')
          .update({ ...buchungssatz, updated_at: new Date().toISOString() })
          .eq('id', buchungssatz.id)
        if (error) throw error
        bsId = buchungssatz.id
      } else {
        // Insert
        const { data, error } = await supabase.from('buchungssaetze')
          .insert({ ...buchungssatz, created_by: user?.id, created_by_name: creatorName })
          .select('id').single()
        if (error) throw error
        bsId = data.id
      }

      // Buchungen ersetzen
      await supabase.from('buchungen').delete().eq('buchungssatz_id', bsId)
      if (buchungen.length > 0) {
        const { error } = await supabase.from('buchungen').insert(
          buchungen.map((b, i) => ({ ...b, buchungssatz_id: bsId, sort_order: i }))
        )
        if (error) throw error
      }

      // Transaktions-Verknüpfungen ersetzen
      await supabase.from('buchungssatz_transactions').delete().eq('buchungssatz_id', bsId)
      if (transaction_ids.length > 0) {
        const { error } = await supabase.from('buchungssatz_transactions').insert(
          transaction_ids.map(tid => ({ buchungssatz_id: bsId, transaction_id: tid }))
        )
        if (error) throw error
      }

      return bsId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buchungssaetze'] })
    }
  })
}

export function useDeleteBuchungssatz() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Verknüpfungen löschen damit das BookOpen-Symbol korrekt angezeigt wird
      await supabase.from('buchungssatz_transactions').delete().eq('buchungssatz_id', id)
      const { error } = await supabase.from('buchungssaetze')
        .update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buchungssaetze'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    }
  })
}

export function useUpdateBuchungssatzStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Buchungssatz['status'] }) => {
      const { error } = await supabase.from('buchungssaetze')
        .update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buchungssaetze'] })
  })
}

export function useToggleKiVorlage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ki_vorlage }: { id: string; ki_vorlage: boolean }) => {
      const { error } = await supabase.from('buchungssaetze')
        .update({ ki_vorlage }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buchungssaetze'] })
  })
}

// ─── Beleg Upload (Supabase Storage) ─────────────────────────────────────────

export async function uploadBeleg(file: File, buchungssatzId: string): Promise<{
  path: string
  name: string
  mime: string
}> {
  const ext = file.name.split('.').pop()
  const path = `${buchungssatzId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('belege').upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error
  return { path, name: file.name, mime: file.type }
}

export async function getBelegUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from('belege').createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

// ─── Custom SKR03 Konten ──────────────────────────────────────────────────────

export function useCustomKonten() {
  return useQuery({
    queryKey: ['skr03_custom'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skr03')
        .select('*, contact:contacts(id, first_name, last_name, company_name, is_company)')
        .eq('is_custom', true)
        .order('kontonummer')
      if (error) throw error
      return data as unknown as (Skr03Entry & {
        contact?: { id: string; first_name: string | null; last_name: string | null; company_name: string | null; is_company: boolean } | null
      })[]
    }
  })
}

export function useSaveCustomKonto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (konto: Partial<Skr03Entry> & {
      id?: string
      contact_id?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (konto.id) {
        const { error } = await supabase.from('skr03').update(konto).eq('id', konto.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('skr03').insert({
          ...konto,
          is_custom: true,
          created_by: user?.id,
          created_at: new Date().toISOString(),
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skr03_custom'] })
      queryClient.invalidateQueries({ queryKey: ['skr03'] })
    }
  })
}

export function useDeleteCustomKonto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('skr03').delete().eq('id', id).eq('is_custom', true)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skr03_custom'] })
      queryClient.invalidateQueries({ queryKey: ['skr03'] })
    }
  })
}
