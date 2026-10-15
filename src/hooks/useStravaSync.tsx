import { useState, useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";
import { publicDb, waitForAuthSession, withSchemaRetry } from "@/lib/db";
import { stravaToSport } from "@/lib/sports";
import type { Zone } from "@/lib/zones";

const LAST_SYNC_KEY = "biathlon.lastStravaSync";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
  heartrate_stream?: number[] | null;
  time_stream?: number[] | null;
  moving_stream?: boolean[] | null;
}

type Slot = "rano" | "dopoledne" | "odpoledne";
const slotForHour = (h: number): Slot => (h < 12 ? "dopoledne" : "odpoledne");

const parseLocalIso = (iso: string) => {
  const date = iso.slice(0, 10);
  const hour = Number(iso.slice(11, 13));
  return { date, hour: Number.isFinite(hour) ? hour : NaN };
};

const praguePartsFromUtc = (iso: string) => {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const hourRaw = Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: hourRaw === 24 ? 0 : hourRaw,
  };
};

interface HrThresholds {
  vol?: number | null;
  i1: number; i2: number; i3: number; i4: number; i5: number;
}

const classifyZone = (hr: number, t: HrThresholds): Zone => {
  if (t.vol != null && hr <= t.vol) return "VOLNA";
  if (hr <= t.i1) return "I1";
  if (hr <= t.i2) return "I2";
  if (hr <= t.i3) return "I3";
  if (hr <= t.i4) return "I4";
  if (hr <= t.i5) return "I5";
  return "I6";
};

interface SegmentTotals {
  durationSec: number;
  hrSum: number;
  hrCount: number;
}

/** Splits an activity into one bucket per zone using HR/time streams. */
const segmentByHr = (
  hr: number[],
  t: number[],
  th: HrThresholds,
  moving?: boolean[] | null,
): Map<Zone, SegmentTotals> => {
  const out = new Map<Zone, SegmentTotals>();
  const n = Math.min(hr.length, t.length);
  for (let i = 0; i < n; i += 1) {
    const h = hr[i];
    if (!Number.isFinite(h) || h <= 0) continue;
    const rawDt = i + 1 < n ? Math.max(0, t[i + 1] - t[i]) : 0;
    const isMoving = moving ? moving[i] !== false : true;
    const dt = isMoving ? rawDt : 0;
    const z = classifyZone(h, th);
    const bucket = out.get(z) ?? { durationSec: 0, hrSum: 0, hrCount: 0 };
    bucket.durationSec += dt;
    bucket.hrSum += h;
    bucket.hrCount += 1;
    out.set(z, bucket);
  }
  return out;
};

export type SyncStatus = "idle" | "syncing" | "ok" | "error" | "not_connected";

export function useStravaSync(athleteId: string | undefined, onChange?: () => void) {
  const [status, setStatus] = useState<SyncStatus>("idle");

  const sync = useCallback(async (force = false): Promise<SyncStatus> => {
    if (!athleteId) return "idle";

    if (!force) {
      const last = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
      if (Date.now() - last < SYNC_INTERVAL_MS) return "idle";
    }

    setStatus("syncing");
    try {
      const session = await waitForAuthSession();
      if (!session?.access_token) { setStatus("idle"); return "idle"; }

      const { data, error } = await supabase.functions.invoke("strava-sync", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        console.warn("Strava sync error:", error);
        setStatus("error"); return "error";
      }
      if (!data?.connected) { setStatus("not_connected"); return "not_connected"; }

      const activities: StravaActivity[] = data.activities || [];
      if (activities.length === 0) {
        localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
        setStatus("ok"); return "ok";
      }

      // Load HR thresholds from profile
      const { data: prof } = await withSchemaRetry(() =>
        publicDb
          .from("profiles")
          .select("hr_i1_max,hr_i2_max,hr_i3_max,hr_i4_max,hr_i5_max,max_hr_free,use_bike_hr_zones,bike_hr_i1_max,bike_hr_i2_max,bike_hr_i3_max,bike_hr_i4_max,bike_hr_i5_max,bike_max_hr_free")
          .eq("id", athleteId)
          .maybeSingle(),
      );
      const p = prof as Record<string, number | boolean | null> | null;
      const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
      const build = (prefix: "" | "bike_"): HrThresholds | null => {
        const free = num(p?.[prefix === "" ? "max_hr_free" : "bike_max_hr_free"]);
        const i = [1, 2, 3, 4, 5].map((n) => num(p?.[`${prefix}hr_i${n}_max`]));
        if (i.some((v) => v == null)) return null;
        return { vol: free, i1: i[0]!, i2: i[1]!, i3: i[2]!, i4: i[3]!, i5: i[4]! };
      };
      const th = build("");
      const bikeTh = p?.use_bike_hr_zones === true ? build("bike_") : null;

      const ZONE_ORDER: Zone[] = ["VOLNA", "I1", "I2", "I3", "I4", "I5", "I6"];
      type Segment = { zone: Zone; duration_minutes: number; avg_heart_rate: number | null; distance_km: number | null };
      type Row = {
        athlete_id: string;
        block_date: string;
        slot: Slot;
        plan_or_real: "real";
        sport: ReturnType<typeof stravaToSport>;
        zone: Zone;
        duration_minutes: number;
        distance_km: number | null;
        avg_heart_rate: number | null;
        notes: string;
        strava_activity_id: string;
        segments: Segment[];
      };

      const rows: Row[] = [];

      for (const a of activities) {
        let local: { date: string; hour: number } | null = null;
        if (a.start_date_local) {
          const p = parseLocalIso(a.start_date_local);
          if (Number.isFinite(p.hour)) local = p;
        }
        if (!local) local = praguePartsFromUtc(a.start_date);

        const base = {
          athlete_id: athleteId,
          block_date: local.date,
          slot: slotForHour(local.hour),
          plan_or_real: "real" as const,
          sport: stravaToSport(a.sport_type || a.type),
        };
        const totalDistKm = a.distance ? Number((a.distance / 1000).toFixed(2)) : null;
        const movingMin = Math.round(a.moving_time / 60);
        const avgHr = a.average_heartrate ? Math.round(a.average_heartrate) : null;

        const hr = a.heartrate_stream ?? null;
        const tm = a.time_stream ?? null;

        let segments: Segment[] = [];
        let dominantZone: Zone = "VOLNA";

        // Cycling activities use dedicated bike thresholds when enabled in the profile.
        const activeTh = base.sport === "kolo" && bikeTh ? bikeTh : th;

        if (activeTh && hr && tm && hr.length > 1 && tm.length > 1 && movingMin > 0) {
          // Segment by HR using moving stream when available. Regardless of stream
          // accuracy, total segment minutes are normalized to Strava's moving_time
          // so "Celkem" never falls back to elapsed time (e.g. swims with pauses).
          const buckets = segmentByHr(hr, tm, activeTh, a.moving_stream ?? null);
          let totalSec = Array.from(buckets.values()).reduce((s, b) => s + b.durationSec, 0);
          // Fallback: if moving filter zeroed everything (no moving stream + all stationary),
          // use HR sample counts as proxy for distribution.
          let useCountFallback = totalSec <= 0;
          if (useCountFallback) {
            totalSec = Array.from(buckets.values()).reduce((s, b) => s + b.hrCount, 0);
          }
          if (totalSec > 0) {
            const raw: { zone: Zone; ratio: number; avgHr: number | null }[] = [];
            for (const z of ZONE_ORDER) {
              const b = buckets.get(z);
              if (!b) continue;
              const part = useCountFallback ? b.hrCount : b.durationSec;
              if (part <= 0) continue;
              raw.push({
                zone: z,
                ratio: part / totalSec,
                avgHr: b.hrCount > 0 ? Math.round(b.hrSum / b.hrCount) : null,
              });
            }
            // Allocate movingMin across zones with largest-remainder rounding so sum == movingMin.
            const allocations = raw.map((r) => ({ ...r, exact: r.ratio * movingMin }));
            const floors = allocations.map((r) => ({ ...r, mins: Math.floor(r.exact), frac: r.exact - Math.floor(r.exact) }));
            let assigned = floors.reduce((s, r) => s + r.mins, 0);
            let remaining = movingMin - assigned;
            const order = [...floors].sort((a, b) => b.frac - a.frac);
            for (const item of order) {
              if (remaining <= 0) break;
              item.mins += 1;
              remaining -= 1;
            }
            for (const item of floors) {
              if (item.mins <= 0) continue;
              segments.push({
                zone: item.zone,
                duration_minutes: item.mins,
                avg_heart_rate: item.avgHr,
                distance_km: totalDistKm != null ? Number((totalDistKm * item.ratio).toFixed(2)) : null,
              });
            }
            if (segments.length > 0) {
              dominantZone = segments.reduce((best, s) => s.duration_minutes > best.duration_minutes ? s : best).zone;
            }
          }
        }

        const totalMin = segments.length > 0
          ? segments.reduce((s, x) => s + x.duration_minutes, 0)
          : movingMin;

        rows.push({
          ...base,
          zone: dominantZone,
          duration_minutes: totalMin,
          distance_km: totalDistKm,
          avg_heart_rate: avgHr,
          notes: a.name ? `Strava: ${a.name}` : "Strava import",
          strava_activity_id: String(a.id),
          segments,
        });
      }

      if (rows.length > 0) {
        // Match existing blocks by activity id (also catches legacy "<id>#zone" rows for cleanup).
        const activityIds = activities.map((a) => String(a.id));
        const orFilter = activityIds
          .map((id) => `strava_activity_id.eq.${id},strava_activity_id.like.${id}#%`)
          .join(",");
        const { data: existing, error: existingErr } = await withSchemaRetry(() =>
          publicDb
            .from("training_blocks")
            .select("id,strava_activity_id")
            .eq("athlete_id", athleteId)
            .or(orFilter),
        );
        if (existingErr) {
          console.warn("Strava existing lookup error:", existingErr);
          setStatus("error"); return "error";
        }

        // Map id -> existing block id (only the canonical "<id>" key). Legacy "<id>#zone" rows get deleted.
        const existingByKey = new Map<string, string>();
        const toDelete: string[] = [];
        for (const b of existing ?? []) {
          if (b.strava_activity_id && b.strava_activity_id.includes("#")) {
            toDelete.push(b.id);
          } else if (b.strava_activity_id) {
            existingByKey.set(b.strava_activity_id, b.id);
          }
        }
        if (toDelete.length > 0) {
          const { error: delErr } = await withSchemaRetry(() =>
            publicDb.from("training_blocks").delete().in("id", toDelete).eq("athlete_id", athleteId),
          );
          if (delErr) {
            console.warn("Strava delete legacy error:", delErr);
            setStatus("error"); return "error";
          }
        }

        const rowsToInsert = rows.filter((r) => !existingByKey.has(r.strava_activity_id));
        const rowsToUpdate = rows
          .map((r) => ({ id: existingByKey.get(r.strava_activity_id), row: r }))
          .filter((it): it is { id: string; row: Row } => Boolean(it.id));

        if (rowsToInsert.length > 0) {
          const { error: insErr } = await withSchemaRetry(() =>
            publicDb.from("training_blocks").insert(rowsToInsert),
          );
          if (insErr) {
            console.warn("Strava insert error:", insErr);
            setStatus("error"); return "error";
          }
        }

        for (const { id, row } of rowsToUpdate) {
          const { error: updErr } = await withSchemaRetry(() =>
            publicDb.from("training_blocks").update(row).eq("id", id).eq("athlete_id", athleteId),
          );
          if (updErr) {
            console.warn("Strava update error:", updErr);
            setStatus("error"); return "error";
          }
        }

        onChange?.();
      }

      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      setStatus("ok");
      return "ok";
    } catch (e) {
      console.warn("Strava sync exception:", e);
      setStatus("error");
      return "error";
    }
  }, [athleteId, onChange]);

  // Auto-sync disabled — Strava sync only runs when explicitly triggered
  // (e.g. manual button), capped at once per 24h via SYNC_INTERVAL_MS.

  return { status, sync };
}
