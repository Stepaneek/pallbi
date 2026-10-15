import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { weekHeader, weekRange, weekDays, isoDate, nextWeek, prevWeek, fromIso, isoYearWeek } from "@/lib/week";
import DailyDetail from "@/components/biathlon/DailyDetail";
import WeeklyTable from "@/components/biathlon/WeeklyTable";
import type { MetaData } from "@/hooks/useWeeklyMeta";
import { useTranslation } from "react-i18next";

const ADMIN_ID = "feee4b11-b3c3-4c77-bd8f-81a399633bf4";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
type EventRow = { id: string; event_type: string; title: string; start_date: string; end_date: string };

export default function AdminUserWeek() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const [params, setParams] = useSearchParams();

  const initial = params.get("d") ? fromIso(params.get("d")!) : new Date();
  const [anchor, setAnchor] = useState<Date>(initial);
  const { start } = useMemo(() => weekRange(anchor), [anchor]);
  const days = useMemo(() => weekDays(start), [start]);
  const { iso_year, iso_week } = useMemo(() => isoYearWeek(start), [start]);

  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const today = new Date();
    return days.find((d) => isoDate(d) === isoDate(today)) ?? days[0];
  });
  const [planOrReal, setPlanOrReal] = useState<"plan" | "real">("real");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState<MetaData>({});
  const [events, setEvents] = useState<EventRow[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("d", isoDate(anchor));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  useEffect(() => {
    if (!days.find((d) => isoDate(d) === isoDate(selectedDay))) setSelectedDay(days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.getTime()]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
      if (data?.name) setUserName(data.name);
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId || !user || user.id !== ADMIN_ID) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const { data, error } = await supabase.functions.invoke("admin-load-week", {
        body: {
          athlete_id: userId,
          plan_or_real: planOrReal,
          start: isoDate(days[0]),
          end: isoDate(days[6]),
          iso_year,
          iso_week,
        },
      });
      if (cancelled) return;
      const payload = data as {
        blocks?: Block[]; commentCounts?: Record<string, number>; meta?: MetaData; events?: EventRow[]; error?: string;
      } | null;
      if (error || payload?.error) {
        setError(payload?.error || error?.message || t("misc.adminUserWeek.loadFailed"));
        return;
      }
      setBlocks(payload?.blocks ?? []);
      setCommentCounts(payload?.commentCounts ?? {});
      setMeta(payload?.meta ?? {});
      setEvents(payload?.events ?? []);
    })();
    return () => { cancelled = true; };
  }, [userId, user?.id, planOrReal, start.getTime(), iso_year, iso_week]);

  if (loading) return null;
  if (!user || user.id !== ADMIN_ID) return <Navigate to="/" replace />;
  if (!userId) return <Navigate to="/admin" replace />;

  const dayBlocks = blocks.filter((b) => b.block_date === isoDate(selectedDay));
  const selectedDayIndex = Math.max(0, days.findIndex((d) => isoDate(d) === isoDate(selectedDay)));
  const eventForDay = (d: Date) => {
    const iso = isoDate(d);
    return events.find((e) => e.start_date <= iso && e.end_date >= iso) ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin"><ArrowLeft className="mr-1 h-4 w-4" />{t("misc.adminUserWeek.backToAdmin")}</Link>
        </Button>
        <div className="text-sm text-muted-foreground">
          {t("misc.adminUserWeek.journalOf")} <span className="font-semibold text-foreground">{userName || userId}</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">{t("misc.adminUserWeek.readOnly")}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(prevWeek(anchor))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[240px] text-center">
            <p className="text-base font-bold">{weekHeader(anchor)}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(nextWeek(anchor))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>{t("misc.adminUserWeek.today")}</Button>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => setPlanOrReal("plan")}
            className={`px-3 py-1.5 text-xs font-semibold ${planOrReal === "plan" ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >{t("misc.adminUserWeek.plan")}</button>
          <button
            type="button"
            onClick={() => setPlanOrReal("real")}
            className={`px-3 py-1.5 text-xs font-semibold ${planOrReal === "real" ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >{t("misc.adminUserWeek.actual")}</button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</Card>
      )}

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const isSel = isoDate(d) === isoDate(selectedDay);
          const dayBlks = blocks.filter((b) => b.block_date === isoDate(d));
          const ev = eventForDay(d);
          const evIcon = ev?.event_type === "zavod" ? "🏁" : ev?.event_type === "soustredeni" ? "🏕️" : ev?.event_type === "volno" ? "🌿" : "";
          return (
            <button
              key={isoDate(d)}
              onClick={() => setSelectedDay(d)}
              className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-xs transition-colors ${
                isSel ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent"
              }`}
            >
              <span className="text-[10px] uppercase">{(t("misc.adminUserWeek.days", { returnObjects: true }) as string[])[(d.getDay()+6)%7]}</span>
              <span className="text-base font-bold">{d.getDate()}</span>
              {ev && <span className="mt-0.5 text-[11px] leading-none">{evIcon}</span>}
              {dayBlks.length > 0 && <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <DailyDetail
          date={selectedDay}
          blocks={dayBlocks}
          
          onAdd={() => {}}
          onOpen={() => {}}
          canEdit={false}
          morningHr={(meta.MORNING_HR?.[selectedDayIndex] as number) || 0}
          onMorningHrChange={() => {}}
          event={eventForDay(selectedDay)}
          showMorningData={planOrReal === "real"}
        />
        <WeeklyTable
          athleteId={userId}
          weekStart={start}
          planOrReal={planOrReal}
          blocks={blocks}
          canEdit={false}
          meta={meta}
          setMetaCell={() => {}}
          selectedDayIndex={selectedDayIndex}
        />
      </div>
    </div>
  );
}
