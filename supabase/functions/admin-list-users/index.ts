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
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) {
    return json({ error: 'Přihlášení vypršelo, přihlas se prosím znovu.' }, 401)
  }
  if (userId !== ADMIN_USER_ID) {
    return json({ error: 'Nemáš oprávnění.' }, 403)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, name, club, created_at')
  if (pErr) {
    console.error('admin-list-users profiles failed', pErr)
    return json({ error: pErr.message }, 500)
  }

  const { data: stravaRows, error: sErr } = await admin
    .from('strava_tokens')
    .select('user_id')
  if (sErr) {
    console.error('admin-list-users strava_tokens failed', sErr)
  }
  const stravaSet = new Set<string>((stravaRows ?? []).map((r: { user_id: string }) => r.user_id))

  const users: Array<{
    id: string
    email: string | null
    name: string | null
    club: string | null
    created_at: string | null
    last_sign_in_at: string | null
    strava_connected: boolean
  }> = []

  // paginate auth users
  let page = 1
  const perPage = 1000
  const authMap = new Map<string, { email: string | null; last_sign_in_at: string | null; created_at: string | null }>()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('admin-list-users listUsers failed', error)
      return json({ error: error.message }, 500)
    }
    for (const u of data.users) {
      authMap.set(u.id, {
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at ?? null,
      })
    }
    if (data.users.length < perPage) break
    page += 1
    if (page > 50) break
  }

  for (const p of profiles ?? []) {
    const a = authMap.get(p.id)
    users.push({
      id: p.id,
      email: a?.email ?? null,
      name: p.name,
      club: p.club,
      created_at: p.created_at ?? a?.created_at ?? null,
      last_sign_in_at: a?.last_sign_in_at ?? null,
      strava_connected: stravaSet.has(p.id),
    })
  }

  // include any auth users without profile rows
  for (const [id, a] of authMap) {
    if (!users.find((u) => u.id === id)) {
      users.push({
        id,
        email: a.email,
        name: null,
        club: null,
        created_at: a.created_at,
        last_sign_in_at: a.last_sign_in_at,
        strava_connected: stravaSet.has(id),
      })
    }
  }

  users.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return json({ ok: true, users })
})
