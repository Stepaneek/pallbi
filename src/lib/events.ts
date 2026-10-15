import { supabase } from "@/integrations/supabase/client";

export type EventType = "zavod" | "soustredeni" | "volno" | "ostatni";

export type CalEvent = {
  id: string;
  athlete_id: string;
  event_type: EventType;
  title: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
};

const LEGACY_KEY = "pallbi_events";
const MIGRATED_FLAG = "pallbi_events_migrated_v1";

/**
 * One-shot migration of legacy localStorage events into Supabase. Safe to call
 * multiple times — it no-ops after the first successful migration.
 */
export async function migrateLegacyEventsToSupabase(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return 0;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      return 0;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.setItem(MIGRATED_FLAG, "1");
      return 0;
    }
    const rows = parsed
      .filter((e: any) => e && e.title && e.start_date && e.end_date && e.event_type)
      .map((e: any) => ({
        athlete_id: userId,
        event_type: e.event_type,
        title: String(e.title),
        start_date: e.start_date,
        end_date: e.end_date,
      }));
    if (rows.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.setItem(MIGRATED_FLAG, "1");
      return 0;
    }
    const { error } = await supabase.from("events").insert(rows);
    if (error) {
      console.error("Event migration failed", error);
      return 0;
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(MIGRATED_FLAG, "1");
    return rows.length;
  } catch (e) {
    console.error("Event migration exception", e);
    return 0;
  }
}

export async function fetchEvents(athleteId: string): Promise<CalEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, athlete_id, event_type, title, start_date, end_date, notes")
    .eq("athlete_id", athleteId)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalEvent[];
}
