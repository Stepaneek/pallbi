import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/

const SLOT_ORDER: Record<string, number> = { rano: 1, dopoledne: 1, odpoledne: 2 }

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

  let body: { athlete_id?: string; plan_or_real?: string; start?: string; end?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Neplatná data.' }, 400)
  }

  const { athlete_id, plan_or_real, start, end } = body
  if (typeof athlete_id !== 'string' || !uuidPattern.test(athlete_id)) {
    return json({ error: 'Neplatný sportovec.' }, 400)
  }
  if (plan_or_real !== 'plan' && plan_or_real !== 'real') {
    return json({ error: 'Neplatný režim plán/skutečnost.' }, 400)
  }
  if (typeof start !== 'string' || !datePattern.test(start)) {
    return json({ error: 'Neplatné datum start.' }, 400)
  }
  if (typeof end !== 'string' || !datePattern.test(end)) {
    return json({ error: 'Neplatné datum end.' }, 400)
  }

  // Service-role client (bypasses RLS – we enforce access manually below)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Authorization: own data, or coach linked to athlete
  if (athlete_id !== userId) {
    const { data: link, error: linkErr } = await admin
      .from('coach_athlete_links')
      .select('athlete_id')
      .eq('coach_id', userId)
      .eq('athlete_id', athlete_id)
      .maybeSingle()
    if (linkErr) {
      console.error('training-week-load link check failed', linkErr)
      return json({ error: 'Načtení selhalo.' }, 500)
    }
    if (!link) return json({ error: 'Nemáš přístup k tomuto sportovci.' }, 403)
  }

  const { data: blocksRaw, error: blocksErr } = await admin
    .from('training_blocks')
    .select('*')
    .eq('athlete_id', athlete_id)
    .eq('plan_or_real', plan_or_real)
    .gte('block_date', start)
    .lte('block_date', end)

  if (blocksErr) {
    console.error('training-week-load blocks query failed', blocksErr)
    return json({ error: blocksErr.message }, 500)
  }

  const blocks = (blocksRaw ?? [])
    .map((row) => ({
      ...row,
      block_date: typeof row.block_date === 'string'
        ? row.block_date.slice(0, 10)
        : String(row.block_date).slice(0, 10),
      distance_km: row.distance_km == null ? null : Number(row.distance_km),
    }))
    .sort((a, b) => {
      if (a.block_date !== b.block_date) return a.block_date < b.block_date ? -1 : 1
      return (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99)
    })

  return json({ ok: true, blocks, commentCounts: {} })
})
