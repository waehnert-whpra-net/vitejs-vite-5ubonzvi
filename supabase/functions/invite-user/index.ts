// supabase/functions/invite-user/index.ts
// Lädt einen neuen Nutzer per E-Mail ein (Admin-Funktion, nur für SuperAdmins)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://flox.natureandfriends.de'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller via their JWT
    const authHeader = req.headers.get('authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) {
      return json({ error: 'Nicht authentifiziert' }, 401)
    }

    // Check SuperAdmin role (tolerant gegenüber mehreren user_roles-Zeilen)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: roleRows, error: roleError } = await adminClient
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', caller.id)
    if (roleError) {
      console.error('invite-user role check error:', roleError)
      return json({ error: `Rollenprüfung fehlgeschlagen: ${roleError.message}` }, 500)
    }
    const isSuperAdmin = (roleRows ?? []).some((r: any) => r?.roles?.name === 'Super-Admin')
    if (!isSuperAdmin) {
      return json({ error: 'Keine Berechtigung (Super-Admin erforderlich)' }, 403)
    }

    const { email, firstName, lastName, roleId } = await req.json()
    if (!email) {
      return json({ error: 'E-Mail fehlt' }, 400)
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
        // Einladung führt direkt zur Seite, auf der das Passwort gesetzt wird
        redirectTo: `${APP_URL}/reset-password`,
      }
    )
    if (inviteError) {
      console.error('invite-user inviteUserByEmail error:', inviteError)
      return json({ error: inviteError.message }, 400)
    }

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

    return json({ success: true, userId: newUserId })
  } catch (err: any) {
    console.error('invite-user error:', err)
    return json({ error: err.message ?? 'Unbekannter Fehler' }, 500)
  }
})
