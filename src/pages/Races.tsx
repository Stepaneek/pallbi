import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, FileDown } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useTranslation } from "react-i18next";
import { dateLocale } from "@/lib/dateLocale";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import {
  fetchEvents,
  migrateLegacyEventsToSupabase,
  type CalEvent,
  type EventType,
} from "@/lib/events";
import { exportEventsPdf } from "@/lib/eventsPdf";

type DebugFetchLog = {
  source: "auto" | "manual";
  at: string;
  query: string;
  count: number;
  error: string | null;
  rows: CalEvent[];
};

const TYPE_STYLE: Record<
  EventType,
  { bar: string; dot: string; chip: string; ring: string; color: string }
> = {
  zavod: {
    bar: "border-l-[3px] border-red-500 bg-red-500/15 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
    chip: "border border-red-500/40 bg-red-500/15 text-red-800 hover:bg-red-500/25 dark:text-red-200",
    ring: "ring-red-700",
    color: "#EF4444",
  },
  soustredeni: {
    bar: "border-l-[3px] border-blue-500 bg-blue-500/15 text-blue-800 dark:text-blue-200",
    dot: "bg-blue-500",
    chip: "border border-blue-500/40 bg-blue-500/15 text-blue-800 hover:bg-blue-500/25 dark:text-blue-200",
    ring: "ring-blue-700",
    color: "#3B82F6",
  },
  volno: {
    bar: "border-l-[3px] border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
    chip: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200",
    ring: "ring-emerald-700",
    color: "#22C55E",
  },
  ostatni: {
    bar: "border-l-[3px] border-violet-500 bg-violet-500/15 text-violet-800 dark:text-violet-200",
    dot: "bg-violet-600",
    chip: "border border-violet-500/40 bg-violet-500/15 text-violet-800 hover:bg-violet-500/25 dark:text-violet-200",
    ring: "ring-violet-800",
    color: "#7C3AED",
  },
};

const isoDate = (d: Date) => format(d, "yyyy-MM-dd");

function pluralEvents(n: number, t: (k: string, o?: any) => string) {
  if (n === 1) return t("races.eventsCount.one", { count: n });
  if (n >= 2 && n <= 4) return t("races.eventsCount.few", { count: n });
  return t("races.eventsCount.many", { count: n });
}

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function Races() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const WEEKDAYS = Object.values(t("days.short", { returnObjects: true }) as Record<string, string>);
  const { user } = useAuth();
  const { viewingAthleteId } = useRole();
  const athleteId = viewingAthleteId ?? user?.id ?? null;
  const canEdit = !!user && !!athleteId && user.id === athleteId;
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugFetchLog, setDebugFetchLog] = useState<DebugFetchLog | null>(null);
  const [activeFilter, setActiveFilter] = useState<EventType | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CalEvent> | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CalEvent | null>(null);

  // --- Pohled po jednotlivých měsících ---
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const year = month.getFullYear();
  const YEARS = [2025, 2026, 2027];



  const load = async (source: "auto" | "manual" = "auto") => {
    if (!athleteId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const query = `supabase.from("events").select().eq("athlete_id", "${athleteId}")`;
    try {
      // One-shot migration of any legacy localStorage events into Supabase
      // (only migrates for the currently authenticated user's own diary).
      if (user?.id && user.id === athleteId) {
        const migrated = await migrateLegacyEventsToSupabase(user.id);
        if (migrated > 0) {
          toast({ title: t("races.migrated", { count: migrated }) });
        }
      }
      const sorted = await fetchEvents(athleteId);
      setEvents(sorted);
      setDebugFetchLog({
        source,
        at: new Date().toISOString(),
        query,
        count: sorted.length,
        error: null,
        rows: sorted,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEvents([]);
      setDebugFetchLog({ source, at: new Date().toISOString(), query, count: 0, error: msg, rows: [] });
      toast({ title: t("races.loadError"), description: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const filteredEvents = useMemo(
    () => (activeFilter ? events.filter((e) => e.event_type === activeFilter) : events),
    [events, activeFilter],
  );

  // Akce zasahující do vybraného měsíce (pro export)
  const monthEvents = useMemo(() => {
    const from = isoDate(startOfMonth(month));
    const to = isoDate(endOfMonth(month));
    return filteredEvents.filter((e) => e.start_date <= to && e.end_date >= from);
  }, [filteredEvents, month]);

  const seasonStartYear = month.getMonth() >= 3 ? year : year - 1;

  const seasonEvents = useMemo(() => {
    const from = `${seasonStartYear}-04-01`;
    const to = `${seasonStartYear + 1}-03-31`;
    return filteredEvents.filter((e) => e.start_date <= to && e.end_date >= from);
  }, [filteredEvents, seasonStartYear]);

  const handleExportPdf = async () => {
    const label = format(month, "LLLL yyyy", { locale });
    await exportEventsPdf({
      title: t("races.title"),
      subtitle: label,
      events: monthEvents,
      fileName: `pallbi-terminovka-${format(month, "yyyy-MM")}.pdf`,
    });
  };

  const handleExportSeasonPdf = async () => {
    await exportEventsPdf({
      title: `${t("races.title")} – ${t("races.season", { defaultValue: "Sezóna" })} ${seasonStartYear}/${seasonStartYear + 1}`,
      subtitle: `1. 4. ${seasonStartYear} – 31. 3. ${seasonStartYear + 1}`,
      events: seasonEvents,
      groupByMonth: true,
      monthLabel: (iso) => format(parseISO(iso), "LLLL yyyy", { locale }),
      fileName: `pallbi-terminovka-sezona-${seasonStartYear}-${seasonStartYear + 1}.pdf`,
    });
  };

  const fromTodayEvents = useMemo(() => {
    const todayIso = isoDate(new Date());
    const seasonEnd = `${seasonStartYear + 1}-03-31`;
    return filteredEvents.filter((e) => e.end_date >= todayIso && e.start_date <= seasonEnd);
  }, [filteredEvents, seasonStartYear]);

  const handleExportFromTodayPdf = async () => {
    const todayLabel = format(new Date(), "d. M. yyyy", { locale });
    await exportEventsPdf({
      title: `${t("races.title")} – Od ${todayLabel} do 31. 3. ${seasonStartYear + 1}`,
      subtitle: `${t("races.fromToday", { defaultValue: "Od dnešního data do konce sezóny" })}`,
      events: fromTodayEvents,
      groupByMonth: true,
      monthLabel: (iso) => format(parseISO(iso), "LLLL yyyy", { locale }),
      fileName: `pallbi-terminovka-od-dnes-${isoDate(new Date())}.pdf`,
    });
  };



  const counts = useMemo(() => {
    const c: Record<EventType, number> = { zavod: 0, soustredeni: 0, volno: 0, ostatni: 0 };
    for (const e of events) c[e.event_type] += 1;
    return c;
  }, [events]);

  const openNew = (date: Date) => {
    if (!canEdit) return;
    const iso = isoDate(date);
    setEditing({ event_type: "zavod", title: "", start_date: iso, end_date: iso });
    setFormOpen(true);
  };

  const openDetail = (ev: CalEvent) => {
    setDetail(ev);
    setDetailOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!user?.id || !athleteId || user.id !== athleteId) {
      toast({ title: t("races.noPermission"), variant: "destructive" });
      return;
    }
    if (!editing.title || !editing.start_date || !editing.end_date || !editing.event_type) {
      toast({ title: t("races.fillRequired"), variant: "destructive" });
      return;
    }
    if (editing.end_date < editing.start_date) {
      toast({ title: t("races.endBeforeStart"), variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("events").insert({
      athlete_id: user.id,
      event_type: editing.event_type,
      title: editing.title,
      start_date: editing.start_date,
      end_date: editing.end_date,
    });
    if (error) {
      toast({ title: t("races.saveError"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("races.eventAdded") });
    setFormOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!user?.id || !athleteId || user.id !== athleteId) {
      toast({ title: t("races.noPermission"), variant: "destructive" });
      return;
    }
    if (!confirm(t("races.confirmDelete"))) return;
    const { error } = await supabase.from("events").delete().eq("id", detail.id);
    if (error) {
      toast({ title: t("races.deleteError"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("races.deleted") });
    setDetailOpen(false);
    setDetail(null);
    load();
  };


  const todayYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("races.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("races.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(month.getMonth())}
            onValueChange={(v) => setMonth(new Date(year, Number(v), 1))}
          >
            <SelectTrigger className="w-[140px] font-semibold capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                <SelectItem key={m} value={String(m)} className="capitalize">
                  {format(new Date(year, m, 1), "LLLL", { locale })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setMonth(new Date(Number(v), month.getMonth(), 1))}>
            <SelectTrigger className="w-[92px] font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            {t("common.today")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="mr-1.5 h-4 w-4" />
                {t("races.exportPdf", { defaultValue: "Exportovat do PDF" })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPdf}>
                {format(month, "LLLL yyyy", { locale })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportFromTodayPdf}>
                {t("races.fromTodayShort", { defaultValue: "Od dnešního data do konce sezóny" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSeasonPdf}>
                {t("races.season", { defaultValue: "Sezóna" })} {seasonStartYear}/{seasonStartYear + 1}
              </DropdownMenuItem>
            </DropdownMenuContent>

          </DropdownMenu>

        </div>
      </div>


      {/* Velké barevné štítky / filtr */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(TYPE_STYLE) as EventType[]).map((et) => {
          const style = TYPE_STYLE[et];
          const isActive = activeFilter === et;
          const dimmed = activeFilter !== null && !isActive;
          return (
            <button
              key={et}
              type="button"
              onClick={() => setActiveFilter(isActive ? null : et)}
              className={cn(
                "rounded-xl px-4 py-3 text-left shadow-sm transition-all",
                style.chip,
                isActive && "ring-2 ring-offset-2 ring-offset-background scale-[1.02]",
                isActive && style.ring,
                dimmed && "opacity-50",
              )}
            >
              <div className="text-sm font-bold uppercase tracking-wide">{t(`eventTypes.${et}`)}</div>
              <div className="text-xs opacity-90 mt-0.5">{pluralEvents(counts[et], t)}</div>
            </button>
          );
        })}
      </div>

      {activeFilter && (
        <p className="text-xs text-muted-foreground">
          {t("races.filteredOnly", { type: t(`eventTypes.${activeFilter}`) })}{" "}
          <button
            className="underline hover:text-foreground"
            onClick={() => setActiveFilter(null)}
          >
            {t("races.clearFilter")}
          </button>
        </p>
      )}


      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
          <h3 className="text-base font-semibold capitalize">
            {format(month, "LLLL yyyy", { locale })}
          </h3>
          {isSameMonth(month, new Date()) && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {t("races.currentMonth")}
            </span>
          )}
        </div>
        <MonthGrid
          month={month}
          events={filteredEvents}
          onDayClick={openNew}
          onEventClick={openDetail}
        />
      </div>


      {loading && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("races.newEvent")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 py-2">
              <div>
                <Label>{t("races.eventType")}</Label>
                <Select
                  value={editing.event_type}
                  onValueChange={(v) => setEditing({ ...editing, event_type: v as EventType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_STYLE) as EventType[]).map((et) => (
                      <SelectItem key={et} value={et}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-sm", TYPE_STYLE[et].dot)} />
                          {t(`eventTypes.${et}`)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("races.name")}</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder={t("races.namePlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("races.dateFrom")}</Label>
                  <Input
                    type="date"
                    value={editing.start_date ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        start_date: e.target.value,
                        end_date:
                          editing.end_date && editing.end_date < e.target.value
                            ? e.target.value
                            : editing.end_date,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>{t("races.dateTo")}</Label>
                  <Input
                    type="date"
                    value={editing.end_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t("races.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("races.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && (
                <span className={cn("h-3 w-3 rounded-sm", TYPE_STYLE[detail.event_type].dot)} />
              )}
              {detail?.title}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 py-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t("races.type")} </span>
                {t(`eventTypes.${detail.event_type}`)}
              </div>
              <div>
                <span className="text-muted-foreground">{t("races.date")} </span>
                {format(parseISO(detail.start_date), "d. M. yyyy", { locale })}
                {detail.start_date !== detail.end_date && (
                  <> – {format(parseISO(detail.end_date), "d. M. yyyy", { locale })}</>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              {t("races.close")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> {t("races.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthGrid({
  month,
  events,
  onDayClick,
  onEventClick,
}: {
  month: Date;
  events: CalEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (ev: CalEvent) => void;
}) {
  const { t } = useTranslation();
  const WEEKDAYS = Object.values(t("days.short", { returnObjects: true }) as Record<string, string>);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const event of events) {
      const eventDays = eachDayOfInterval({ start: parseISO(event.start_date), end: parseISO(event.end_date) });
      for (const eventDay of eventDays) {
        const key = isoDate(eventDay);
        const dayEvents = map.get(key) ?? [];
        dayEvents.push(event);
        map.set(key, dayEvents);
      }
    }
    return map;
  }, [events]);

  return (
    <>
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = isoDate(d);
          const inMonth = isSameMonth(d, month);
          // Outside days: completely invisible placeholders, preserve 7-column grid alignment
          if (!inMonth) {
            return <div key={key} className="invisible min-h-[84px]" aria-hidden="true" />;
          }
          const dayEvents = eventsByDay.get(key) ?? [];
          const hasEvents = dayEvents.length > 0;
          const cellStyle: React.CSSProperties | undefined = hasEvents
            ? dayEvents.length === 1
              ? { backgroundColor: TYPE_STYLE[dayEvents[0].event_type].color }
              : {
                  backgroundImage: `linear-gradient(to right, ${dayEvents
                    .map((ev, i) => {
                      const step = 100 / dayEvents.length;
                      return `${TYPE_STYLE[ev.event_type].color} ${i * step}% ${(i + 1) * step}%`;
                    })
                    .join(", ")})`,
                }
            : undefined;

          return (
            <button
              type="button"
              key={key}
              onClick={() => {
                if (dayEvents.length === 1) {
                  onEventClick(dayEvents[0]);
                } else {
                  onDayClick(d);
                }
              }}
              className={cn(
                "group relative min-h-[84px] border-b border-r p-1.5 text-left transition-colors",
                !hasEvents && "hover:bg-accent/40",
                hasEvents && "text-white",
              )}
              style={cellStyle}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday(d) && !hasEvents && "bg-primary text-primary-foreground",
                    isToday(d) && hasEvents && "bg-white/90 text-foreground",
                  )}
                >
                  {format(d, "d")}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className="truncate text-[11px] font-medium leading-tight cursor-pointer hover:underline"
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] opacity-90">+{dayEvents.length - 3} {t("races.more")}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
