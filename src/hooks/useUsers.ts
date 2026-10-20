import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type UserWithRole = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  display_name: string | null
  is_active: boolean | null
  last_login: string | null
  role_id: string | null
  role_name: string | null
  role_description: string | null
  granted_at: string | null
  expires_at: string | null
  notify_new_users: boolean
}

export function useAllUsers(options?: { staleTime?: number }) {
  return useQuery({
    queryKey: ['all_users_with_roles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_users_with_roles')
      if (error) throw error
      return data as UserWithRole[]
    },
    staleTime: options?.staleTime,
  })
}

export function useAllRoles() {
  return useQuery({
    queryKey: ['all_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, sort_order')
        .order('sort_order')
      if (error) throw error
      return data as { id: string; name: string; description: string | null; sort_order: number }[]
    }
  })
}

export function useSetNotifyNewUsers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, value }: { userId: string; value: boolean }) => {
      const { error } = await supabase.rpc('set_notify_new_users', {
        p_user_id: userId,
        p_value: value,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all_users_with_roles'] })
  })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string | null }) => {
      const { error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role_id: roleId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users_with_roles'] })
      queryClient.invalidateQueries({ queryKey: ['has_role'] })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    }
  })
}

export function useSingleUser(userId: string | undefined) {
  const { data: users } = useAllUsers()
  return users?.find(u => u.user_id === userId) ?? null
}

export type UpdateUserPayload = {
  userId: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  isActive: boolean
  expiresAt: string | null
  roleId: string | null
  notifyNewUsers: boolean
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateUserPayload) => {
      // Update profile + role via RPC (umgeht RLS für SuperAdmin)
      const { error: updateError } = await supabase.rpc('update_user_profile_and_role', {
        p_user_id: payload.userId,
        p_first_name: payload.firstName,
        p_last_name: payload.lastName,
        p_display_name: payload.displayName,
        p_is_active: payload.isActive,
        p_expires_at: payload.expiresAt ?? null,
        p_notify_new_users: payload.notifyNewUsers,
        p_role_id: payload.roleId ?? null,
      })
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users_with_roles'] })
      queryClient.invalidateQueries({ queryKey: ['has_role'] })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    }
  })
}

export function useSendPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      email,
      firstName,
      lastName,
      roleId,
    }: {
      email: string
      firstName: string | null
      lastName: string | null
      roleId: string | null
    }) => {
      // Use Supabase admin invite
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, firstName, lastName, roleId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users_with_roles'] })
    }
  })
}
