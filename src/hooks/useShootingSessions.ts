import { useQuery } from "@tanstack/react-query";
import { publicDb } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";

type Session = Database["public"]["Tables"]["shooting_sessions"]["Row"];

export function useShootingSessions(athleteId: string | null | undefined, start: string, end: string) {
  return useQuery({
    queryKey: ["shooting-sessions", athleteId, "analytics", start, end],
    enabled: !!athleteId,
    queryFn: async () => {
      if (!athleteId) return [];
      const rows: Session[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await publicDb.from("shooting_sessions").select("*")
          .eq("athlete_id", athleteId).gte("session_date", start).lte("session_date", end)
          .order("session_date", { ascending: false }).order("id")
          .range(page * 500, page * 500 + 499);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) return rows;
      }
    },
  });
}