import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ['app_setting', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (error) throw error
      return data?.value ?? null
    }
  })
}

export function useAppSettings(keys: string[]) {
  return useQuery({
    queryKey: ['app_settings', keys],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', keys)
      if (error) throw error
      const map: Record<string, string | null> = {}
      keys.forEach(k => { map[k] = null })
      data?.forEach(row => { map[row.key] = row.value })
      return map
    }
  })
}

export function useSetAppSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_by: user?.id, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['app_setting', variables.key] })
      queryClient.invalidateQueries({ queryKey: ['app_settings'] })
    }
  })
}
