import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type PropertyArea = {
  id: string
  nr: number
  name: string
  is_outdoor: boolean
  symbol: string | null
  color: string | null
  description: string | null
  display_name: string | null
  is_active: boolean
  sort_order: number
}

export type PropertyUnit = {
  id: string
  nr: number | null
  name: string | null
  short_code: string | null
  short_code_old: string | null
  area_id: string
  location: string | null
  location_geo: string | null
  rental_period: string | null
  cleaning_status: string | null
  cleaning_cycle: string | null
  cleaning_notes: string | null
  rent_target: number | null
  daily_rate_per_person: number | null
  rent_calculated_weekly: number | null
  rent_total: number | null
  rent_cold: number | null
  operating_costs: number | null
  heating_costs: number | null
  land_price_share: number | null
  color: string | null
  rooms: number | null
  max_persons: number | null
  sqm_measured: number | null
  has_terrace: boolean
  has_garden: boolean
  is_rentable: boolean
  rooms_with_wc: number | null
  max_extra_beds: number | null
  extra_beds_delivery: number | null
  extra_beds_couch: number | null
  magic_plan: string | null
  floor_plan: string | null
  notes: string | null
  document_folder: string | null
  is_active: boolean
  area?: PropertyArea
}

export type PropertyUsage = {
  id: string
  nr: number | null
  unit_id: string | null
  contact_id: string | null
  is_unlimited: boolean
  rental_period: string | null
  date_from: string | null
  date_to: string | null
  rent_actual: number | null
  handover_date: string | null
  handover_time: string | null
  handover_notes: string | null
  return_date: string | null
  return_time: string | null
  return_notes: string | null
  children_count: number
  adults_count: number
  is_active: boolean
  show_in_calendar: boolean
  calendar_comment: string | null
  notes: string | null
  unit?: PropertyUnit
  contact?: {
    id: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    is_company: boolean
  }
}

export function usePropertyAreas() {
  return useQuery({
    queryKey: ['property_areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_areas')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as PropertyArea[]
    }
  })
}

export function usePropertyArea(id: string) {
  return useQuery({
    queryKey: ['property_area', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_areas')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as PropertyArea
    },
    enabled: !!id
  })
}

export function useSavePropertyArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (area: Partial<PropertyArea> & { id?: string }) => {
      if (area.id) {
        const { error } = await supabase
          .from('property_areas').update(area).eq('id', area.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('property_areas').insert(area)
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property_areas'] })
  })
}

export function useDeletePropertyArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('property_areas').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property_areas'] })
  })
}

export function usePropertyUnits(areaId?: string) {
  return useQuery({
    queryKey: ['property_units', areaId],
    queryFn: async () => {
      let query = supabase
        .from('property_units')
        .select('*, area:property_areas(*)')
        .eq('is_active', true)
        .order('nr', { ascending: true })
      if (areaId) query = query.eq('area_id', areaId)
      const { data, error } = await query
      if (error) throw error
      return (data as unknown) as PropertyUnit[]
    }
  })
}

export function usePropertyUnit(id: string) {
  return useQuery({
    queryKey: ['property_unit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_units')
        .select('*, area:property_areas(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return (data as unknown) as PropertyUnit
    },
    enabled: !!id
  })
}

export function useSavePropertyUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (unit: Partial<PropertyUnit> & { id?: string }) => {
      const { area, ...data } = unit as any
      if (data.id) {
        const { error } = await supabase
          .from('property_units').update(data).eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('property_units').insert(data)
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property_units'] })
  })
}

export function useDeletePropertyUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('property_units').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property_units'] })
  })
}

export function usePropertyUsages(unitId?: string) {
  return useQuery({
    queryKey: ['property_usages', unitId],
    queryFn: async () => {
      let query = supabase
        .from('property_usages')
        .select(`
          *,
          unit:property_units(id, name, short_code, location, color),
          contact:contacts(id, first_name, last_name, company_name, is_company),
          group_usage:group_usages(id, name)
        `)
        .eq('is_active', true)
        .order('date_from', { ascending: false })
      if (unitId) query = query.eq('unit_id', unitId)
      const { data, error } = await query
      if (error) throw error
      return (data as unknown) as PropertyUsage[]
    }
  })
}

export function usePropertyUsage(id: string) {
  return useQuery({
    queryKey: ['property_usage', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_usages')
        .select(`
          *,
          unit:property_units(id, name, short_code, location, color),
          contact:contacts(id, first_name, last_name, company_name, is_company)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return (data as unknown) as PropertyUsage
    },
    enabled: !!id
  })
}

export function useSavePropertyUsage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (usage: Partial<PropertyUsage> & { id?: string }) => {
      const { unit, contact, ...data } = usage as any
      if (data.id) {
        const { error } = await supabase
          .from('property_usages').update(data).eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('property_usages').insert(data)
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property_usages'] })
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['property_usage', variables.id] })
      }
    }
  })
}

export function useDeletePropertyUsage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('property_usages').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property_usages'] })
  })
}

// ─── Gruppennutzungen ────────────────────────────────────────────────────────

export type GroupUsage = {
  id: string
  name: string
  contact_id: string | null
  date_from: string | null
  date_to: string | null
  notes: string | null
  sharepoint_url: string | null
  storage_path: string | null
  is_active: boolean
  created_at: string
  contact?: {
    id: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    is_company: boolean
  }
  usages?: PropertyUsage[]
}

export function useGroupUsages() {
  return useQuery({
    queryKey: ['group_usages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_usages')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, company_name, is_company),
          usages:property_usages(
            *,
            unit:property_units(id, name, short_code, max_persons, color)
          )
        `)
        .eq('is_active', true)
        .order('date_from', { ascending: false })
      if (error) throw error
      return data as unknown as GroupUsage[]
    }
  })
}

export function useGroupUsage(id: string) {
  return useQuery({
    queryKey: ['group_usage', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_usages')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, company_name, is_company),
          usages:property_usages(
            *,
            unit:property_units(id, name, short_code, max_persons, color)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as GroupUsage
    },
    enabled: !!id
  })
}

export function useSaveGroupUsage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (group: Partial<GroupUsage> & { id?: string }) => {
      const { contact, usages, ...data } = group as any
      if (data.id) {
        const { error } = await supabase
          .from('group_usages').update(data).eq('id', data.id)
        if (error) throw error
        return data.id as string
      } else {
        const { data: inserted, error } = await supabase
          .from('group_usages').insert(data).select('id').single()
        if (error) throw error
        return inserted.id as string
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group_usages'] })
      queryClient.invalidateQueries({ queryKey: ['group_usage'] })
    }
  })
}

export function useDeleteGroupUsage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Zuerst alle zugehörigen Einzelnutzungen deaktivieren
      const { error: usagesError } = await supabase
        .from('property_usages')
        .update({ is_active: false })
        .eq('group_usage_id', id)
      if (usagesError) throw usagesError

      // Dann das Gastro-Event selbst deaktivieren
      const { error } = await supabase
        .from('group_usages').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group_usages'] })
      queryClient.invalidateQueries({ queryKey: ['property_usages'] })
    }
  })
}

// Verfügbare Einheiten für einen Zeitraum (für Gruppennutzung)
export function useAvailableUnits(dateFrom: string | null, dateTo: string | null, excludeGroupId?: string) {
  return useQuery({
    queryKey: ['available_units', dateFrom, dateTo, excludeGroupId],
    queryFn: async () => {
      // Alle aktiven Einheiten laden
      const { data: units, error: unitError } = await supabase
        .from('property_units')
        .select('id, nr, name, short_code, color, max_persons, max_extra_beds, area:property_areas(id, name, color)')
        .eq('is_active', true)
        .eq('is_rentable', true)
        .order('nr')
      if (unitError) throw unitError

      // Belegte Einheiten im Zeitraum ermitteln
      let usageQuery = supabase
        .from('property_usages')
        .select('unit_id')
        .eq('is_active', true)
        .not('unit_id', 'is', null)
        .or(`date_from.lte.${dateTo},date_to.gte.${dateFrom}`)
      if (excludeGroupId) {
        usageQuery = usageQuery.neq('group_usage_id', excludeGroupId)
      }
      const { data: occupied, error: occError } = await usageQuery
      if (occError) throw occError

      const occupiedIds = new Set((occupied ?? []).map((u: any) => u.unit_id))
      return (units ?? []).map((u: any) => ({
        ...u,
        is_available: !occupiedIds.has(u.id)
      }))
    },
    enabled: !!dateFrom && !!dateTo
  })
}
