import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { BarChart3 } from "lucide-react";
import { publicDb } from "@/lib/db";
import { parseShootingSets } from "@/lib/shooting";
import { useShootingSessions } from "@/hooks/useShootingSessions";
import ShootingAnalytics from "@/components/analytics/ShootingAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const currentSeasonStartYear = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function ShootingAnalyticsPanel({ athleteId }: { athleteId: string }) {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentSeasonStartYear());
  const start = useMemo(() => new Date(year, 3, 1), [year]);
  const end = useMemo(() => new Date(year + 1, 2, 31), [year]);
  const sessions = useShootingSessions(athleteId, iso(start), iso(end));
  const blocks = useQuery({
    queryKey: ["shooting-blocks", athleteId, year],
    queryFn: async () => {
      const { data, error } = await publicDb.from("training_blocks").select("*")
        .eq("athlete_id", athleteId).eq("plan_or_real", "real")
        .gte("block_date", iso(start)).lte("block_date", iso(end));
      if (error) throw error;
      return data ?? [];
    },
  });
  const seasons = Array.from({ length: 4 }, (_, i) => currentSeasonStartYear() - i);
  const loading = sessions.isLoading || blocks.isLoading;
  const b = blocks.data ?? [];
  const has = (sessions.data?.length ?? 0) > 0 || b.some(x => parseShootingSets((x as { shooting_sets?: unknown }).shooting_sets).length > 0);

  return <div className="space-y-4">
    <div className="flex justify-end">
      <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{seasons.map(y => <SelectItem key={y} value={String(y)}>{`${y}/${String(y + 1).slice(2)}`}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {loading ? <Skeleton className="h-80 w-full rounded-2xl" />
      : sessions.isError || blocks.isError ? <p role="alert" className="text-destructive">{t("zeroing.analyticsError")}</p>
      : has ? <ShootingAnalytics blocks={b} sessions={sessions.data ?? []} seasonStart={start} seasonEnd={end} />
      : <EmptyState icon={BarChart3} title={t("zeroing.emptyHistory", { defaultValue: "Zatím zde nejsou žádné záznamy" })} />}
  </div>;
}
