import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useAthleteGroups } from "@/hooks/useAthleteGroups";
import BulkPlanDialog from "@/components/team/BulkPlanDialog";
import { publicDb } from "@/lib/db";
import { ClickHint } from "@/components/ui/info-popover";
import { MetaData, ensureArr } from "@/hooks/useWeeklyMeta";
import { computeReadiness, morningHrBaseline, READINESS_BADGE, ReadinessLevel } from "@/lib/readiness";
import { Database } from "@/integrations/supabase/types";
import { isoDate, isoYearWeek, nextWeek, prevWeek, seasonWeek, weekDays, weekRange } from "@/lib/week";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

const minutesOf = (b: Block): number => {
  const raw = (b as unknown as { segments?: unknown }).segments;
  if (Array.isArray(raw) && raw.length) {
    const sum = (raw as { duration_minutes?: number }[]).reduce((a, s) => a + (Number(s?.duration_minutes) || 0), 0);
    if (sum > 0) return sum;
  }
  return b.duration_minutes || 0;
};

export default function Team() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCoach, athletes, setViewingAthleteId, loading: roleLoading } = useRole();
  const {
    groups, members, createGroup, deleteGroup, toggleMember, athleteIdsInGroup,
  } = useAthleteGroups(user?.id, isCoach);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [newGroup, setNewGroup] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);

  const { start } = useMemo(() => weekRange(anchor), [anchor]);
  const days = useMemo(() => weekDays(start), [start]);
  const ids = useMemo(() => athletes.map((a) => a.id), [athletes]);

  useEffect(() => {
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await publicDb
        .from("training_blocks")
        .select("*")
        .in("athlete_id", ids)
        .gte("block_date", isoDate(days[0]))
        .lte("block_date", isoDate(days[6]));
      if (cancelled) return;
      setBlocks((data ?? []) as Block[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ids.join(","), start.getTime(), reloadKey]);

  // Weekly meta (morning HR + subjective ratings) for readiness badges
  const [metaByAthlete, setMetaByAthlete] = useState<Record<string, MetaData>>({});
  useEffect(() => {
    if (!ids.length) return;
    let cancelled = false;
    const { iso_year, iso_week } = isoYearWeek(start);
    (async () => {
      const { data } = await publicDb
        .from("weekly_meta")
        .select("athlete_id,data")
        .in("athlete_id", ids)
        .eq("iso_year", iso_year)
        .eq("iso_week", iso_week)
        .eq("plan_or_real", "real");
      if (cancelled) return;
      const map: Record<string, MetaData> = {};
      (data ?? []).forEach((r) => {
        map[(r as { athlete_id: string }).athlete_id] = ((r as { data: unknown }).data as MetaData) || {};
      });
      setMetaByAthlete(map);
    })();
    return () => { cancelled = true; };
  }, [ids.join(","), start.getTime(), reloadKey]);

  const coachedAthletes = useMemo(
    () => athletes.filter((a) => a.id !== user?.id),
    [athletes, user?.id],
  );

  const visibleAthletes = useMemo(() => {
    if (groupFilter === "all") return athletes;
    if (groupFilter === "none") {
      const assigned = new Set(members.map((m) => m.athlete_id));
      return athletes.filter((a) => !assigned.has(a.id));
    }
    const ids = new Set(athleteIdsInGroup(groupFilter));
    return athletes.filter((a) => ids.has(a.id));
  }, [athletes, groupFilter, members, athleteIdsInGroup]);

  const todayIso = isoDate(new Date());
  const dayIndex = useMemo(() => {
    const i = days.findIndex((d) => isoDate(d) === todayIso);
    return i >= 0 ? i : 6;
  }, [days, todayIso]);

  const rows = useMemo(() => {
    return visibleAthletes.map((a) => {
      const own = blocks.filter((b) => b.athlete_id === a.id && b.sport !== "strelba");
      const planMin = own.filter((b) => b.plan_or_real === "plan").reduce((s, b) => s + minutesOf(b), 0);
      const realMin = own.filter((b) => b.plan_or_real === "real").reduce((s, b) => s + minutesOf(b), 0);
      const realKm = own
        .filter((b) => b.plan_or_real === "real")
        .reduce((s, b) => s + (Number(b.distance_km) || 0), 0);
      const sessions = own.filter((b) => b.plan_or_real === "real").length;
      const plannedSessions = own.filter((b) => b.plan_or_real === "plan").length;
      const doneDays = new Set(
        own.filter((b) => b.plan_or_real === "real").map((b) => b.block_date),
      );
      const pct = planMin > 0 ? Math.round((realMin / planMin) * 100) : null;

      const meta = metaByAthlete[a.id] ?? {};
      const hr = ensureArr(meta.MORNING_HR);
      const sleepArr = ensureArr(meta.SLEEP);
      const fatigueArr = ensureArr(meta.FATIGUE);
      const sorenessArr = ensureArr(meta.SORENESS);
      // pick the requested day, otherwise the latest day with any input
      let idx = dayIndex;
      const filled = (i: number) => hr[i] || sleepArr[i] || fatigueArr[i] || sorenessArr[i];
      if (!filled(idx)) {
        for (let i = 6; i >= 0; i--) if (filled(i)) { idx = i; break; }
      }
      const readiness = computeReadiness({
        morningHr: hr[idx] || undefined,
        baselineHr: morningHrBaseline(hr),
        sleep: sleepArr[idx] || undefined,
        fatigue: fatigueArr[idx] || undefined,
        soreness: sorenessArr[idx] || undefined,
      });
      const readinessDetail = {
        dayIndex: idx,
        morningHr: hr[idx] || undefined,
        sleep: sleepArr[idx] || undefined,
        fatigue: fatigueArr[idx] || undefined,
        soreness: sorenessArr[idx] || undefined,
      };

      return { athlete: a, planMin, realMin, realKm, sessions, plannedSessions, doneDays, pct, readiness, readinessDetail };
    });
  }, [visibleAthletes, blocks, metaByAthlete, dayIndex]);

  if (roleLoading) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;

  if (!isCoach) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("team.coachOnly")}</p>
      </Card>
    );
  }

  const h = (min: number) => (min / 60).toFixed(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Users className="h-5 w-5" /> {t("team.title")}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(prevWeek(anchor))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center text-sm font-semibold">
            {t("week.header", {
              n: seasonWeek(anchor),
              range: `${format(days[0], "d.M.")} – ${format(days[6], "d.M.yyyy")}`,
            })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(nextWeek(anchor))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>{t("common.today")}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={groupFilter === "all" ? "default" : "outline"} onClick={() => setGroupFilter("all")}>
          {t("groups.all")}
        </Button>
        {groups.map((g) => (
          <Button key={g.id} size="sm" variant={groupFilter === g.id ? "default" : "outline"} onClick={() => setGroupFilter(g.id)}>
            {g.name}
          </Button>
        ))}
        <Button size="sm" variant={groupFilter === "none" ? "default" : "outline"} onClick={() => setGroupFilter("none")}>
          {t("groups.noGroup")}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setManageOpen((v) => !v)}>{t("groups.manage")}</Button>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("bulk.button")}
          </Button>
        </div>
      </div>

      {manageOpen && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex gap-2">
              <Input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder={t("groups.newPlaceholder")}
              />
              <Button
                onClick={async () => { await createGroup(newGroup); setNewGroup(""); }}
                disabled={!newGroup.trim()}
              >
                {t("groups.add")}
              </Button>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("groups.empty")}</p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{g.name}</p>
                    <Button size="icon" variant="ghost" aria-label={t("groups.delete")} onClick={() => deleteGroup(g.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {coachedAthletes.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t("common.noAthletes")}</p>
                    )}
                    {coachedAthletes.map((a) => {
                      const inGroup = members.some((m) => m.group_id === g.id && m.athlete_id === a.id);
                      return (
                        <Button
                          key={a.id}
                          size="sm"
                          variant={inGroup ? "default" : "outline"}
                          onClick={() => toggleMember(g.id, a.id)}
                        >
                          {a.name ?? "—"}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <BulkPlanDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        athletes={coachedAthletes}
        groups={groups}
        athleteIdsInGroup={athleteIdsInGroup}
        defaultDate={isoDate(days[0])}
        onSaved={() => setReloadKey((k) => k + 1)}
      />

      {loading && rows.length === 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("common.noAthletes")}
          actionLabel={t("week.manageInvites")}
          onAction={() => navigate("/profile")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.athlete.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.athlete.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("team.sessions", { done: r.sessions, planned: r.plannedSessions })}
                    </p>
                    <div className="mt-2">
                      {r.readiness ? (
                        <ClickHint
                          contentClassName="space-y-1"
                          trigger={
                            <span
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${READINESS_BADGE[r.readiness.level as ReadinessLevel]}`}
                            >
                              <span className="text-[13px] leading-none">
                                {r.readiness.level === "ok" ? "🟢" : r.readiness.level === "warn" ? "🟠" : "🔴"}
                              </span>
                              {t(`readiness.level.${r.readiness.level}`)}
                              <span className="opacity-70">· {r.readiness.score}</span>
                            </span>
                          }
                        >
                          <p className="font-semibold">
                            {t("readiness.title")} · {t(`days.short.${r.readinessDetail.dayIndex}`)}
                          </p>
                          <p>{t("readiness.sleep")}: {r.readinessDetail.sleep ? `${r.readinessDetail.sleep}/5` : "—"}</p>
                          <p>{t("readiness.fatigue")}: {r.readinessDetail.fatigue ? `${r.readinessDetail.fatigue}/5` : "—"}</p>
                          <p>{t("readiness.soreness")}: {r.readinessDetail.soreness ? `${r.readinessDetail.soreness}/5` : "—"}</p>
                          <p>{t("meta.morningHr", "Ranní tep")}: {r.readinessDetail.morningHr || "—"}</p>
                          {r.readiness.hrOnly && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("readiness.hrOnlyNote")}</p>
                          )}
                        </ClickHint>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{t("readiness.noData")}</span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewingAthleteId(r.athlete.id);
                      navigate(`/?d=${isoDate(days[0])}`);
                    }}
                  >
                    {t("team.openDiary")}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label={t("team.planned")} value={`${h(r.planMin)} h`} />
                  <Stat label={t("team.actual")} value={`${h(r.realMin)} h`} />
                  <Stat label={t("team.completion")} value={r.pct === null ? "—" : `${r.pct} %`} />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{t("team.weekProgress")}</span>
                    <span>{r.realKm ? `${r.realKm.toFixed(1)} km` : ""}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        r.pct === null ? "bg-primary/40" : r.pct >= 90 ? "bg-lime-500" : r.pct >= 60 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          r.pct ??
                            (r.plannedSessions > 0
                              ? Math.round((r.sessions / r.plannedSessions) * 100)
                              : r.realMin > 0
                                ? 100
                                : 0),
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {days.map((d, i) => {
                      const done = r.doneDays.has(isoDate(d));
                      return (
                        <div
                          key={i}
                          className={`rounded py-1 text-center text-[10px] font-semibold ${
                            done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t(`days.short.${i}`)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
