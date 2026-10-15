import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLIENT_ID = "232420";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isSchemaCacheError = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && (error.code === "PGRST001" || error.code === "PGRST002" || /schema cache|Retrying/i.test(error.message ?? ""));

async function withSchemaRetry<T>(admin: ReturnType<typeof createClient>, operation: () => Promise<T & { error?: { code?: string; message?: string } | null }>) {
  let result: T & { error?: { code?: string; message?: string } | null };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    result = await operation();
    if (!isSchemaCacheError(result.error) || attempt === 3) return result;
    console.error("schema cache retry in strava-sync", { attempt: attempt + 1, error: result.error });
    try { await admin.rpc("reload_public_schema_cache"); } catch { /* ignore */ }
    await sleep(350 * 2 ** attempt);
  }
  return result!;
}

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  start_date: string;
  start_date_local?: string;
  type?: string;
  sport_type?: string;
  average_heartrate?: number;
  has_heartrate?: boolean;
  heartrate_stream?: number[] | null;
  time_stream?: number[] | null;
  moving_stream?: boolean[] | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    if (!clientSecret) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated", reason: "missing_bearer" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, anonKey, {
      db: { schema: "public" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("getClaims failed:", claimsErr);
      return new Response(JSON.stringify({ error: "Not authenticated", reason: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey, {
      db: { schema: "public" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: tokenRow, error: tokErr } = await withSchemaRetry(admin, () =>
      admin.from("strava_tokens").select("*").eq("user_id", userId).maybeSingle(),
    );

    if (tokErr) {
      return new Response(JSON.stringify({ error: tokErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tokenRow) {
      return new Response(JSON.stringify({ connected: false, activities: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken: string = tokenRow.access_token;
    const expiresAt = new Date(tokenRow.expires_at).getTime();

    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: tokenRow.refresh_token,
        }),
      });
      const refreshed = await refreshRes.json();
      if (!refreshRes.ok || !refreshed.access_token) {
        console.error("Strava refresh failed:", refreshed);
        return new Response(JSON.stringify({ error: "Token refresh failed", details: refreshed }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      await withSchemaRetry(admin, () =>
        admin
          .from("strava_tokens")
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
          })
          .eq("user_id", userId),
      );
    }

    // First-ever sync backfills from the season start (April 1). Subsequent syncs use a
    // rolling 60-day window so the response stays small and recent activities are covered.
    const isFirstSync = !tokenRow.last_synced_at;
    let after: number;
    if (isFirstSync) {
      const now = new Date();
      const year = now.getUTCMonth() < 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
      after = Math.floor(Date.UTC(year, 3, 1, 0, 0, 0) / 1000);
    } else {
      after = Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000);
    }
    const perPage = 100;
    const maxPages = isFirstSync ? 50 : 10;
    const activities: StravaActivity[] = [];
    const seenIds = new Set<number>();

    for (let page = 1; page <= maxPages; page += 1) {
      const actRes = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=${perPage}&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const pageRaw = await actRes.json();
      if (!actRes.ok) {
        console.error("Strava activities error:", { page, pageRaw });
        return new Response(JSON.stringify({ error: "Failed to fetch activities", details: pageRaw }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pageItems = pageRaw as StravaActivity[];
      if (!Array.isArray(pageItems) || pageItems.length === 0) break;
      for (const item of pageItems) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          activities.push(item);
        }
      }
      console.log("strava-sync page fetched", { page, count: pageItems.length, total: activities.length });
      if (pageItems.length < perPage) break;
    }

    // Fetch HR + time streams for activities with heartrate. Sequential to respect Strava rate limits.
    for (const a of activities) {
      if (!a.has_heartrate) continue;
      try {
        const sRes = await fetch(
          `https://www.strava.com/api/v3/activities/${a.id}/streams?keys=heartrate,time,moving&key_by_type=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (sRes.status === 429) {
          console.warn("Strava 429 on streams, skipping rest");
          break;
        }
        if (!sRes.ok) continue;
        const stream = await sRes.json();
        const hr = stream?.heartrate?.data;
        const t = stream?.time?.data;
        const mv = stream?.moving?.data;
        if (Array.isArray(hr) && Array.isArray(t)) {
          a.heartrate_stream = hr;
          a.time_stream = t;
          if (Array.isArray(mv)) a.moving_stream = mv;
        }
      } catch (e) {
        console.warn("stream fetch failed", a.id, e);
      }
    }

    await withSchemaRetry(admin, () =>
      admin.from("strava_tokens").update({ last_synced_at: new Date().toISOString() }).eq("user_id", userId),
    );

    return new Response(
      JSON.stringify({ connected: true, activities }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("strava-sync error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
