import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import { Database } from "@/integrations/supabase/types";
import { dateLocale } from "@/lib/dateLocale";
import { isoDate } from "@/lib/week";
import { computeLoadSeries, dailyLoadMap, formState } from "@/lib/trainingLoad";
import { isSeasonSeedBlock } from "@/lib/seasonSeed";


type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

const COLOR_CTL = "#60A5FA";
const COLOR_ATL = "#FB7185";
const COLOR_TSB = "#A3E635";

const STATE_CLASS: Record<string, string> = {
  fresh: "text-sky-600 dark:text-sky-400",
  optimal: "text-lime-600 dark:text-lime-400",
  neutral: "text-muted-foreground",
  tired: "text-amber-600 dark:text-amber-400",
  overreached: "text-red-600 dark:text-red-400",
};

export default function FitnessFatigue({
  blocks,
  start,
  end,
}: {
  blocks: Block[];
  start: Date;
  end: Date;
}) {
  const { t, i18n } = useTranslation();
  const loc = dateLocale(i18n.language);

  const series = useMemo(() => {
    const today = new Date();
    const last = end < today ? end : today;
    const dates: string[] = [];
    for (let d = new Date(start); d <= last; d = addDays(d, 1)) dates.push(isoDate(d));
    if (!dates.length) return [];
    const loads = dailyLoadMap(blocks.filter((b) => !isSeasonSeedBlock(b)) as unknown as Parameters<typeof dailyLoadMap>[0]);
    return computeLoadSeries(dates, loads).map((p) => ({
      ...p,
      label: format(new Date(`${p.date}T00:00:00`), "d.M.", { locale: loc }),
    }));
  }, [blocks, start, end, loc]);

  const current = series.length ? series[series.length - 1] : null;
  const state = current ? formState(current.tsb) : null;

  return (
    <Card className="dark:border-white/[0.08]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("analytics.load.title")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("analytics.load.subtitle")}</p>
          </div>
          <InfoPopover
            label={t("analytics.load.info")}
            side="left"
            triggerClassName="mt-0.5"
            iconClassName="h-4 w-4"
            contentClassName="space-y-2"
          >
            <p className="font-semibold">{t("analytics.load.info")}</p>
            <p>{t("analytics.load.ctlTooltip")}</p>
            <p>{t("analytics.load.atlTooltip")}</p>
            <div>
              <p>{t("analytics.load.tsbTooltip")}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                <li>{t("analytics.load.tsbDetraining")}</li>
                <li>{t("analytics.load.tsbWindow")}</li>
                <li>{t("analytics.load.tsbNeutral")}</li>
                <li>{t("analytics.load.tsbTraining")}</li>
                <li>{t("analytics.load.tsbRisk")}</li>
              </ul>
            </div>
          </InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {current && (
          <div className="grid grid-cols-3 gap-2">
            <Metric label={t("analytics.load.fitness")} value={current.ctl} color={COLOR_CTL} hint={t("analytics.load.fitnessHint")} />
            <Metric label={t("analytics.load.fatigue")} value={current.atl} color={COLOR_ATL} hint={t("analytics.load.fatigueHint")} />
            <Metric label={t("analytics.load.form")} value={current.tsb} color={COLOR_TSB} hint={t("analytics.load.formHint")} />
          </div>
        )}
        {state && (
          <p className="text-xs">
            <span className="text-muted-foreground">{t("analytics.load.stateLabel")}: </span>
            <span className={`font-semibold ${STATE_CLASS[state]}`}>{t(`analytics.load.state.${state}`)}</span>
          </p>
        )}
        <div className="h-[300px]">
          {series.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("analytics.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tsbGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_TSB} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={COLOR_TSB} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={28} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  y={0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.7}
                  strokeWidth={1.25}
                  strokeDasharray="6 4"
                  label={{ value: "0", position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  dataKey="tsb"
                  name={t("analytics.load.form")}
                  stroke={COLOR_TSB}
                  fill="url(#tsbGradient)"
                  strokeWidth={1.5}
                />
                <Line type="monotone" dataKey="ctl" name={t("analytics.load.fitness")} stroke={COLOR_CTL} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="atl" name={t("analytics.load.fatigue")} stroke={COLOR_ATL} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, color, hint }: { label: string; value: number; color: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 dark:border-white/[0.08]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
        {value.toFixed(1)}
      </p>
      <p className="text-[10px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}
