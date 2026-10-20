// supabase/functions/delete-user/index.ts
// Löscht einen Nutzer aus Supabase Auth (nur für Super-Admins)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Caller-Identität prüfen
    const authHeader = req.headers.get('authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Nur Super-Admin darf löschen
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', caller.id)
      .single()
    const roleName = (roleData as any)?.roles?.name
    if (roleName !== 'Super-Admin') {
      return new Response(JSON.stringify({ error: 'Keine Berechtigung' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { userId } = await req.json()
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId fehlt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Schutz: Super-Admin kann sich nicht selbst löschen
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: 'Du kannst dich nicht selbst löschen.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Nutzer aus Auth löschen (cascaded: profile + roles werden durch DB-Trigger/FK bereinigt)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('delete-user error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unbekannter Fehler' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
