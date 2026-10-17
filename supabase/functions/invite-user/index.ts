// supabase/functions/invite-user/index.ts
// Lädt einen neuen Nutzer per E-Mail ein (Admin-Funktion, nur für SuperAdmins)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is SuperAdmin via their JWT
    const authHeader = req.headers.get('authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check SuperAdmin role
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

    const { email, firstName, lastName, roleId } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'E-Mail fehlt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: [firstName, lastName].filter(Boolean).join(' ') || null,
          first_name: firstName || null,
          last_name: lastName || null,
        },
        redirectTo: `${req.headers.get('origin') ?? SUPABASE_URL}/`,
      }
    )
    if (inviteError) throw inviteError

    const newUserId = inviteData.user.id

    // Create profile entry (id = user_id in user_profiles)
    await adminClient.from('user_profiles').upsert({
      id: newUserId,
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: [firstName, lastName].filter(Boolean).join(' ') || null,
      is_active: true,
      notify_new_users: false,
    }, { onConflict: 'id' })

    // Assign role if provided
    if (roleId) {
      await adminClient.rpc('set_user_role', {
        p_user_id: newUserId,
        p_role_id: roleId,
      })
    }

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('invite-user error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unbekannter Fehler' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
