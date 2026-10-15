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

  let body: { action?: string; name?: string; club?: string | null; is_biathlete?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Neplatná data.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (body.action === 'get') {
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, club, is_biathlete')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('profile-manage get failed', error)
      return json({ error: error.message }, 500)
    }
    return json({ ok: true, profile: data ?? { id: userId, name: null, club: null, is_biathlete: false } })
  }

  if (body.action === 'update') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length === 0 || name.length > 200) {
      return json({ error: 'Jméno musí mít 1–200 znaků.' }, 400)
    }
    const clubRaw = body.club
    const club = typeof clubRaw === 'string' ? clubRaw.trim() : clubRaw === null ? null : undefined
    if (typeof club === 'string' && club.length > 200) {
      return json({ error: 'Klub má maximálně 200 znaků.' }, 400)
    }
    const payload: Record<string, unknown> = { id: userId, name }
    if (club !== undefined) payload.club = club === '' ? null : club
    if (typeof body.is_biathlete === 'boolean') payload.is_biathlete = body.is_biathlete
    const { data, error } = await admin
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id, name, club, is_biathlete')
      .maybeSingle()
    if (error) {
      console.error('profile-manage update failed', error)
      return json({ error: error.message }, 500)
    }
    return json({ ok: true, profile: data })
  }

  return json({ error: 'Neznámá akce.' }, 400)
})
