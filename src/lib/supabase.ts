import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string
          is_company: boolean
          salutation_id: string | null
          title: string | null
          first_name: string | null
          last_name: string | null
          company_name: string | null
          department: string | null
          position: string | null
          tax_number: string | null
          vat_id: string | null
          customer_number: string | null
          supplier_number: string | null
          employee_number: string | null
          email_main: string | null
          phone_main: string | null
          mobile_main: string | null
          website: string | null
          birthday: string | null
          notes: string | null
          tags: string[] | null
          is_active: boolean
          outlook_contact_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      contact_types: {
        Row: {
          id: string
          name: string
          color: string | null
          icon: string | null
          sort_order: number
          created_at: string
        }
      }
      contact_type_assignments: {
        Row: {
          contact_id: string
          contact_type_id: string
          since: string | null
          notes: string | null
        }
      }
      contact_addresses: {
        Row: {
          id: string
          contact_id: string
          address_type: string
          street: string | null
          street_number: string | null
          address_extra: string | null
          postal_code: string | null
          city: string | null
          state: string | null
          country: string | null
          country_code: string | null
          is_primary: boolean
          created_at: string
        }
      }
      contact_communications: {
        Row: {
          id: string
          contact_id: string
          comm_type: string
          value: string
          label: string | null
          is_primary: boolean
          created_at: string
        }
      }
      salutations: {
        Row: {
          id: string
          name: string
          greeting: string | null
          sort_order: number
          created_at: string
        }
      }
    }
  }
}