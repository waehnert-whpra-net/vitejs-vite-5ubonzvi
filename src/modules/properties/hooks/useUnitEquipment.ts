import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type UnitEquipment = {
  id: string
  unit_id: string
  bereich: string
  ausstattung: string
  anzahl_soll: number
  anzahl_ist: number
  sort_order: number
}

export function useUnitEquipment(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit_equipment', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_equipment')
        .select('id, unit_id, bereich, ausstattung, anzahl_soll, anzahl_ist, sort_order')
        .eq('unit_id', unitId!)
        .order('sort_order')
        .order('ausstattung')
      if (error) throw error
      return data as UnitEquipment[]
    },
  })
}

// Änderung einer Zeile. Nicht-Admins dürfen nur anzahl_ist ändern (zusätzlich per DB-Trigger abgesichert).
export function useUpdateUnitEquipment(unitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<UnitEquipment, 'anzahl_ist' | 'anzahl_soll' | 'ausstattung' | 'bereich'>>) => {
      const { error } = await supabase.from('unit_equipment').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit_equipment', unitId] }),
  })
}

export function useAddUnitEquipment(unitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: { bereich: string; ausstattung: string; anzahl_soll: number; sort_order: number }) => {
      const { error } = await supabase
        .from('unit_equipment')
        .insert({ unit_id: unitId, anzahl_ist: 0, ...item })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit_equipment', unitId] }),
  })
}

export function useDeleteUnitEquipment(unitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('unit_equipment').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit_equipment', unitId] }),
  })
}
