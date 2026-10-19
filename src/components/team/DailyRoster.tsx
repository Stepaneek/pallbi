import { useTranslation } from "react-i18next";
import { Check, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { READINESS_BADGE, ReadinessLevel } from "@/lib/readiness";
import { sportLabel } from "@/lib/sports";
import type { Sport } from "@/lib/sports";

type B = { athlete_id: string; block_date: string; plan_or_real: string; sport: string; duration_minutes: number; zone: string; strava_activity_id: string | null; shooting_hits: number | null; shooting_shots: number | null };
type Row = { athlete: { id: string; name: string | null }; readiness: { level: string; score: number } | null; readinessDetail: { dayIndex: number; morningHr?: number } };

const summary = (list: B[]) =>
  list.length ? list.map((b) => `${sportLabel(b.sport as Sport)} ${b.zone?.toUpperCase?.() ?? ""} ${b.duration_minutes} min`).join(" + ") : "—";

/** One-glance table of today's state for every visible athlete. */
export default function DailyRoster({ rows, blocks, dayIso, dayIndex, onOpen }: { rows: Row[]; blocks: B[]; dayIso: string; dayIndex: number; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">{t("team.roster.title")} · {t(`days.short.${dayIndex}`)}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                {["athlete", "readiness", "plan", "real", "shooting"].map((k) => <th key={k} className="whitespace-nowrap px-4 py-2 font-medium">{t(`team.roster.${k}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const own = blocks.filter((b) => b.athlete_id === r.athlete.id && b.block_date === dayIso);
                const plan = own.filter((b) => b.plan_or_real === "plan" && b.sport !== "strelba");
                const real = own.filter((b) => b.plan_or_real === "real" && b.sport !== "strelba");
                const shots = own.filter((b) => b.plan_or_real === "real").reduce((s, b) => s + (b.shooting_shots ?? 0), 0);
                const hits = own.filter((b) => b.plan_or_real === "real").reduce((s, b) => s + (b.shooting_hits ?? 0), 0);
                const sameDay = r.readinessDetail.dayIndex === dayIndex;
                return (
                  <tr key={r.athlete.id} className="cursor-pointer border-t hover:bg-accent/40" onClick={() => onOpen(r.athlete.id)}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.athlete.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {r.readiness && sameDay ? (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${READINESS_BADGE[r.readiness.level as ReadinessLevel]}`}>
                          {r.readiness.score}{r.readinessDetail.morningHr ? ` · ${r.readinessDetail.morningHr} bpm` : ""}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{summary(plan)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        {real.length ? <Check className="h-4 w-4 shrink-0 text-success" /> : plan.length ? <Clock className="h-4 w-4 shrink-0 text-warning" /> : null}
                        {summary(real)}
                        {real.some((b) => b.strava_activity_id) && <span className="text-xs font-semibold text-primary">Strava</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{shots ? `${hits}/${shots} · ${Math.round((hits / shots) * 100)} %` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
