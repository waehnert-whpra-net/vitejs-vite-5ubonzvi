import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Contact = {
  id: string
  is_company: boolean
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email_main: string | null
  phone_main: string | null
  mobile_main: string | null
  position: string | null
  department: string | null
  is_active: boolean
  created_at: string
  visibility: string
  legal_form: string | null
  register_info: string | null
  salutation?: { name: string } | null
  contact_type_assignments?: {
    contact_types: {
      id: string
      name: string
      color: string | null
    }
  }[]
}

export type ContactDetail = Contact & {
  title: string | null
  website: string | null
  birthday: string | null
  notes: string | null
  tags: string[] | null
  tax_number: string | null
  vat_id: string | null
  customer_number: string | null
  supplier_number: string | null
  employee_number: string | null
  salutation_id: string | null
  contact_addresses: {
    id: string
    address_type: string
    street: string | null
    street_number: string | null
    address_extra: string | null
    postal_code: string | null
    city: string | null
    state: string | null
    country: string | null
    is_primary: boolean
  }[]
  contact_communications: {
    id: string
    comm_type: string
    value: string
    label: string | null
    is_primary: boolean
  }[]
  contact_relations_contact_id: {
    id: string
    related_id: string
    relation_type: string
    related: {
      id: string
      first_name: string | null
      last_name: string | null
      position: string | null
      email_main: string | null
      phone_main: string | null
      mobile_main: string | null
      salutation_id: string | null
      title: string | null
    }
  }[]
}

// Alle Kontakte laden mit Pagination
export function useContacts(search?: string, page: number = 0, pageSize: number = 50) {
  return useQuery({
    queryKey: ['contacts', search, page],
    queryFn: async () => {
      const from = page * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('contacts')
        .select(`
          id, is_company, first_name, last_name, company_name,
          email_main, phone_main, mobile_main, position, department,
          is_active, created_at, visibility, legal_form, register_info,
          salutation:salutations(name),
          contact_type_assignments(
            contact_types(id, name, color)
          )
        `, { count: 'exact' })
        .eq('is_active', true)
        .order('last_name', { ascending: true })
        .range(from, to)

      if (search && search.length > 0) {
        query = query.or(
          `last_name.ilike.%${search}%,first_name.ilike.%${search}%,company_name.ilike.%${search}%,email_main.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query
      if (error) throw error
      return { data: (data as unknown) as Contact[], count: count ?? 0 }
    }
  })
}

// Einzelnen Kontakt laden
export function useContact(id: string) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          salutation:salutations(name),
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
      return (data as unknown) as ContactDetail
    },
    enabled: !!id
  })
}

// Kontakt löschen (deaktivieren)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    }
  })
}

// Kontaktarten laden
export function useContactTypes() {
  return useQuery({
    queryKey: ['contact_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_types')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data
    }
  })
}

// Anreden laden
export function useSalutations() {
  return useQuery({
    queryKey: ['salutations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salutations')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data
    }
  })
}

// Kontakte suchen (für Ansprechpartner-Suche)
export function useContactSearch(search: string) {
  return useQuery({
    queryKey: ['contact_search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name, email_main, is_company')
        .eq('is_active', true)
        .eq('is_company', false)
        .or(
          `last_name.ilike.%${search}%,first_name.ilike.%${search}%,email_main.ilike.%${search}%`
        )
        .limit(10)
      if (error) throw error
      return data
    },
    enabled: search.length >= 2
  })
}