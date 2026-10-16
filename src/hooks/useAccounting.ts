import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Typen ────────────────────────────────────────────────────────────────────

export type AccountType = {
  id: string
  kuerzel: string
  name: string
  skr_kontonummer: string | null
  is_active: boolean
  created_at: string
}

export type FieldMapping = {
  target_field: string
  source_fields: number[]
  separator: string
}

export type ImportPattern = {
  id: string
  name: string
  account_type_id: string | null
  delimiter: string
  skip_rows: number
  field_mappings: FieldMapping[]
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  account_type?: AccountType
}

export type Transaction = {
  id: string
  account_type_id: string | null
  import_pattern_id: string | null
  booking_date: string | null
  amount: number | null
  counterpart_name: string | null
  counterpart_iban: string | null
  purpose: string | null
  notes: string | null
  dedup_hash: string | null
  created_at: string
  created_by_name?: string | null
  account_type?: AccountType
}

// ─── Account Types ────────────────────────────────────────────────────────────

export function useAccountTypes() {
  return useQuery({
    queryKey: ['account_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_types')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as AccountType[]
    }
  })
}

export function useSaveAccountType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (at: Partial<AccountType> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (at.id) {
        const { error } = await supabase.from('account_types').update(at).eq('id', at.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('account_types').insert({ ...at, created_by: user?.id })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account_types'] })
  })
}

export function useDeleteAccountType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('account_types').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account_types'] })
  })
}

// ─── Import Patterns ──────────────────────────────────────────────────────────

export function useImportPatterns() {
  return useQuery({
    queryKey: ['import_patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_patterns')
        .select('*, account_type:account_types(id, kuerzel, name)')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as unknown as ImportPattern[]
    }
  })
}

export function useSaveImportPattern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pattern: Partial<ImportPattern> & { id?: string }) => {
      const { account_type, ...data } = pattern as any
      const { data: { user } } = await supabase.auth.getUser()
      if (data.id) {
        const { error } = await supabase.from('import_patterns').update(data).eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('import_patterns').insert({ ...data, created_by: user?.id })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import_patterns'] })
  })
}

export function useDeleteImportPattern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('import_patterns').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import_patterns'] })
  })
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions(filters?: {
  account_type_id?: string
  date_from?: string
  date_to?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, account_type:account_types(id, kuerzel, name), buchungssatz_transactions(buchungssatz_id)')
        .order('booking_date', { ascending: false })
        .limit(500)

      if (filters?.account_type_id) query = query.eq('account_type_id', filters.account_type_id)
      if (filters?.date_from) query = query.gte('booking_date', filters.date_from)
      if (filters?.date_to) query = query.lte('booking_date', filters.date_to)
      if (filters?.search) {
        query = query.or(
          `counterpart_name.ilike.%${filters.search}%,purpose.ilike.%${filters.search}%,counterpart_iban.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Transaction[]
    }
  })
}

export function useImportTransactions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      transactions,
      importPatternId,
    }: {
      transactions: Partial<Transaction>[]
      importPatternId?: string
    }) => {
      const { data, error } = await supabase.rpc('import_transactions', {
        p_transactions: transactions,
        p_import_pattern_id: importPatternId ?? null,
      })
      if (error) throw error
      return data as { inserted: number; skipped: number; errors: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  })
}

export function useUpdateTransactionNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ notes: notes || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  })
}

// ─── Hilfsfunktion: Dedup-Hash ────────────────────────────────────────────────
// SHA-256 Hash aus Buchungstag + Betrag + IBAN + Verwendungszweck

export async function buildDedupHash(
  booking_date: string,
  amount: string,
  counterpart_iban: string,
  purpose: string
): Promise<string> {
  const raw = `${booking_date}|${amount}|${counterpart_iban}|${purpose}`
  const msgBuffer = new TextEncoder().encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
