import { useMemo, useState } from "react";
import { format, parseISO, startOfISOWeek, subDays } from "date-fns";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";
import { dateLocale } from "@/lib/dateLocale";
import {
  CLOCK_POSITIONS,
  SHOOTING_INTENSITIES,
  ShootingEntry,
  Stance,
  collectShootingEntries,
  collectDigitalShootingEntries,
  missDistribution,
  shootingStats,
  stanceLabel,
} from "@/lib/shooting";

const pct = (v: number | null) => (v == null ? "–" : `${v.toFixed(1)} %`);
const sec = (v: number | null) => (v == null ? "–" : `${v.toFixed(1)} s`);


type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

type Timeframe = "week" | "month" | "season";

interface Props {
  blocks: Block[];
  sessions: Database["public"]["Tables"]["shooting_sessions"]["Row"][];
  seasonStart: Date;
  seasonEnd: Date;
}

/** SVG biathlon target with a heat plot of misses per clock position (1–12). */
function TargetVisualizer({ counts }: { counts: number[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...counts.slice(1));
  const size = 260;
  const c = size / 2;
  const ring = 96;
  const dotAt = (pos: number) => {
    const angle = ((pos % 12) * 30 - 90) * (Math.PI / 180);
    return { x: c + ring * Math.cos(angle), y: c + ring * Math.sin(angle) };
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[240px] w-[240px]">
      <circle cx={c} cy={c} r={118} fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
      <circle cx={c} cy={c} r={70} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <circle cx={c} cy={c} r={26} fill="hsl(var(--foreground))" opacity={0.85} />
      {CLOCK_POSITIONS.map((pos) => {
        const n = counts[pos] || 0;
        const { x, y } = dotAt(pos);
        const r = n ? 8 + (n / max) * 14 : 5;
        return (
          <g key={pos}>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={n ? "hsl(var(--zone-i5, 0 84% 60%))" : "hsl(var(--muted-foreground))"}
              opacity={n ? 0.35 + 0.55 * (n / max) : 0.25}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={n ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
            >
              {n || pos}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


function StanceSection({ stance, entries }: { stance: Stance; entries: ShootingEntry[] }) {
  const { t, i18n } = useTranslation();
  const counts = useMemo(() => missDistribution(entries), [entries]);
  const totalMisses = entries.reduce((a, e) => a + e.misses, 0);

  const clockText = (e: ShootingEntry) =>
    e.miss_clock.length
      ? e.miss_clock.map((c) => t("shooting.oclock", { n: c })).join(", ")
      : "–";


  const stats = useMemo(() => shootingStats(entries), [entries]);

  return (
    <Card className="dark:border-white/[0.08]">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wider">
          <Target size={16} className="text-muted-foreground" /> {stanceLabel(stance)}
          {entries.length > 0 && (
            <span className="ml-auto font-bold normal-case tracking-normal text-primary">
              {t("shooting.accuracy")}: {pct(stats.accuracy)}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("shooting.empty")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <TargetVisualizer counts={counts} />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {t("shooting.targetHint", { count: totalMisses })}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md border p-2 dark:border-white/[0.08]">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("shooting.avgFirstShot", { defaultValue: "Ø čas 1. rány" })}
                  </p>
                  <p className="text-sm font-bold tabular-nums">{sec(stats.avgFirstShot)}</p>
                </div>
                <div className="rounded-md border p-2 dark:border-white/[0.08]">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("shooting.avgTime")}
                  </p>
                  <p className="text-sm font-bold tabular-nums">{sec(stats.avgTotal)}</p>
                </div>
              </div>
            </div>

            <div className="max-h-[260px] overflow-y-auto rounded-md border dark:border-white/[0.08]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 font-semibold">{t("shooting.tableDate")}</th>
                    <th className="px-2 py-1.5 font-semibold">{t("shooting.misses")}</th>
                    <th className="px-2 py-1.5 font-semibold">{t("shooting.tableIntensity")}</th>
                    <th className="px-2 py-1.5 font-semibold">{t("shooting.missDirection")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={`${e.date}-${i}`} className={i % 2 ? "bg-muted/30" : undefined}>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                        {format(parseISO(e.date), "d. M. yyyy", { locale: dateLocale(i18n.language) })}
                      </td>
                      <td className="px-2 py-1.5 font-semibold tabular-nums">{e.misses}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {e.intensity ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {t(`shooting.intensity.${e.intensity}`)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{clockText(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShootingAnalytics({ blocks, sessions, seasonStart, seasonEnd }: Props) {
  const { t } = useTranslation();
  const [timeframe, setTimeframe] = useState<Timeframe>("season");
  const [intensityFilter, setIntensityFilter] = useState<string>("all");

  const range = useMemo(() => {
    const today = new Date();
    if (timeframe === "week") return { start: startOfISOWeek(today), end: today };
    if (timeframe === "month") return { start: subDays(today, 29), end: today };
    return { start: seasonStart, end: seasonEnd };
  }, [timeframe, seasonStart, seasonEnd]);

  const entries = useMemo(() => {
    const inRange = blocks.filter((b) => {
      const d = parseISO(b.block_date);
      return d >= range.start && d <= range.end;
    });
    const digital = sessions.filter(session => {
      const d = parseISO(session.session_date);
      return d >= range.start && d <= range.end;
    });
    const all = [...collectShootingEntries(inRange), ...collectDigitalShootingEntries(digital)]
      .sort((a, b) => b.date.localeCompare(a.date));
    if (intensityFilter === "all") return all;
    return all.filter((e) => e.intensity === intensityFilter);
  }, [blocks, sessions, range.start, range.end, intensityFilter]);

  const prone = useMemo(() => entries.filter((e) => e.stance === "prone"), [entries]);
  const standing = useMemo(() => entries.filter((e) => e.stance === "standing"), [entries]);
  const all = useMemo(() => shootingStats(entries), [entries]);
  const proneStats = useMemo(() => shootingStats(prone), [prone]);
  const standingStats = useMemo(() => shootingStats(standing), [standing]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
          <Target size={16} className="text-muted-foreground" /> {t("shooting.title")}
        </h2>
        <div className="flex items-center gap-2">
          <Select value={intensityFilter} onValueChange={setIntensityFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs dark:border-white/[0.08] dark:bg-slate-800/80"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("shooting.intensityAll")}</SelectItem>
              {SHOOTING_INTENSITIES.map((i) => (
                <SelectItem key={i} value={i}>{t(`shooting.intensity.${i}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="h-8 w-[130px] text-xs dark:border-white/[0.08] dark:bg-slate-800/80"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t("shooting.tfWeek")}</SelectItem>
              <SelectItem value="month">{t("shooting.tfMonth")}</SelectItem>
              <SelectItem value="season">{t("shooting.tfSeason")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="dark:border-white/[0.08]">
        <CardContent className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
          {[
            { label: t("shooting.shots"), value: all.shots },
            { label: t("zeroing.hits"), value: all.hits },
            { label: t("shooting.misses"), value: all.misses },
            { label: t("zeroing.missPercentage"), value: pct(all.shots ? all.misses / all.shots * 100 : null) },
            { label: `${t("shooting.accuracy")} — ${t("shooting.allStances")}`, value: pct(all.accuracy) },
            { label: `${t("shooting.accuracy")} — ${stanceLabel("prone")}`, value: pct(proneStats.accuracy) },
            { label: `${t("shooting.accuracy")} — ${stanceLabel("standing")}`, value: pct(standingStats.accuracy) },
            { label: t("shooting.avgFirstShot", { defaultValue: "Ø čas 1. rány" }), value: sec(all.avgFirstShot) },
            { label: t("shooting.avgTime"), value: sec(all.avgTotal) },
          ].map((s) => (
            <div key={s.label} className="rounded-md border p-2 text-center dark:border-white/[0.08]">
              <p className="text-[10px] uppercase leading-tight tracking-wider text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 text-base font-bold tabular-nums">{s.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <StanceSection stance="prone" entries={prone} />

      <StanceSection stance="standing" entries={standing} />
    </div>
  );
}
