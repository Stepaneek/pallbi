import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLIENT_ID = "232420";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!clientSecret) return json({ error: "Server not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Not authenticated" }, 401);
    const userId = claimsData.claims.sub as string;

    const { athlete_id, activity_id } = await req.json() as { athlete_id?: string; activity_id?: string };
    if (!athlete_id || !activity_id) return json({ error: "Missing parameters" }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (athlete_id !== userId) {
      const { data: link } = await admin
        .from("coach_athlete_links")
        .select("coach_id")
        .eq("coach_id", userId)
        .eq("athlete_id", athlete_id)
        .maybeSingle();
      if (!link) return json({ error: "Forbidden" }, 403);
    }

    const { data: tokenRow, error: tokErr } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("user_id", athlete_id)
      .maybeSingle();
    if (tokErr) return json({ error: tokErr.message }, 500);
    if (!tokenRow) return json({ connected: false }, 200);

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
      if (!refreshRes.ok || !refreshed.access_token) return json({ error: "Token refresh failed" }, 400);
      accessToken = refreshed.access_token;
      await admin
        .from("strava_tokens")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
        })
        .eq("user_id", athlete_id);
    }

    const sRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activity_id}/streams?keys=heartrate,time&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!sRes.ok) {
      const txt = await sRes.text();
      return json({ error: "Strava error", details: txt }, sRes.status);
    }
    const stream = await sRes.json();
    const heartrate = stream?.heartrate?.data ?? null;
    const time = stream?.time?.data ?? null;
    return json({ heartrate, time });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
