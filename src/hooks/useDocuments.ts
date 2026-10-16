import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DocumentTemplate = {
  id: string
  name: string
  description: string | null
  onedrive_path: string
  category: string | null
  is_active: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type UnitDocument = {
  id: string
  unit_id: string | null
  template_id: string | null
  contact_id: string | null
  name: string
  onedrive_path: string
  onedrive_url: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  template?: DocumentTemplate
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ['document_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as DocumentTemplate[]
    }
  })
}

export function useDocumentTemplate(id: string) {
  return useQuery({
    queryKey: ['document_template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as DocumentTemplate
    },
    enabled: !!id
  })
}

export function useSaveDocumentTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (template: Partial<DocumentTemplate> & { id?: string }) => {
      if (template.id) {
        const { error } = await supabase
          .from('document_templates')
          .update(template)
          .eq('id', template.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase
          .from('document_templates')
          .insert({ ...template, created_by: user?.id })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document_templates'] })
  })
}

export function useDeleteDocumentTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_templates')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document_templates'] })
  })
}

// ─── Unit Documents ───────────────────────────────────────────────────────────

export function useUnitDocuments(unitId: string) {
  return useQuery({
    queryKey: ['unit_documents', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_documents')
        .select('*, template:document_templates(name)')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as UnitDocument[]
    },
    enabled: !!unitId
  })
}

export function useSaveUnitDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (doc: Partial<UnitDocument>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('unit_documents')
        .insert({ ...doc, created_by: user?.id })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit_documents', variables.unit_id] })
    }
  })
}

export function useDeleteUnitDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, unitId }: { id: string; unitId: string }) => {
      const { error } = await supabase
        .from('unit_documents')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit_documents', variables.unitId] })
    }
  })
}
