import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Contact = {
  id: string
  is_company: boolean
  salutation_id: string | null
  title: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  legal_form: string | null
  register_info: string | null
  position: string | null
  department: string | null
  employee_number: string | null
  email_main: string | null
  phone_main: string | null
  mobile_main: string | null
  website: string | null
  birthday: string | null
  tax_number: string | null
  vat_id: string | null
  customer_number: string | null
  supplier_number: string | null
  notes: string | null
  visibility: string | null
  tags: string[] | null
  is_active: boolean
  created_at: string
  contact_type_assignments?: {
    contact_types: {
      id: string
      name: string
      color: string | null
    }
  }[]
}

export function useContacts(search: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['contacts', search, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select(`
          id, is_company, salutation_id, title,
          first_name, last_name, company_name, legal_form, register_info,
          position, department, employee_number,
          email_main, phone_main, mobile_main, website, birthday,
          tax_number, vat_id, customer_number, supplier_number,
          notes, visibility, tags, is_active, created_at,
          contact_type_assignments(contact_types(id, name, color))
        `, { count: 'exact' })
        .eq('is_active', true)
        .order('last_name', { ascending: true })
        .order('company_name', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email_main.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query
      if (error) throw error
      return { data: data as unknown as Contact[], count: count ?? 0 }
    }
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] })
  })
}

export type ContactType = {
  id: string
  name: string
  color: string | null
  description: string | null
}

export type Salutation = {
  id: string
  name: string
  gender: string | null
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          contact_type_assignments(contact_types(id, name, color)),
          contact_addresses(*),
          contact_communications(*),
          contact_relations_contact_id:contact_relations!contact_relations_contact_id_fkey(
            id, related_id, relation_type,
            related:contacts!contact_relations_related_id_fkey(
              id, first_name, last_name, position,
              email_main, phone_main, mobile_main,
              salutation_id, title
            )
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as Contact & {
        contact_addresses: any[]
        contact_communications: any[]
        contact_relations_contact_id: any[]
      }
    },
    enabled: !!id
  })
}

export function useContactTypes() {
  return useQuery({
    queryKey: ['contact_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_types')
        .select('*')
        .order('name')
      if (error) throw error
      return data as ContactType[]
    }
  })
}

export function useSalutations() {
  return useQuery({
    queryKey: ['salutations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salutations')
        .select('*')
        .order('name')
      if (error) throw error
      return data as Salutation[]
    }
  })
}

export function useContactSearch(search: string) {
  return useQuery({
    queryKey: ['contact_search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, is_company, first_name, last_name, company_name, email_main')
        .eq('is_active', true)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%`)
        .limit(20)
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!search && search.length >= 2
  })
}

export function useSaveContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (contact: Partial<Contact> & { id?: string }) => {
      if (contact.id) {
        const { error } = await supabase
          .from('contacts').update(contact).eq('id', contact.id)
        if (error) throw error
        return contact.id
      } else {
        const { data, error } = await supabase
          .from('contacts').insert(contact).select('id').single()
        if (error) throw error
        return data.id
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] })
  })
}
