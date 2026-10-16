import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Skr03Entry = {
  id: string
  kontonummer: string
  beschriftung: string | null
  kontenzweck: string | null
  konto_von: string | null
  konto_bis: string | null
  s_b_i: string | null
  s_k_i: string | null
  s_k_i_2: string | null
  s_k_i_3: string | null
  fe: string | null
  anlagenspiegelfkt: string | null
  faktor_2: string | null
  zusatzfunktion: string | null
  hf_typ: string | null
  funktion: string | null
  is_hauptkonto: boolean
}

export function useSkr03(nurHauptkonten: boolean, search?: string) {
  return useQuery({
    queryKey: ['skr03', nurHauptkonten, search],
    queryFn: async () => {
      let query = supabase
        .from('skr03')
        .select('*', { count: 'exact' })
        .order('kontonummer')
        .limit(10000)

      if (nurHauptkonten) {
        query = query.eq('is_hauptkonto', true)
      }

      // Nur Einträge mit Beschriftung anzeigen (leere sind technische Header-Zeilen)
      query = query.not('beschriftung', 'is', null)

      if (search && search.length > 0) {
        query = query.or(
          `kontonummer.ilike.%${search}%,beschriftung.ilike.%${search}%,kontenzweck.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query
      if (error) throw error
      return { data: data as Skr03Entry[], count: count ?? 0 }
    }
  })
}
