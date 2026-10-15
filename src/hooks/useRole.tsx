import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { publicDb } from "@/lib/db";
import { useAuth } from "./useAuth";

const SELECTED_ATHLETE_KEY = "selected_athlete_id";

export type Role = "athlete" | "coach";

type RoleCtx = {
  loading: boolean;
  isAthlete: boolean;
  isCoach: boolean;
  /** Athletes the current user (if coach) has access to. */
  athletes: { id: string; name: string | null }[];
  /** Athlete currently being viewed (own id for athlete; selected for coach). */
  viewingAthleteId: string | null;
  setViewingAthleteId: (id: string) => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<RoleCtx>({
  loading: true,
  isAthlete: false,
  isCoach: false,
  athletes: [],
  viewingAthleteId: null,
  setViewingAthleteId: () => {},
  refresh: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [athletes, setAthletes] = useState<{ id: string; name: string | null }[]>([]);
  const [viewingAthleteId, setViewingAthleteId] = useState<string | null>(null);

  const fetchRoles = async (uid: string): Promise<{ rs: Role[]; ok: boolean }> => {
    const { data, error } = await publicDb
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (error) {
      console.warn("[useRole] user_roles query failed:", error.message);
      return { rs: [], ok: false };
    }
    return { rs: (data ?? []).map((r) => r.role as Role), ok: true };
  };

  const load = async () => {
    if (!user) {
      setRoles([]);
      setAthletes([]);
      setViewingAthleteId(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Fetch roles with one retry on failure
    let { rs, ok } = await fetchRoles(user.id);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 400));
      ({ rs, ok } = await fetchRoles(user.id));
    }

    setRoles(rs);

    const isCoach = rs.includes("coach");
    const isAthlete = rs.includes("athlete");

    let list: { id: string; name: string | null }[] = [];
    if (isCoach) {
      const { data: links, error: linksErr } = await publicDb
        .from("coach_athlete_links")
        .select("athlete_id")
        .eq("coach_id", user.id);
      if (linksErr) console.warn("[useRole] coach_athlete_links failed:", linksErr.message);
      const ids = (links ?? []).map((l) => l.athlete_id);
      if (ids.length) {
        const { data: profs } = await publicDb
          .from("profiles")
          .select("id,name")
          .in("id", ids);
        list = profs ?? [];
      }
    }
    if (isAthlete) {
      const { data: me, error: meErr } = await publicDb
        .from("profiles")
        .select("id,name")
        .eq("id", user.id)
        .maybeSingle();
      if (meErr) console.warn("[useRole] profile load failed:", meErr.message);
      // Always include self even when profile row is missing — prevents stuck null id.
      const meRow = me ?? { id: user.id, name: null };
      list = [meRow, ...list.filter((a) => a.id !== meRow.id)];
    }
    setAthletes(list);
    setViewingAthleteId((cur) => {
      if (cur && list.some((a) => a.id === cur)) return cur;
      // Default to the user's own profile if available. The stored selection
      // is only respected when it matches the user's own ID; otherwise we
      // always fall back to self so coaches don't land on an athlete's diary.
      const stored = localStorage.getItem(SELECTED_ATHLETE_KEY);
      const selfInList = list.some((a) => a.id === user.id);
      if (selfInList && (!stored || stored !== user.id)) return user.id;
      if (stored && list.some((a) => a.id === stored)) return stored;
      return selfInList ? user.id : list[0]?.id ?? null;
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setViewingAthleteIdPersist = useCallback((id: string) => {
    localStorage.setItem(SELECTED_ATHLETE_KEY, id);
    setViewingAthleteId(id);
  }, []);

  const value = useMemo<RoleCtx>(
    () => ({
      loading,
      isAthlete: roles.includes("athlete"),
      isCoach: roles.includes("coach"),
      athletes,
      viewingAthleteId,
      setViewingAthleteId: setViewingAthleteIdPersist,
      refresh: load,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, roles, athletes, viewingAthleteId, setViewingAthleteIdPersist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRole = () => useContext(Ctx);
