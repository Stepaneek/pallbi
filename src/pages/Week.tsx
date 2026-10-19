import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";

import { useTranslation } from "react-i18next";
import { format } from "date-fns";


import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AthleteBar from "@/components/AthleteBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { seasonWeek, weekRange, weekDays, isoDate, nextWeek, prevWeek, fromIso } from "@/lib/week";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyMeta, ensureArr } from "@/hooks/useWeeklyMeta";
import WeeklyTable from "@/components/biathlon/WeeklyTable";
import WeeklyPlanOverview from "@/components/biathlon/WeeklyPlanOverview";
import DailyDetail from "@/components/biathlon/DailyDetail";
import DayComments from "@/components/biathlon/DayComments";
import BlockEditor from "@/components/biathlon/BlockEditor";
import StravaBanner from "@/components/StravaBanner";
import { exportWeekPdf } from "@/lib/pdfExport";
import { computeReadiness, morningHrBaseline, READINESS_DOT } from "@/lib/readiness";
import { toast } from "sonner";



import { Database } from "@/integrations/supabase/types";


type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
type Slot = "rano" | "dopoledne" | "odpoledne";

// Module-level cache for week blocks. Survives navigation between routes so
// returning to the week (or switching tabs) doesn't re-hit the edge function.
type WeekCacheEntry = { blocks: Block[]; commentCounts: Record<string, number> };
const weekCache = new Map<string, WeekCacheEntry>();
const cacheKey = (athleteId: string, planOrReal: string, startIso: string) =>
  `${athleteId}|${planOrReal}|${startIso}`;
export const invalidateWeekCache = (athleteId?: string) => {
  if (!athleteId) { weekCache.clear(); return; }
  for (const k of Array.from(weekCache.keys())) {
    if (k.startsWith(`${athleteId}|`)) weekCache.delete(k);
  }
};

export default function Week() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isCoach, isAthlete, athletes, viewingAthleteId, setViewingAthleteId, loading: roleLoading, refresh: refreshRole } = useRole();
  const [params, setParams] = useSearchParams();

  // Parse week from URL or default to today
  const initialDate = params.get("d") ? fromIso(params.get("d")!) : new Date();
  const [anchor, setAnchor] = useState<Date>(initialDate);
  const { start } = useMemo(() => weekRange(anchor), [anchor]);
  const days = useMemo(() => weekDays(start), [start]);
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const today = new Date();
    return days.find((d) => isoDate(d) === isoDate(today)) ?? days[0];
  });

  const [planOrReal, setPlanOrReal] = useState<"plan" | "real">("real");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; event_type: string; title: string; start_date: string; end_date: string }>>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);


  const athleteId = viewingAthleteId;
  const canEdit = !!athleteId && !!user && (
    (isAthlete && user.id === athleteId) || // athlete edits own real
    (isCoach && planOrReal === "plan")       // coach edits plan
  );

  const { meta, setMetaCell } = useWeeklyMeta(athleteId, start, planOrReal, canEdit);
  const selectedDayIndex = Math.max(0, days.findIndex((d) => isoDate(d) === isoDate(selectedDay)));

  const readinessByDay = useMemo(() => {
    const hr = ensureArr(meta.MORNING_HR);
    const sleep = ensureArr(meta.SLEEP);
    const fatigue = ensureArr(meta.FATIGUE);
    const soreness = ensureArr(meta.SORENESS);
    const baselineHr = morningHrBaseline(hr);
    return [0, 1, 2, 3, 4, 5, 6].map((i) =>
      computeReadiness({
        morningHr: hr[i] || undefined,
        baselineHr,
        sleep: sleep[i] || undefined,
        fatigue: fatigue[i] || undefined,
        soreness: soreness[i] || undefined,
      }),
    );
  }, [meta]);

  // Persist anchor in URL
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("d", isoDate(anchor));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  // Reset selected day if outside week
  useEffect(() => {
    if (!days.find((d) => isoDate(d) === isoDate(selectedDay))) {
      setSelectedDay(days[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.getTime()]);

  // Load blocks for week (přes edge funkci, abychom obešli nestabilní REST vrstvu)
  // Cached at module level by athlete+plan/real+weekStart so revisiting a week
  // or switching back from another tab doesn't re-fetch.
  useEffect(() => {
    if (!athleteId) return;
    let cancelled = false;
    const startIso = isoDate(days[0]);
    const endIso = isoDate(days[6]);
    const key = cacheKey(athleteId, planOrReal, startIso);
    const cached = reloadKey === 0 ? weekCache.get(key) : undefined;
    if (cached) {
      setBlocks(cached.blocks);
      setCommentCounts(cached.commentCounts);
      setLoadError(null);
      return;
    }
    (async () => {
      setLoadError(null);
      setBlocksLoading(true);
      const { data, error } = await supabase.functions.invoke("training-week-load", {
        body: { athlete_id: athleteId, plan_or_real: planOrReal, start: startIso, end: endIso },
      });
      if (cancelled) return;
      const payload = data as { blocks?: Block[]; commentCounts?: Record<string, number>; error?: string } | null;
      if (error || payload?.error) {
        setLoadError(payload?.error || error?.message || t("diary.trainingsLoadFailed"));
        setBlocksLoading(false);
        return;
      }
      const entry: WeekCacheEntry = {
        blocks: payload?.blocks ?? [],
        commentCounts: payload?.commentCounts ?? {},
      };
      weekCache.set(key, entry);
      setBlocks(entry.blocks);
      setCommentCounts(entry.commentCounts);
      setBlocksLoading(false);
    })();
    return () => { cancelled = true; };
  }, [athleteId, planOrReal, start.getTime(), reloadKey]);

  // Load events for the currently viewed athlete from Supabase.
  useEffect(() => {
    let cancelled = false;
    if (!athleteId) { setEvents([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, event_type, title, start_date, end_date")
        .eq("athlete_id", athleteId);
      if (cancelled) return;
      if (error) { setEvents([]); return; }
      setEvents((data ?? []) as typeof events);
    })();
    return () => { cancelled = true; };
  }, [athleteId, start.getTime(), reloadKey]);

  const eventForDay = useCallback((d: Date) => {
    const iso = isoDate(d);
    return events.find((e) => e.start_date <= iso && e.end_date >= iso) ?? null;
  }, [events]);

  const upsertLocalBlock = useCallback((block: Block) => {
    setBlocks((current) => {
      const without = current.filter((item) => item.id !== block.id);
      const next = [...without, block].sort((a, b) => `${a.block_date}-${a.slot}`.localeCompare(`${b.block_date}-${b.slot}`));
      if (athleteId) {
        const key = cacheKey(athleteId, planOrReal, isoDate(days[0]));
        const prev = weekCache.get(key);
        weekCache.set(key, { blocks: next, commentCounts: prev?.commentCounts ?? {} });
      }
      return next;
    });
  }, [athleteId, planOrReal, days]);

  const deleteLocalBlock = useCallback((id: string) => {
    setBlocks((current) => {
      const next = current.filter((item) => item.id !== id);
      if (athleteId) {
        const key = cacheKey(athleteId, planOrReal, isoDate(days[0]));
        const prev = weekCache.get(key);
        weekCache.set(key, { blocks: next, commentCounts: prev?.commentCounts ?? {} });
      }
      return next;
    });
  }, [athleteId, planOrReal, days]);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);

  const [editorSlot, setEditorSlot] = useState<Slot>("dopoledne");
  const [editorBlock, setEditorBlock] = useState<Block | null>(null);

  const openAdd = (slot: Slot) => {
    setEditorSlot(slot);
    setEditorBlock(null);
    setEditorOpen(true);
  };
  const openExisting = (b: Block) => {
    setEditorSlot(b.slot as Slot);
    setEditorBlock(b);
    setEditorOpen(true);
  };

  // Keyboard shortcuts: ← / → move by day (crossing weeks), N adds a new block.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || editorOpen) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = new Date(selectedDay);
        next.setDate(next.getDate() + (e.key === "ArrowRight" ? 1 : -1));
        setSelectedDay(next);
        if (!days.some((d) => isoDate(d) === isoDate(next))) setAnchor(next);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setAnchor(new Date());
        setSelectedDay(new Date());
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPlanOrReal((v) => (v === "plan" ? "real" : "plan"));
        return;
      }
      if (e.key === "n" || e.key === "N") {
        if (!canEdit) return;
        e.preventDefault();
        setEditorSlot("dopoledne");
        setEditorBlock(null);
        setEditorOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDay, days, editorOpen, canEdit]);

  if (roleLoading) {
    return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!athleteId) {
    // Coach without any linked athletes
    if (isCoach && !isAthlete) {
      return (
        <Card className="p-6 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            {t("common.noAthletes")}
          </p>
          <Button onClick={() => navigate("/profile")}>{t("week.manageInvites")}</Button>
        </Card>
      );
    }
    // Athlete (or unknown) — role data didn't fully resolve
    return (
      <Card className="p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          {t("diary.loadFailedRetry")}
        </p>
        <Button onClick={() => refreshRole()}>{t("diary.tryAgain")}</Button>
      </Card>
    );
  }

  const dayBlocks = blocks.filter((b) => b.block_date === isoDate(selectedDay));

  const loadBlocksFor = async (mode: "plan" | "real"): Promise<Block[]> => {
    if (mode === planOrReal) return blocks;
    const startIso = isoDate(days[0]);
    const key = cacheKey(athleteId, mode, startIso);
    const cached = weekCache.get(key);
    if (cached) return cached.blocks;
    const { data } = await supabase.functions.invoke("training-week-load", {
      body: { athlete_id: athleteId, plan_or_real: mode, start: startIso, end: isoDate(days[6]) },
    });
    const loaded = (data as { blocks?: Block[] } | null)?.blocks ?? [];
    weekCache.set(key, { blocks: loaded, commentCounts: {} });
    return loaded;
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const [realBlocks, planBlocks] = await Promise.all([loadBlocksFor("real"), loadBlocksFor("plan")]);
      await exportWeekPdf({
        athleteName: athletes.find((a) => a.id === athleteId)?.name ?? "",
        weekTitle: t("week.header", {
          n: seasonWeek(anchor),
          range: `${format(days[0], "d.M.")} – ${format(days[6], "d.M.yyyy")}`,
        }),
        subtitle: planOrReal === "plan" ? t("common.plan") : t("common.real"),
        days,
        dayLabels: days.map((d, i) => `${t(`days.short.${i}`)} ${d.getDate()}.`),
        blocks: realBlocks,
        planBlocks,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };



  return (
    <div className="space-y-4">


      {/* Top toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-2 sm:w-auto">

          <Button variant="outline" size="icon" onClick={() => setAnchor(prevWeek(anchor))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 text-center sm:min-w-[240px] sm:flex-none">
            <p className="text-sm leading-tight font-bold sm:text-base">

              {t("week.header", {
                n: seasonWeek(anchor),
                range: `${format(days[0], "d.M.")} – ${format(days[6], "d.M.yyyy")}`,
              })}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(nextWeek(anchor))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setAnchor(new Date()); setSelectedDay(new Date()); }}>{t("common.today")}</Button>
          <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground 2xl:inline">{t("week.shortcutsHint")}</span>
        </div>


        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting} className="flex-1 justify-center sm:flex-none">

            <FileDown className="mr-1.5 h-4 w-4" />
            {t("common.exportPdf")}
          </Button>


          <div className="inline-flex w-full items-center gap-1 rounded-xl border border-border/60 bg-muted p-1 shadow-sm sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPlanOrReal("plan")}
              className={`h-7 flex-1 rounded-lg px-3.5 text-xs sm:flex-none ${

                planOrReal === "plan"
                  ? "btn-primary text-primary-foreground hover:text-primary-foreground"
                   : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {t("common.plan")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPlanOrReal("real")}
               className={`h-7 flex-1 rounded-lg px-3.5 text-xs sm:flex-none ${
                planOrReal === "real"
                  ? "btn-primary text-primary-foreground hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {t("common.real")}
            </Button>
          </div>
        </div>
      </div>


      {/* Strava connect banner */}
      <StravaBanner />

      {/* Day picker strip */}
      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{t("week.loadFailed")}</p>
          <p className="mt-1 text-xs">{loadError}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {dbTestResult && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          {dbTestResult}
        </div>
      )}

      <div className="space-y-4 rounded-lg p-2">

      <div className="grid grid-cols-7 gap-1">

        {days.map((d, di) => {
          const isSel = isoDate(d) === isoDate(selectedDay);
          const isToday = isoDate(d) === isoDate(new Date());
          const dayBlks = blocks.filter((b) => b.block_date === isoDate(d));
          const rd = readinessByDay[di];
          const ev = eventForDay(d);
          const evIcon =
            ev?.event_type === "zavod" ? "🏁" :
            ev?.event_type === "soustredeni" ? "🏕️" :
            ev?.event_type === "volno" ? "🌿" :
            ev?.event_type === "ostatni" ? "📌" : "";
          return (
            <button
              key={isoDate(d)}
              onClick={() => setSelectedDay(d)}
              className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-xs shadow-sm transition-colors ${
                isSel
                  ? "border-primary bg-primary text-primary-foreground"
                  : isToday
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40 hover:border-primary"
                    : "bg-card hover:border-primary/30 hover:bg-accent/60"
              }`}
            >
              {rd ? (
                <span
                  title={`${t(`readiness.level.${rd.level}`)} · ${rd.score}`}
                  className={`h-1.5 w-full max-w-[28px] rounded-full ${READINESS_DOT[rd.level]}`}
                />
              ) : (
                <span className="h-1.5 w-full max-w-[28px] rounded-full bg-transparent" />
              )}
              <span className="text-[10px] uppercase">{t(`days.short.${(d.getDay()+6)%7}`)}</span>
              <span className="text-base font-bold">{d.getDate()}</span>
              {ev && <span className="mt-0.5 text-[11px] leading-none">{evIcon}</span>}
              {dayBlks.length > 0 && <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Two-panel layout */}
      {blocksLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(640px,3fr)]">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(640px,3fr)]">
        <div className="min-w-0 space-y-3 overflow-hidden">
          <DailyDetail
            date={selectedDay}
            blocks={dayBlocks}
            
            onAdd={openAdd}
            onOpen={openExisting}
            canEdit={canEdit}
            morningHr={ensureArr(meta.MORNING_HR)[selectedDayIndex] || 0}
            onMorningHrChange={(v) => setMetaCell("MORNING_HR", selectedDayIndex, v)}
            event={eventForDay(selectedDay)}
            sleep={ensureArr(meta.SLEEP)[selectedDayIndex] || 0}
            fatigue={ensureArr(meta.FATIGUE)[selectedDayIndex] || 0}
            soreness={ensureArr(meta.SORENESS)[selectedDayIndex] || 0}
            onReadinessChange={(k, v) => setMetaCell(k, selectedDayIndex, String(v))}
            readiness={readinessByDay[selectedDayIndex]}
            showMorningData={planOrReal === "real"}
          />
          <DayComments
            athleteId={athleteId}
            dateIso={isoDate(selectedDay)}
            authorNames={Object.fromEntries(athletes.map((a) => [a.id, a.name]))}
            canComment={!!user && !!athleteId && isCoach && athleteId !== user.id}
          />
        </div>
        {planOrReal === "plan" ? (
          <WeeklyPlanOverview
            days={days}
            blocks={blocks}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <WeeklyTable
            athleteId={athleteId}
            weekStart={start}
            planOrReal={planOrReal}
            blocks={blocks}
            canEdit={canEdit}
            meta={meta}
            setMetaCell={setMetaCell}
            selectedDayIndex={selectedDayIndex}
          />
        )}
      </div>
      )}
      </div>




      {athleteId && (
        <BlockEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          athleteId={athleteId}
          blockDate={isoDate(selectedDay)}
          slot={editorSlot}
          planOrReal={planOrReal}
          existing={editorBlock}
          canEdit={canEdit}
          onSaved={(block, message) => {
            upsertLocalBlock(block);
            setDbTestResult(message ?? null);
          }}
          onDeleted={(id) => {
            deleteLocalBlock(id);
            setDbTestResult(t("week.deleted"));
          }}
        />
      )}
    </div>
  );
}
