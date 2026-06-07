import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_my_permissions')
      if (error) throw error
      return data as Record<string, {
        can_read: boolean
        can_write: boolean
        can_delete: boolean
      }>
    }
  })
}

export function useIsAdmin() {
  const { data: permissions } = usePermissions()
  // Admin hat delete-Recht auf contacts
  return permissions?.contacts?.can_delete === true
}