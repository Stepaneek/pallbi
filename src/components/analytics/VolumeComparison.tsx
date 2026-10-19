import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publicDb } from "@/lib/db";
import { Database } from "@/integrations/supabase/types";
import { isoDate } from "@/lib/week";
import { TRAINING_ZONES, Zone, zoneLabel, zoneShort } from "@/lib/zones";
import { Sport, SPORT_ROW_LABEL, SPORT_COLOR } from "@/lib/sports";
import { useTranslation } from "react-i18next";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
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

const SPORT_LIST: Sport[] = ["beh", "kolo", "kolobezka_lyze", "lyze", "plavani", "osi", "ostatni"];

function monthsList(t: (k: string) => string): string[] {
  return Array.from({ length: 12 }, (_, i) => t(`analytics.volume.months.${i}`));
}

const SERIES_COLORS = ["#FB7185", "#22D3EE", "#A78BFA", "#FBBF24", "#A3E635"];
const HOURS_COLOR = "#38bdf8"; // sky blue
const KM_COLOR = "#ef4444"; // red

function segs(b: Block): { zone: Zone; duration_minutes: number }[] {
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

function totalMinutes(b: Block): number {
  const s = segs(b);
  if (s.length) return s.reduce((a, x) => a + x.duration_minutes, 0);
  return b.duration_minutes || 0;
}

function minutesByZone(b: Block): Record<string, number> {
  const out: Record<string, number> = {};
  const s = segs(b);
  if (s.length) for (const x of s) out[x.zone] = (out[x.zone] || 0) + x.duration_minutes;
  else out[b.zone] = (out[b.zone] || 0) + (b.duration_minutes || 0);
  return out;
}

function currentSeasonStartYear(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

type Period = { key: string; label: string; startIso: string; endIso: string };

function monthPeriod(year: number, month: number, months: string[]): Period {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { key: `m-${year}-${month}`, label: `${months[month]} ${year}`, startIso: isoDate(start), endIso: isoDate(end) };
}

function seasonPeriod(startYear: number): Period {
  return {
    key: `s-${startYear}`,
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
    startIso: isoDate(new Date(startYear, 3, 1)),
    endIso: isoDate(new Date(startYear + 1, 2, 31)),
  };
}

function fmtH(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

export default function VolumeComparison({ athleteId }: { athleteId: string | null }) {
  const { t } = useTranslation();
  const MONTHS = useMemo(() => monthsList(t), [t]);
  const [mode, setMode] = useState<"month" | "season">("month");
  const now = new Date();
  const [p1, setP1] = useState<{ month: number; year: number }>({
    month: (now.getMonth() + 11) % 12,
    year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
  });
  const [p2, setP2] = useState<{ month: number; year: number }>({ month: now.getMonth(), year: now.getFullYear() });
  const curSeason = currentSeasonStartYear();
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([curSeason - 1, curSeason]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => [2025, 2026, 2027], []);
  const seasonOptions = useMemo(() => [2025, 2026, 2027], []);

  const periods = useMemo<Period[]>(() => {
    if (mode === "month") {
      return [monthPeriod(p1.year, p1.month, MONTHS), monthPeriod(p2.year, p2.month, MONTHS)];
    }
    return [...selectedSeasons].sort((a, b) => a - b).map(seasonPeriod);
  }, [mode, p1, p2, selectedSeasons, MONTHS]);

  const range = useMemo(() => {
    if (!periods.length) return null;
    return {
      start: periods.reduce((a, p) => (p.startIso < a ? p.startIso : a), periods[0].startIso),
      end: periods.reduce((a, p) => (p.endIso > a ? p.endIso : a), periods[0].endIso),
    };
  }, [periods]);

  useEffect(() => {
    if (!athleteId || !range) {
      setBlocks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await publicDb
        .from("training_blocks")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("plan_or_real", "real")
        .gte("block_date", range.start)
        .lte("block_date", range.end);
      if (cancelled) return;
      setBlocks(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, range?.start, range?.end]);

  // ---- aggregation per period ----
  const agg = useMemo(() => {
    return periods.map((p) => {
      let min = 0;
      let km = 0;
      let dryMin = 0;
      const zones: Record<string, number> = {};
      const sports: Record<string, { min: number; km: number }> = {};
      for (const z of ["VOLNA", ...TRAINING_ZONES] as Zone[]) zones[z] = 0;
      for (const s of SPORT_LIST) sports[s] = { min: 0, km: 0 };

      for (const b of blocks) {
        const d = b.block_date.slice(0, 10);
        if (d < p.startIso || d > p.endIso) continue;
        if (b.sport === "strelba") {
          dryMin += totalMinutes(b);
          continue;
        }
        const m = totalMinutes(b);
        const k = Number(b.distance_km) || 0;
        min += m;
        km += k;
        if (sports[b.sport]) {
          sports[b.sport].min += m;
          sports[b.sport].km += k;
        }
        for (const [z, v] of Object.entries(minutesByZone(b))) {
          if (zones[z] !== undefined) zones[z] += v;
        }
      }
      return { period: p, min, km, dryMin, zones, sports };
    });
  }, [blocks, periods]);

  const hoursChart = useMemo(
    () => agg.map((a) => ({ name: a.period.label, hours: Math.round((a.min / 60) * 10) / 10 })),
    [agg],
  );
  const kmChart = useMemo(
    () => agg.map((a) => ({ name: a.period.label, km: Math.round(a.km * 10) / 10 })),
    [agg],
  );

  const zoneChart = useMemo(() => {
    return (["VOLNA", ...TRAINING_ZONES] as Zone[]).map((z) => {
      const row: Record<string, string | number> = { zone: zoneShort(z) };
      for (const a of agg) row[a.period.label] = Math.round((a.zones[z] / 60) * 10) / 10;
      return row;
    });
  }, [agg]);

  const sportChart = useMemo(() => {
    return SPORT_LIST.map((s) => {
      const row: Record<string, string | number> = { sport: SPORT_ROW_LABEL[s] };
      for (const a of agg) row[a.period.label] = Math.round((a.sports[s].min / 60) * 10) / 10;
      return row;
    });
  }, [agg]);

  const toggle = (arr: number[], v: number, set: (x: number[]) => void) => {
    if (arr.includes(v)) {
      if (arr.length === 1) return;
      set(arr.filter((x) => x !== v));
    } else {
      set([...arr, v]);
    }
  };

  const base = agg[0];
  const anyData = agg.some((a) => a.min > 0 || a.km > 0);

  return (
    <Card className="dark:border-white/[0.08]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{t("analytics.volume.title")}</CardTitle>
          <div className="inline-flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => setMode("month")}
              className={`px-3 py-1.5 text-xs font-semibold ${mode === "month" ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {t("analytics.volume.monthlyComparison")}
            </button>
            <button
              type="button"
              onClick={() => setMode("season")}
              className={`px-3 py-1.5 text-xs font-semibold ${mode === "season" ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {t("analytics.volume.seasonalComparison")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {mode === "month" ? (
            <>
              <PeriodPicker
                label={t("analytics.volume.period1", { defaultValue: "Období 1" })}
                value={p1}
                onChange={setP1}
                months={MONTHS}
                years={yearOptions}
              />
              <span className="text-xs font-semibold text-muted-foreground">{t("analytics.volume.vs")}</span>
              <PeriodPicker
                label={t("analytics.volume.period2", { defaultValue: "Období 2" })}
                value={p2}
                onChange={setP2}
                months={MONTHS}
                years={yearOptions}
              />
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {seasonOptions.map((y) => (
                <Chip key={y} active={selectedSeasons.includes(y)} onClick={() => toggle(selectedSeasons, y, setSelectedSeasons)}>
                  {y}/{String(y + 1).slice(2)}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* A) karty */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agg.map((a, i) => {
            const dMin = base ? a.min - base.min : 0;
            const dKm = base ? a.km - base.km : 0;
            const pct = base && base.min ? Math.round((dMin / base.min) * 1000) / 10 : null;
            return (
              <div key={a.period.key} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{a.period.label}</p>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {fmtH(a.min)}<span className="ml-1 text-sm font-medium text-muted-foreground">h</span>
                </p>
                <p className="text-sm font-semibold tabular-nums text-muted-foreground">{a.km.toFixed(1)} km</p>
                {i > 0 && (
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    <span className={dMin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                      {dMin >= 0 ? "+" : "−"}{fmtH(Math.abs(dMin))} h{pct !== null ? ` (${dMin >= 0 ? "+" : ""}${pct} %)` : ""}
                    </span>
                    {" · "}
                    <span className={dKm >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                      {dKm >= 0 ? "+" : "−"}{Math.abs(dKm).toFixed(1)} km
                    </span>
                    {" "}{t("analytics.volume.vs")}{" "}{base?.period.label}
                  </p>
                )}
                {a.dryMin > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("analytics.volume.dryTraining")}: {fmtH(a.dryMin)} h</p>
                )}
              </div>
            );
          })}
        </div>

        {!anyData && !loading && (
          <p className="text-center text-sm text-muted-foreground">{t("analytics.volume.noDataForPeriods")}</p>
        )}

        {/* B) celkový objem – dva grafy vedle sebe */}
        <div className="grid gap-4 md:grid-cols-2">
          <MiniChart title={t("analytics.volume.totalHours")}>
            <BarChart data={hoursChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke={HOURS_COLOR} fontSize={11} unit="h" tick={{ fill: HOURS_COLOR }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v} h`, t("analytics.hours")]}
                cursor={{ fill: "hsl(var(--muted)/0.4)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="hours" name={t("analytics.hours")} radius={[4, 4, 0, 0]} fill={HOURS_COLOR} />
            </BarChart>
          </MiniChart>
          <MiniChart title={t("analytics.volume.totalKm")}>
            <BarChart data={kmChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke={KM_COLOR} fontSize={11} unit="km" tick={{ fill: KM_COLOR }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v} km`, t("analytics.volume.kilometers")]}
                cursor={{ fill: "hsl(var(--muted)/0.4)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="km" name={t("analytics.volume.kilometers")} radius={[4, 4, 0, 0]} fill={KM_COLOR} />
            </BarChart>
          </MiniChart>
        </div>

        {/* C) zóny */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("analytics.volume.zoneDistribution")}</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="zone" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="h" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} h`} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {agg.map((a, i) => (
                  <Bar key={a.period.key} dataKey={a.period.label} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="border-b border-r px-2 py-2 text-left font-semibold">{t("analytics.volume.zoneCol")}</th>
                  {agg.map((a) => (
                    <th key={a.period.key} className="border-b px-2 py-2 text-center font-semibold">{a.period.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["VOLNA", ...TRAINING_ZONES] as Zone[]).map((z) => (
                  <tr key={z} className="border-b last:border-0 odd:bg-muted/20">
                    <td className="border-r px-2 py-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ backgroundColor: ZONE_COLORS[z] }} />
                      <span className="ml-1.5 font-medium">{zoneLabel(z)}</span>
                    </td>
                    {agg.map((a) => {
                      const total = Object.values(a.zones).reduce((x, y) => x + y, 0);
                      const v = a.zones[z];
                      return (
                        <td key={a.period.key} className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                          {v ? `${fmtH(v)} h` : "—"}
                          {v && total ? <span className="ml-1 text-[10px]">({Math.round((v / total) * 1000) / 10} %)</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* D) disciplíny */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("analytics.volume.sportDistribution")}</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sportChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="sport" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="h" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} h`} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {agg.map((a, i) => (
                  <Bar key={a.period.key} dataKey={a.period.label} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="border-b border-r px-2 py-2 text-left font-semibold">{t("analytics.volume.sportCol")}</th>
                  {agg.map((a) => (
                    <th key={a.period.key} className="border-b px-2 py-2 text-center font-semibold">{a.period.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SPORT_LIST.map((s) => (
                  <tr key={s} className="border-b last:border-0 odd:bg-muted/20">
                    <td className="border-r px-2 py-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ backgroundColor: SPORT_COLOR[s] }} />
                      <span className="ml-1.5 font-medium">{SPORT_ROW_LABEL[s]}</span>
                    </td>
                    {agg.map((a) => (
                      <td key={a.period.key} className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                        {a.sports[s].min ? `${fmtH(a.sports[s].min)} h` : "—"}
                        {a.sports[s].km ? <span className="ml-1 text-[10px]">({a.sports[s].km.toFixed(1)} km)</span> : null}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t bg-muted/40">
                  <td className="border-r px-2 py-1.5 font-medium">{t("analytics.volume.dryTraining")}</td>
                  {agg.map((a) => (
                    <td key={a.period.key} className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                      {a.dryMin ? `${fmtH(a.dryMin)} h` : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {loading && <p className="text-center text-xs text-muted-foreground">{t("analytics.volume.loading")}</p>}
      </CardContent>
    </Card>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function MiniChart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function PeriodPicker({
  label,
  value,
  onChange,
  months,
  years,
}: {
  label: string;
  value: { month: number; year: number };
  onChange: (v: { month: number; year: number }) => void;
  months: string[];
  years: number[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Select value={String(value.month)} onValueChange={(v) => onChange({ ...value, month: Number(v) })}>
        <SelectTrigger className="h-8 w-[130px] text-xs dark:border-white/[0.08] dark:bg-slate-800/80"><SelectValue /></SelectTrigger>
        <SelectContent>
          {months.map((m, i) => (
            <SelectItem key={m} value={String(i)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(value.year)} onValueChange={(v) => onChange({ ...value, year: Number(v) })}>
        <SelectTrigger className="h-8 w-[90px] text-xs dark:border-white/[0.08] dark:bg-slate-800/80"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
