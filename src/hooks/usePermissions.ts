import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_permissions')
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
  return permissions?.contacts?.can_delete === true
}

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ['is_super_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role:roles(name)')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle()
      if (error) throw error
      return (data?.role as any)?.name === 'Super-Admin'
    }
  })
}

// Prüft, ob dem aktuellen Nutzer überhaupt eine Rolle zugewiesen ist.
// Neu registrierte Nutzer haben noch keine Rolle -> nur Dashboard sichtbar.
export function useHasRole() {
  return useQuery({
    queryKey: ['has_role'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return false

      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      if (error) throw error
      return !!data
    }
  })
}
