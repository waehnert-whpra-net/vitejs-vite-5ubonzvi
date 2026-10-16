// supabase/functions/notify-new-users/index.ts
// Verarbeitet notification_queue Einträge vom Typ 'new_user_registered'
// und sendet E-Mails an Admins mit notify_new_users = true

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GRAPH_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/graph-service`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendMailViaGraph(to: string[], subject: string, body: string): Promise<void> {
  const res = await fetch(GRAPH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sendMail', payload: { to, subject, body } }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Offene Benachrichtigungen holen
    const { data: queue, error: queueError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('type', 'new_user_registered')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)

    if (queueError) throw queueError
    if (!queue || queue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Keine offenen Benachrichtigungen' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Admin-E-Mails holen (notify_new_users = true)
    const { data: admins, error: adminError } = await supabase
      .rpc('get_notify_admin_emails')

    if (adminError) throw adminError
    if (!admins || admins.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Keine Admins für Benachrichtigung konfiguriert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminEmails = admins.map((a: { email: string }) => a.email)

    // 3. Für jeden Queue-Eintrag Mail senden
    for (const entry of queue) {
      const { email, name, registered_at } = entry.payload

      const registeredDate = new Date(registered_at).toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })

      const subject = `FLOX: Neuer Nutzer registriert – ${name}`
      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Neuer Nutzer in FLOX registriert</h2>
          <p>Ein neuer Nutzer hat sich in der FLOX-Anwendung registriert und wartet auf Freischaltung:</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold; width: 140px;">Name</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">E-Mail</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">Registriert am</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${registeredDate}</td>
            </tr>
          </table>
          <p>Bitte melde dich bei dem Nutzer per E-Mail und weise ihm in FLOX unter <strong>Mehr... → Nutzer &amp; Rechte</strong> die entsprechende Rolle zu.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">Diese Nachricht wurde automatisch von FLOX (natureandfriends am Üdersee GmbH) versandt.</p>
        </div>
      `

      try {
        await sendMailViaGraph(adminEmails, subject, body)

        // 4. Status auf 'sent' setzen
        await supabase
          .from('notification_queue')
          .update({ status: 'sent', processed_at: new Date().toISOString() })
          .eq('id', entry.id)

      } catch (mailError) {
        // Bei Fehler: Status auf 'failed' setzen, nicht abbrechen
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', entry.id)

        console.error(`Mail-Fehler für Queue-Eintrag ${entry.id}:`, mailError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: queue.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
