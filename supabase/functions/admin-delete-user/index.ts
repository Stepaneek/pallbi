import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ADMIN_USER_ID = 'feee4b11-b3c3-4c77-bd8f-81a399633bf4'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoda není povolená.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Nejsi přihlášený.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Backend není správně nakonfigurovaný.' }, 500)
  }

  const token = authHeader.replace('Bearer ', '')
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
  const callerId = claimsData?.claims?.sub
  if (claimsError || !callerId) return json({ error: 'Přihlášení vypršelo.' }, 401)
  if (callerId !== ADMIN_USER_ID) return json({ error: 'Nemáš oprávnění.' }, 403)

  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Neplatná data.' }, 400)
  }
  const targetId = typeof body.user_id === 'string' ? body.user_id : ''
  if (!targetId) return json({ error: 'Chybí user_id.' }, 400)
  if (targetId === ADMIN_USER_ID) return json({ error: 'Admin účet nelze smazat.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const byUserId = ['training_blocks', 'weekly_meta', 'events', 'user_roles', 'strava_tokens']
  for (const t of byUserId) {
    const { error } = await admin.from(t).delete().eq('user_id', targetId)
    if (error) console.error(`admin-delete-user: ${t}`, error)
  }
  // coach_invites & coach_athlete_links reference athlete_id / coach_id
  await admin.from('coach_invites').delete().eq('athlete_id', targetId)
  await admin.from('coach_athlete_links').delete().eq('athlete_id', targetId)
  await admin.from('coach_athlete_links').delete().eq('coach_id', targetId)
  await admin.from('profiles').delete().eq('id', targetId)

  const { error: delErr } = await admin.auth.admin.deleteUser(targetId)
  if (delErr) {
    console.error('admin-delete-user: auth delete failed', delErr)
    return json({ error: delErr.message }, 500)
  }

  return json({ ok: true })
})
