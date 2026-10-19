import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, addWeeks, endOfISOWeek, format, getISOWeek, getISOWeekYear, isBefore, parseISO, startOfISOWeek, subDays } from "date-fns";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { MapPin, Clock, TrendingUp, Trophy, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";
import { publicDb } from "@/lib/db";
import { Database } from "@/integrations/supabase/types";
import { isoDate } from "@/lib/week";
import { TRAINING_ZONES, Zone, zoneLabel } from "@/lib/zones";
import { Sport, SPORT_ROW_LABEL, SPORT_COLOR } from "@/lib/sports";
import { MetaData } from "@/hooks/useWeeklyMeta";
import VolumeComparison from "@/components/analytics/VolumeComparison";
import FitnessFatigue from "@/components/analytics/FitnessFatigue";
import ShootingAnalytics from "@/components/analytics/ShootingAnalytics";
import { useShootingSessions } from "@/hooks/useShootingSessions";
import { parseShootingSets } from "@/lib/shooting";
import { isSeasonSeedBlock } from "@/lib/seasonSeed";
import { useTranslation } from "react-i18next";
import { dateLocale } from "@/lib/dateLocale";


type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
type WeeklyMetaRow = Database["public"]["Tables"]["weekly_meta"]["Row"];
type RawSegment = { zone?: string; duration_minutes?: number };

const ZONE_COLORS: Record<Zone, string> = {
  VOLNA: "hsl(var(--zone-volna))",
  I1: "hsl(var(--zone-i1))",
  I2: "hsl(var(--zone-i2))",
  I3: "hsl(var(--zone-i3))",
  I4: "hsl(var(--zone-i4))",
  I5: "hsl(var(--zone-i5))",
  I6: "hsl(var(--zone-i6))",
};

const KM_SPORTS: { key: Sport; label: string; color: string }[] = [
  { key: "beh", label: SPORT_ROW_LABEL.beh, color: SPORT_COLOR.beh },
  { key: "kolo", label: SPORT_ROW_LABEL.kolo, color: SPORT_COLOR.kolo },
  { key: "kolobezka_lyze", label: SPORT_ROW_LABEL.kolobezka_lyze, color: SPORT_COLOR.kolobezka_lyze },
  { key: "lyze", label: SPORT_ROW_LABEL.lyze, color: SPORT_COLOR.lyze },
  { key: "plavani", label: SPORT_ROW_LABEL.plavani, color: SPORT_COLOR.plavani },
  { key: "ostatni", label: SPORT_ROW_LABEL.ostatni, color: SPORT_COLOR.ostatni },
];

// ---- Sloupcový graf "Kilometry v čase": vzhled sloupců ----
// Skládaný sloupec se zaoblijí jako celek, ne po jednotlivých dílcích: každý
// dílek je obyčejný obdélník (spoje uvnitř zůstávají ostré a čisté) a celý
// sloupec se ořízne clipPathem do tvaru s zaoblenou čepičkou. I tenký horní
// dílek tak dostane stejnou čepičku jako ostatní sloupce a sloupec přitom
// pořád přesně sedí na ose.
const KM_BAR_RADIUS = 4;
const KM_BAR_MAX_SIZE = 38;
// Clip sahá hluboko pod osu, spodní hrany sloupců se ho nechytí.
const KM_CAP_DEPTH = 3000;

type KmBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  index?: number | string;
  payload?: Record<string, string | number>;
};

/** Obdélník, případně se zaoblenými horními rohy. */
function kmRectPath(x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) return `M${x},${y}L${x + w},${y}L${x + w},${y + h}L${x},${y + h}Z`;
  return (
    `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}` +
    `L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`
  );
}

/** Id čepičky jednoho sloupce; bez spolehlivého indexu se ořez nepoužije. */
function kmCapId(props: KmBarShapeProps): string | null {
  const i = Number(props.index);
  if (Number.isFinite(i)) return `km-cap-${i}`;
  const week = props.payload?.week;
  return typeof week === "string" && week ? `km-cap-${week.replace(/[^a-zA-Z0-9_-]/g, "")}` : null;
}

function kmStackedBarShape(
  props: KmBarShapeProps,
  dataKey: Sport,
  data?: { [key: string]: string | number }[],
) {
  const x = Number(props.x) || 0;
  const y = Number(props.y) || 0;
  const w = Number(props.width) || 0;
  const h = Number(props.height) || 0;
  if (w <= 0) return <g />;

  const row = props.payload ?? data?.[Number(props.index)] ?? {};
  // horní dílek sloupce = poslední sport s nenulovou hodnotou v pořadí Bar
  let topKey: Sport | null = null;
  for (const s of KM_SPORTS) if (Number(row[s.key]) > 0) topKey = s.key;

  const r = Math.min(KM_BAR_RADIUS, w / 2);
  const capId = kmCapId(props);
  const clip = capId ? `url(#${capId})` : undefined;

  if (topKey === dataKey) {
    // čepičku definuje horní dílek – i když je sám jen pár pixelů vysoký
    return (
      <g>
        {capId && (
          <clipPath id={capId}>
            <path d={kmRectPath(x, y, w, KM_CAP_DEPTH, r)} />
          </clipPath>
        )}
        {h > 0 &&
          (capId ? (
            <rect x={x} y={y} width={w} height={h} fill={props.fill} clipPath={clip} />
          ) : (
            <path d={kmRectPath(x, y, w, h, Math.min(r, h))} fill={props.fill} stroke="none" />
          ))}
      </g>
    );
  }
  if (h <= 0) return <g />;
  return <rect x={x} y={y} width={w} height={h} fill={props.fill} clipPath={clip} />;
}


function blockSegments(b: Block): { zone: Zone; duration_minutes: number }[] {
  const raw = (b as unknown as { segments?: unknown }).segments;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: { zone: Zone; duration_minutes: number }[] = [];
  for (const s of raw as RawSegment[]) {
    const z = s?.zone as Zone | undefined;
    const d = Number(s?.duration_minutes) || 0;
    if (z && d > 0) out.push({ zone: z, duration_minutes: d });
  }
  return out;
}

function blockMinutesByZone(b: Block): Record<string, number> {
  const out: Record<string, number> = {};
  const segs = blockSegments(b);
  if (segs.length) {
    for (const s of segs) out[s.zone] = (out[s.zone] || 0) + s.duration_minutes;
  } else {
    out[b.zone] = (out[b.zone] || 0) + (b.duration_minutes || 0);
  }
  return out;
}

function blockTotalMinutes(b: Block): number {
  const segs = blockSegments(b);
  if (segs.length) return segs.reduce((a, s) => a + s.duration_minutes, 0);
  return b.duration_minutes || 0;
}

/** Sezóna 1.4. – 31.3. */
function seasonRange(seasonStartYear: number): { start: Date; end: Date; label: string } {
  return {
    start: new Date(seasonStartYear, 3, 1), // April = month 3
    end: new Date(seasonStartYear + 1, 2, 31),
    label: `${seasonStartYear}/${seasonStartYear + 1}`,
  };
}

function currentSeasonStartYear(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const { viewingAthleteId, athletes, setViewingAthleteId } = useRole();
  const [seasonStart, setSeasonStart] = useState<number>(currentSeasonStartYear());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [metaRows, setMetaRows] = useState<WeeklyMetaRow[]>([]);
  const [loading, setLoading] = useState(false);

  const season = useMemo(() => seasonRange(seasonStart), [seasonStart]);

  // All ISO weeks within the current season (from T1 to current week)
  const seasonWeeks = useMemo(() => {
    const today = new Date();
    const thisWeekStart = startOfISOWeek(today);
    const seasonWeek1Start = startOfISOWeek(season.start);
    const seasonEndWeekStart = startOfISOWeek(season.end);
    const lastStart = thisWeekStart < seasonEndWeekStart ? thisWeekStart : seasonEndWeekStart;
    const totalSeasonWeeks = Math.round((lastStart.getTime() - seasonWeek1Start.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
    if (totalSeasonWeeks <= 0) return [];
    const weeks: { start: Date; end: Date; iso_year: number; iso_week: number; label: string; range: string }[] = [];
    for (let i = totalSeasonWeeks - 1; i >= 0; i--) {
      const start = addWeeks(lastStart, -i);
      const end = endOfISOWeek(start);
      const diffWeeks = Math.round((start.getTime() - seasonWeek1Start.getTime()) / (7 * 24 * 3600 * 1000));
      const seasonWeekNum = diffWeeks + 1;
      weeks.push({
        start,
        end,
        iso_year: getISOWeekYear(start),
        iso_week: getISOWeek(start),
        label: `${seasonWeekNum}`,
        range: `${format(start, "d.M.")}-${format(end, "d.M.")}`,
      });
    }
    return weeks;
  }, [season.start, season.end]);
  const last12Weeks = seasonWeeks;

  // Last 30 days
  const last30Days = useMemo(() => {
    const today = new Date();
    const days: Date[] = [];
    for (let i = 29; i >= 0; i--) days.push(subDays(today, i));
    return days;
  }, []);

  // Fetch range = min(season.start, last30Days[0], last12Weeks[0].start) → max(season.end, today)
  const fetchRange = useMemo(() => {
    const today = new Date();
    const startCandidates = [season.start, last30Days[0], last12Weeks[0].start];
    const endCandidates = [season.end, today];
    const start = startCandidates.reduce((a, b) => (a < b ? a : b));
    const end = endCandidates.reduce((a, b) => (a > b ? a : b));
    return { start, end };
  }, [season.start, season.end, last30Days, last12Weeks]);

  const shootingSessions = useShootingSessions(viewingAthleteId, isoDate(fetchRange.start), isoDate(fetchRange.end));

  useEffect(() => {
    if (!viewingAthleteId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const startIso = isoDate(fetchRange.start);
      const endIso = isoDate(fetchRange.end);

      const blocksQ = publicDb
        .from("training_blocks")
        .select("*")
        .eq("athlete_id", viewingAthleteId)
        .eq("plan_or_real", "real")
        .gte("block_date", startIso)
        .lte("block_date", endIso);

      const metaQ = publicDb
        .from("weekly_meta")
        .select("*")
        .eq("athlete_id", viewingAthleteId)
        .eq("plan_or_real", "real");

      const [{ data: bData }, { data: mData }] = await Promise.all([blocksQ, metaQ]);
      if (cancelled) return;
      setBlocks(bData ?? []);
      setMetaRows(mData ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [viewingAthleteId, fetchRange.start.getTime(), fetchRange.end.getTime()]);

  const hasShooting = useMemo(
    () => (shootingSessions.data?.length ?? 0) > 0 || blocks.some((b) => parseShootingSets((b as { shooting_sets?: unknown }).shooting_sets).length > 0),
    [blocks, shootingSessions.data],
  );

  // ---------- STATISTIKY ----------
  const seasonBlocks = useMemo(
    () => blocks.filter((b) => {
      if (b.sport === "strelba") return false;
      const d = parseISO(b.block_date);
      return d >= season.start && d <= season.end;
    }),
    [blocks, season.start, season.end],
  );

  const seasonTotalKm = useMemo(
    () => seasonBlocks.reduce((a, b) => a + (Number(b.distance_km) || 0), 0),
    [seasonBlocks],
  );

  const seasonTotalMin = useMemo(
    () => seasonBlocks.reduce((a, b) => a + blockTotalMinutes(b), 0),
    [seasonBlocks],
  );

  // weekly hours across season (for "longest week" + avg)
  const { seasonWeekHours, seasonAvgWeekHours } = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of seasonBlocks) {
      if (isSeasonSeedBlock(b)) continue;
      const d = parseISO(b.block_date);
      const key = `${getISOWeekYear(d)}-${getISOWeek(d)}`;
      map.set(key, (map.get(key) || 0) + blockTotalMinutes(b) / 60);
    }
    let max = 0;
    let sum = 0;
    let count = 0;
    const today = new Date();
    for (const w of seasonWeeks) {
      const hours = map.get(`${w.iso_year}-${w.iso_week}`) || 0;
      if (hours > max) max = hours;
      if (isBefore(w.end, today)) {
        sum += hours;
        count++;
      }
    }
    const avg = count > 0 ? sum / count : 0;
    return { seasonWeekHours: max, seasonAvgWeekHours: avg };
  }, [seasonBlocks, seasonWeeks]);

  // Avg morning HR this calendar month
  const avgMorningHrThisMonth = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    let sum = 0;
    let n = 0;
    for (const row of metaRows) {
      const data = (row.data as MetaData) || {};
      const arr = data.MORNING_HR;
      if (!Array.isArray(arr)) continue;
      const jan4 = parseISO(`${row.iso_year}-01-04`);
      const ws = addWeeks(startOfISOWeek(jan4), row.iso_week - 1);
      for (let i = 0; i < 7; i++) {
        const v = Number(arr[i]) || 0;
        if (v <= 0) continue;
        const d = addDays(ws, i);
        if (d.getFullYear() === y && d.getMonth() === m) {
          sum += v;
          n++;
        }
      }
    }
    return n ? Math.round(sum / n) : null;
  }, [metaRows]);

  // ---------- FORMA V ČASE (hours per week, all season weeks) ----------
  const formaData = useMemo(() => {
    return last12Weeks.map((w, index) => {
      const min = blocks
        .filter((b) => {
          if (b.sport === "strelba") return false;
          if (isSeasonSeedBlock(b)) return false;
          const d = parseISO(b.block_date);
          return d >= w.start && d <= w.end;
        })
        .reduce((a, b) => a + blockTotalMinutes(b), 0);
      return {
        week: `T${w.label}`,
        range: w.range,
        hours: Math.round((min / 60) * 10) / 10,
        current: index === last12Weeks.length - 1,
      };
    });
  }, [blocks, last12Weeks]);

  const currentWeekLabel = useMemo(
    () => (formaData.length ? formaData[formaData.length - 1].week : undefined),
    [formaData]
  );

  // ---------- KILOMETRY V ČASE (km per week per sport) ----------
  const kmData = useMemo(() => {
    return last12Weeks.map((w) => {
      const row: Record<string, number | string> = { week: `T${w.label}`, range: w.range };
      for (const s of KM_SPORTS) row[s.key] = 0;
      for (const b of blocks) {
        if (b.sport === "strelba") continue;
        if (isSeasonSeedBlock(b)) continue;
        const d = parseISO(b.block_date);
        if (d < w.start || d > w.end) continue;
        const km = Number(b.distance_km) || 0;
        if (!km) continue;
        if (KM_SPORTS.find((s) => s.key === b.sport)) {
          row[b.sport] = ((row[b.sport] as number) || 0) + km;
        }
      }
      // round
      for (const s of KM_SPORTS) row[s.key] = Math.round((row[s.key] as number) * 10) / 10;
      return row;
    });
  }, [blocks, last12Weeks]);

  // ---------- ROZLOŽENÍ INTENZIT (donut for current season) ----------
  const zoneData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const z of ["VOLNA", ...TRAINING_ZONES] as Zone[]) totals[z] = 0;
    for (const b of seasonBlocks) {
      if (isSeasonSeedBlock(b)) continue;
      const m = blockMinutesByZone(b);
      for (const [z, min] of Object.entries(m)) {
        if (totals[z] !== undefined) totals[z] += min;
      }
    }
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return (["VOLNA", ...TRAINING_ZONES] as Zone[])
      .map((z) => ({
        name: zoneLabel(z),
        zone: z,
        value: Math.round((totals[z] / 60) * 10) / 10,
        pct: total ? Math.round((totals[z] / total) * 1000) / 10 : 0,
        color: ZONE_COLORS[z],
      }))
      .filter((x) => x.value > 0);
  }, [seasonBlocks]);

  // ---------- RANNÍ TEPY (last 30 days) ----------
  const hrData = useMemo(() => {
    // Build map iso date -> hr
    const map = new Map<string, number>();
    for (const row of metaRows) {
      const arr = (row.data as MetaData)?.MORNING_HR;
      if (!Array.isArray(arr)) continue;
      const jan4 = parseISO(`${row.iso_year}-01-04`);
      const ws = addWeeks(startOfISOWeek(jan4), row.iso_week - 1);
      for (let i = 0; i < 7; i++) {
        const v = Number(arr[i]) || 0;
        if (v <= 0) continue;
        map.set(isoDate(addDays(ws, i)), v);
      }
    }
    return last30Days.map((d) => ({
      date: format(d, "d.M.", { locale: dateLocale(i18n.language) }),
      hr: map.get(isoDate(d)) ?? null,
    }));
  }, [metaRows, last30Days]);

  const seasonOptions = useMemo(() => {
    const cur = currentSeasonStartYear();
    return [cur - 1, cur].map((y) => seasonRange(y));
  }, []);

  const weekRangeMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const w of last12Weeks) m[`T${w.label}`] = w.range;
    return m;
  }, [last12Weeks]);

  const WeekTick = (props: { x?: number; y?: number; payload?: { value: string } }) => {
    const { x = 0, y = 0, payload } = props;
    const val = payload?.value ?? "";
    const range = weekRangeMap[val] ?? "";
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={12}>{val}</text>
        <text x={0} y={0} dy={26} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>{range}</text>
      </g>
    );
  };

  // Horizontal scroll containers for time-series charts; scroll to the rightmost (most recent) week on load.
  const PX_PER_WEEK = 64;
  const chartInnerWidth = Math.max(seasonWeeks.length * PX_PER_WEEK, 320);
  const formaScrollRef = useRef<HTMLDivElement>(null);
  const kmScrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (formaScrollRef.current) formaScrollRef.current.scrollLeft = formaScrollRef.current.scrollWidth;
    if (kmScrollRef.current) kmScrollRef.current.scrollLeft = kmScrollRef.current.scrollWidth;
  }, [chartInnerWidth, formaData.length, kmData.length]);

  return (

    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <div className="flex items-center gap-2">
          {athletes.length > 1 && viewingAthleteId && (
            <Select value={viewingAthleteId} onValueChange={setViewingAthleteId}>
              <SelectTrigger className="w-[180px] dark:bg-slate-800/80 dark:border-white/[0.08]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {athletes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name ?? t("analytics.athletePlaceholder")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={String(seasonStart)} onValueChange={(v) => setSeasonStart(Number(v))}>
            <SelectTrigger className="w-[180px] dark:bg-slate-800/80 dark:border-white/[0.08]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasonOptions.map((s) => (
                <SelectItem key={s.label} value={String(s.start.getFullYear())}>
                  {t("analytics.season", { label: s.label })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* STATISTIKY */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("analytics.statistics")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label={t("analytics.totalKmSeason", { label: season.label })} value={seasonTotalKm.toFixed(1)} suffix="km" icon={MapPin} />
          <StatCard label={t("analytics.totalHoursSeason", { label: season.label })} value={(seasonTotalMin / 60).toFixed(1)} suffix="h" icon={Clock} />
          <StatCard label={t("analytics.avgWeeklyHours")} value={seasonAvgWeekHours.toFixed(1)} suffix="h" icon={TrendingUp} />
          <StatCard label={t("analytics.longestWeek")} value={seasonWeekHours.toFixed(1)} suffix="h" icon={Trophy} />
          <StatCard label={t("analytics.avgMorningHr")} value={avgMorningHrThisMonth ?? "—"} suffix={avgMorningHrThisMonth ? t("analytics.bpm") : ""} icon={Heart} />
        </div>
      </section>

      {/* FORMA V ČASE */}
      <Card className="dark:border-white/[0.08]">
        <CardHeader>
          <CardTitle className="text-base">{t("analytics.formaTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] p-0">
          <div ref={formaScrollRef} className="h-full overflow-x-auto overflow-y-hidden px-4">
            <div style={{ width: chartInnerWidth }} className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={formaData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="formaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tick={<WeekTick />} height={40} interval={0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="h" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    itemStyle={{ color: "white" }}
                    formatter={(v: number) => [`${v} h`, t("analytics.hours")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="none"
                    fill="url(#formaGradient)"
                    isAnimationActive={false}
                    tooltipType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx = 0, cy = 0, payload } = props as { cx?: number; cy?: number; payload?: { current?: boolean } };
                      const isCurrent = payload?.current;
                      return (
                        <g>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isCurrent ? 7 : 4}
                            fill={isCurrent ? "white" : "hsl(var(--primary))"}
                            stroke={isCurrent ? "hsl(var(--primary))" : "none"}
                            strokeWidth={isCurrent ? 2 : 0}
                          />
                        </g>
                      );
                    }}
                    activeDot={{ r: 8 }}
                  />
                  {currentWeekLabel && (
                    <ReferenceLine
                      x={currentWeekLabel}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      ifOverflow="extendDomain"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KILOMETRY V ČASE */}
      <Card className="dark:border-white/[0.08]">
        <CardHeader>
          <CardTitle className="text-base">{t("analytics.kmTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] p-0">
          <div ref={kmScrollRef} className="h-full overflow-x-auto overflow-y-hidden px-4">
            <div style={{ width: chartInnerWidth }} className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kmData} barCategoryGap="20%" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tick={<WeekTick />} height={40} interval={0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="km" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {KM_SPORTS.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="km"
                      fill={s.color}
                      name={s.label}
                      maxBarSize={KM_BAR_MAX_SIZE}
                      shape={(props: KmBarShapeProps) => kmStackedBarShape(props, s.key, kmData)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">


        {/* DONUT */}
        <Card className="dark:border-white/[0.08]">
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.zoneDistributionTitle", { label: season.label })}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {zoneData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("analytics.noData")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={zoneData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {zoneData.map((entry) => (
                      <Cell key={entry.zone} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12, color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(v: number, _n, p) => [`${v} h (${(p.payload as { pct: number }).pct} %)`, p.payload.name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* RANNÍ TEPY */}
        <Card className="dark:border-white/[0.08]">
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.morningHrTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={3} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={["auto", "auto"]} unit="" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => [`${v} bpm`, t("analytics.bpm")]}
                />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* SROVNÁNÍ OBJEMU */}
      {/* FORMA A ÚNAVA (CTL / ATL / TSB) */}
      <FitnessFatigue blocks={blocks} start={season.start} end={season.end} />

      {hasShooting && (
        <ShootingAnalytics blocks={blocks} sessions={shootingSessions.data ?? []} seasonStart={season.start} seasonEnd={season.end} />
      )}
      {shootingSessions.isError && <p role="alert" className="text-destructive">{t("zeroing.analyticsError")}</p>}

      <VolumeComparison athleteId={viewingAthleteId ?? null} />



      {loading && <p className="text-center text-xs text-muted-foreground">{t("analytics.loading")}</p>}
    </div>
  );
}

function StatCard({ label, value, suffix, icon: Icon }: { label: string; value: string | number; suffix?: string; icon?: React.ComponentType<{ className?: string; size?: string | number }> }) {
  return (
    <Card className="dark:border-white/[0.08]">
      <CardContent className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="text-muted-foreground" size={14} />}
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className="stat-number mt-0.5 text-2xl font-bold">
          {value}
          {suffix ? <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span> : null}
        </p>
      </CardContent>
    </Card>
  );
}
