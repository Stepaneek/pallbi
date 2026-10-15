import { createClient } from 'npm:@supabase/supabase-js@2'
import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Action = 'save' | 'delete'
type PlanOrReal = 'plan' | 'real'
type Slot = 'rano' | 'dopoledne' | 'odpoledne'
type Sport = 'beh' | 'kolo' | 'kolobezka_lyze' | 'lyze' | 'plavani' | 'ostatni' | 'strelba' | 'osi'
type Zone = 'VOLNA' | 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6'

type Segment = { zone: Zone; duration_minutes: number }
type Stance = 'prone' | 'standing'
type ShootingSet = {
  stance: Stance
  misses: number
  miss_clock: number[]
  intensity?: string | null
  first_shot_seconds?: number | null
  total_seconds?: number | null
}

type SaveBody = {
  action?: Action
  id?: string | null
  athlete_id: string
  block_date: string
  slot: Slot
  plan_or_real: PlanOrReal
  sport: Sport
  zone: Zone
  duration_minutes: number
  segments: Segment[]
  distance_km?: number | null
  avg_heart_rate?: number | null
  rpe?: number | null
  notes?: string | null
  shooting_hits?: number | null
  shooting_shots?: number | null
  shooting_sets?: ShootingSet[]
  shooting_intensity?: string | null
}

type DeleteBody = {
  action: 'delete'
  id: string
  athlete_id: string
  plan_or_real: PlanOrReal
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const slots = new Set<Slot>(['rano', 'dopoledne', 'odpoledne'])
const plans = new Set<PlanOrReal>(['plan', 'real'])
const sports = new Set<Sport>(['beh', 'kolo', 'kolobezka_lyze', 'lyze', 'plavani', 'ostatni', 'strelba', 'osi'])
const stances = new Set<Stance>(['prone', 'standing'])
const zones = new Set<Zone>(['VOLNA', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6'])
const shootingIntensities = new Set(['klidova', 'i1', 'i2', 'i3', 'i4', 'i5'])

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function serializeBlock(row: Record<string, unknown>) {
  return {
    ...row,
    block_date: row.block_date instanceof Date
      ? row.block_date.toISOString().slice(0, 10)
      : String(row.block_date).slice(0, 10),
    distance_km: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
  }
}

function validateBody(raw: unknown): SaveBody | DeleteBody {
  if (!raw || typeof raw !== 'object') throw new Error('Neplatná data tréninku.')
  const body = raw as Record<string, unknown>
  const action = (body.action ?? 'save') as Action

  if (action === 'delete') {
    if (typeof body.id !== 'string' || !uuidPattern.test(body.id)) throw new Error('Chybí ID tréninku pro smazání.')
    if (typeof body.athlete_id !== 'string' || !uuidPattern.test(body.athlete_id)) throw new Error('Neplatný sportovec.')
    if (!plans.has(body.plan_or_real as PlanOrReal)) throw new Error('Neplatný režim tréninku.')
    return {
      action: 'delete',
      id: body.id,
      athlete_id: body.athlete_id,
      plan_or_real: body.plan_or_real as PlanOrReal,
    }
  }

  if (body.id !== undefined && body.id !== null && (typeof body.id !== 'string' || !uuidPattern.test(body.id))) {
    throw new Error('Neplatné ID tréninku.')
  }
  if (typeof body.athlete_id !== 'string' || !uuidPattern.test(body.athlete_id)) throw new Error('Neplatný sportovec.')
  if (typeof body.block_date !== 'string' || !datePattern.test(body.block_date)) throw new Error('Neplatné datum.')
  if (!slots.has(body.slot as Slot)) throw new Error('Neplatná část dne.')
  if (!plans.has(body.plan_or_real as PlanOrReal)) throw new Error('Neplatný režim tréninku.')
  if (!sports.has(body.sport as Sport)) throw new Error('Neplatný sport.')
  if (!zones.has(body.zone as Zone)) throw new Error('Neplatná intenzita.')

  const notesValue = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  // Free-text plan mode: coach saves only a description in `notes`, no structured segments.
  const isFreeTextPlan =
    body.plan_or_real === 'plan' &&
    notesValue !== null &&
    (!Array.isArray(body.segments) || body.segments.length === 0)

  let segments: Segment[] = []
  let duration = 0

  if (isFreeTextPlan) {
    // Free-text plan: no structured segments, but the coach may set a planned duration in minutes.
    segments = []
    const planned = body.duration_minutes === null || body.duration_minutes === undefined || body.duration_minutes === ''
      ? 0
      : Number(body.duration_minutes)
    if (!Number.isInteger(planned) || planned < 0 || planned > 1440) throw new Error('Neplatná plánovaná délka tréninku.')
    duration = planned
  } else {
    if (!Array.isArray(body.segments) || body.segments.length === 0) {
      throw new Error('Přidej alespoň jeden úsek tréninku.')
    }
    for (const raw of body.segments as unknown[]) {
      if (!raw || typeof raw !== 'object') throw new Error('Neplatný úsek.')
      const s = raw as Record<string, unknown>
      if (!zones.has(s.zone as Zone)) throw new Error('Neplatná intenzita úseku.')
      const dur = Number(s.duration_minutes)
      if (!Number.isInteger(dur) || dur <= 0 || dur > 1440) throw new Error('Neplatná délka úseku.')
      segments.push({ zone: s.zone as Zone, duration_minutes: dur })
    }
    const segmentsTotal = segments.reduce((a, s) => a + s.duration_minutes, 0)

    duration = Number(body.duration_minutes)
    if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) throw new Error('Neplatná délka tréninku.')
    if (duration !== segmentsTotal) throw new Error('Součet úseků neodpovídá celkové době.')
  }

  const shootingSets: ShootingSet[] = []
  if (Array.isArray(body.shooting_sets)) {
    for (const raw of body.shooting_sets as unknown[]) {
      if (!raw || typeof raw !== 'object') throw new Error('Neplatná střelecká položka.')
      const s = raw as Record<string, unknown>
      if (!stances.has(s.stance as Stance)) throw new Error('Neplatná poloha střelby.')
      const misses = Number(s.misses ?? 0)
      if (!Number.isInteger(misses) || misses < 0 || misses > 100) throw new Error('Neplatný počet chyb.')
      const clocks: number[] = []
      if (Array.isArray(s.miss_clock)) {
        for (const c of s.miss_clock as unknown[]) {
          const n = Number(c)
          if (!Number.isInteger(n) || n < 0 || n > 12) throw new Error('Neplatná pozice chyby.')
          clocks.push(n)
        }
      }
      const seconds = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null
        const n = Number(v)
        if (!Number.isFinite(n) || n <= 0 || n > 3600) throw new Error('Neplatný čas střelby.')
        return Math.round(n * 10) / 10
      }
      const intensity =
        s.intensity === null || s.intensity === undefined || s.intensity === ''
          ? null
          : typeof s.intensity === 'string' && shootingIntensities.has(s.intensity)
            ? s.intensity
            : (() => { throw new Error('Neplatná intenzita střelby.') })()
      shootingSets.push({
        stance: s.stance as Stance,
        misses,
        miss_clock: clocks.slice(0, misses),
        intensity,
        first_shot_seconds: seconds(s.first_shot_seconds),
        total_seconds: seconds(s.total_seconds ?? s.time_seconds),
      })
    }
  }

  const distance = normalizeNumber(body.distance_km)
  const avgHr = normalizeNumber(body.avg_heart_rate)
  const rpe = normalizeNumber(body.rpe)
  const hits = normalizeNumber(body.shooting_hits)
  const shots = normalizeNumber(body.shooting_shots)
  const shootingIntensity =
    body.shooting_intensity === null || body.shooting_intensity === undefined || body.shooting_intensity === ''
      ? null
      : typeof body.shooting_intensity === 'string' && shootingIntensities.has(body.shooting_intensity)
        ? body.shooting_intensity
        : (() => { throw new Error('Neplatná intenzita střelby.') })()

  if (Number.isNaN(distance) || (distance !== null && (distance < 0 || distance > 999))) throw new Error('Neplatná vzdálenost.')
  if (Number.isNaN(avgHr) || (avgHr !== null && (avgHr < 30 || avgHr > 250))) throw new Error('Neplatný tep.')
  if (Number.isNaN(rpe) || (rpe !== null && (rpe < 0 || rpe > 10))) throw new Error('Neplatné RPE.')
  if (Number.isNaN(hits) || (hits !== null && hits < 0)) throw new Error('Neplatný počet zásahů.')
  if (Number.isNaN(shots) || (shots !== null && shots < 0)) throw new Error('Neplatný počet výstřelů.')
  if (hits !== null && shots !== null && hits > shots) throw new Error('Zásahů nemůže být víc než výstřelů.')

  return {
    action: 'save',
    id: (body.id as string | null | undefined) ?? null,
    athlete_id: body.athlete_id,
    block_date: body.block_date,
    slot: body.slot as Slot,
    plan_or_real: body.plan_or_real as PlanOrReal,
    sport: body.sport as Sport,
    zone: body.zone as Zone,
    duration_minutes: duration,
    segments,
    distance_km: distance,
    avg_heart_rate: avgHr,
    rpe,
    notes: notesValue,
    shooting_hits: hits,
    shooting_shots: shots,
    shooting_sets: shootingSets,
    shooting_intensity: shootingIntensity,
  }
}


async function canManage(client: Client, userId: string, athleteId: string, planOrReal: PlanOrReal) {
  if (athleteId === userId) return true
  if (planOrReal !== 'plan') return false

  const link = await client.queryObject<{ exists: boolean }>(
    'select exists(select 1 from public.coach_athlete_links where coach_id = $1 and athlete_id = $2) as exists',
    [userId, athleteId],
  )
  return link.rows[0]?.exists === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoda není povolená.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Nejsi přihlášený.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!supabaseUrl || !anonKey || !dbUrl) return json({ error: 'Backend není správně nakonfigurovaný.' }, 500)

  const token = authHeader.replace('Bearer ', '')
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return json({ error: 'Přihlášení vypršelo. Přihlas se prosím znovu.' }, 401)

  let body: SaveBody | DeleteBody
  try {
    body = validateBody(await req.json())
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Neplatná data tréninku.' }, 400)
  }

  const client = new Client(dbUrl)
  try {
    await client.connect()

    const allowed = await canManage(client, userId, body.athlete_id, body.plan_or_real)
    if (!allowed) return json({ error: 'Nemáš oprávnění upravit tento trénink.' }, 403)

    if (body.action === 'delete') {
      const existing = await client.queryObject<{ athlete_id: string; plan_or_real: PlanOrReal }>(
        'select athlete_id, plan_or_real from public.training_blocks where id = $1',
        [body.id],
      )
      const block = existing.rows[0]
      if (!block) return json({ error: 'Trénink už neexistuje.' }, 404)
      const deleteAllowed = await canManage(client, userId, block.athlete_id, block.plan_or_real)
      if (!deleteAllowed) return json({ error: 'Nemáš oprávnění smazat tento trénink.' }, 403)

      await client.queryObject('delete from public.training_blocks where id = $1', [body.id])
      return json({ ok: true, deletedId: body.id })
    }

    let saved
    if (body.id) {
      const existing = await client.queryObject<{ athlete_id: string; plan_or_real: PlanOrReal }>(
        'select athlete_id, plan_or_real from public.training_blocks where id = $1',
        [body.id],
      )
      const block = existing.rows[0]
      if (!block) return json({ error: 'Trénink už neexistuje.' }, 404)
      const updateAllowed = await canManage(client, userId, block.athlete_id, block.plan_or_real)
      if (!updateAllowed) return json({ error: 'Nemáš oprávnění upravit tento trénink.' }, 403)

      saved = await client.queryObject(
        `update public.training_blocks
          set athlete_id = $2,
              block_date = $3,
              slot = $4::public.day_slot,
              plan_or_real = $5::public.plan_real,
              sport = $6::public.sport_kind,
              zone = $7::public.intensity_zone,
              duration_minutes = $8,
              distance_km = $9,
              avg_heart_rate = $10,
              rpe = $11,
              notes = $12,
              shooting_hits = $13,
              shooting_shots = $14,
              segments = $15::jsonb,
              shooting_sets = $16::jsonb,
              shooting_intensity = $17,
              updated_at = now()
          where id = $1
          returning *`,
        [
          body.id,
          body.athlete_id,
          body.block_date,
          body.slot,
          body.plan_or_real,
          body.sport,
          body.zone,
          body.duration_minutes,
          body.distance_km,
          body.avg_heart_rate,
          body.rpe,
          body.notes,
          body.shooting_hits,
          body.shooting_shots,
          JSON.stringify(body.segments),
          JSON.stringify(body.shooting_sets ?? []),
          body.shooting_intensity,
        ],
      )
    } else {
      saved = await client.queryObject(
        `insert into public.training_blocks (
          athlete_id, block_date, slot, plan_or_real, sport, zone, duration_minutes,
          distance_km, avg_heart_rate, rpe, notes, shooting_hits, shooting_shots, segments, shooting_sets,
          shooting_intensity
        ) values (
          $1, $2, $3::public.day_slot, $4::public.plan_real, $5::public.sport_kind, $6::public.intensity_zone, $7,
          $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16
        ) returning *`,
        [
          body.athlete_id,
          body.block_date,
          body.slot,
          body.plan_or_real,
          body.sport,
          body.zone,
          body.duration_minutes,
          body.distance_km,
          body.avg_heart_rate,
          body.rpe,
          body.notes,
          body.shooting_hits,
          body.shooting_shots,
          JSON.stringify(body.segments),
          JSON.stringify(body.shooting_sets ?? []),
          body.shooting_intensity,
        ],
      )
    }

    return json({ ok: true, block: serializeBlock(saved.rows[0] as Record<string, unknown>) })
  } catch (error) {
    console.error('training-block-save error', error)
    return json({ error: error instanceof Error ? error.message : 'Trénink se nepodařilo uložit.' }, 500)
  } finally {
    try {
      await client.end()
    } catch {
      // ignore close errors
    }
  }
})
