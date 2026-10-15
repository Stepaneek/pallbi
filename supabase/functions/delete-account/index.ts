import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoda není povolená.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Nejsi přihlášený.' }, 401)
  }

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
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) {
    return json({ error: 'Přihlášení vypršelo, přihlas se prosím znovu.' }, 401)
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Neplatná data.' }, 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) return json({ error: 'Zadej heslo pro potvrzení.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Get user email
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
  if (userErr || !userData?.user?.email) {
    return json({ error: 'Účet se nepodařilo načíst.' }, 500)
  }
  const email = userData.user.email

  // Verify password by attempting sign in
  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: verifyErr } = await verifyClient.auth.signInWithPassword({ email, password })
  if (verifyErr) {
    return json({ error: 'Nesprávné heslo.' }, 401)
  }

  // Delete user data from all tables
  const tables = [
    'training_blocks',
    'weekly_meta',
    'events',
    'coach_invites',
    'coach_athlete_links',
    'strava_tokens',
    'user_roles',
    'profiles',
  ]

  for (const table of tables) {
    const col =
      table === 'profiles' ? 'id'
      : table === 'user_roles' || table === 'strava_tokens' ? 'user_id'
      : 'athlete_id'
    const { error } = await admin.from(table).delete().eq(col, userId)
    if (error) console.error(`delete-account: failed to clear ${table}`, error)
  }

  // Also delete coach_athlete_links where user is coach
  await admin.from('coach_athlete_links').delete().eq('coach_id', userId)

  // Delete auth user
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) {
    console.error('delete-account: failed to delete auth user', delErr)
    return json({ error: delErr.message }, 500)
  }

  return json({ ok: true })
})
