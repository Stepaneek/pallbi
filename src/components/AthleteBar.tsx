import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { publicDb } from "@/lib/db";
import { cn } from "@/lib/utils";

type Athlete = { id: string; name: string | null };

const initials = (n: string | null) =>
  (n ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** Horizontal athlete switcher with today's logging status dot. */
export default function AthleteBar({ athletes, value, onChange }: { athletes: Athlete[]; value: string | null; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const today = format(new Date(), "yyyy-MM-dd");
  const ids = athletes.map((a) => a.id);
  const status = useQuery({
    queryKey: ["athlete-bar-today", today, ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await publicDb.from("training_blocks").select("athlete_id, plan_or_real").in("athlete_id", ids).eq("block_date", today);
      const rows = (data ?? []) as { athlete_id: string; plan_or_real: string }[];
      return {
        done: new Set(rows.filter((r) => r.plan_or_real === "real").map((r) => r.athlete_id)),
        planned: new Set(rows.filter((r) => r.plan_or_real === "plan").map((r) => r.athlete_id)),
      };
    },
  });
  return (
    <div role="radiogroup" aria-label={t("athleteBar.label")} className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
      {athletes.map((a) => {
        const active = a.id === value;
        const done = status.data?.done.has(a.id);
        const pending = !done && status.data?.planned.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={done || pending ? `${a.name ?? "—"} · ${t(done ? "athleteBar.done" : "athleteBar.pending")}` : (a.name ?? "—")}
            onClick={() => onChange(a.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-[13px] font-semibold transition-colors active:scale-95",
              active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
              {initials(a.name)}
              {(done || pending) && (
                <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", done ? "bg-success" : "bg-warning")} />
              )}
            </span>
            <span className="max-w-[140px] truncate">{a.name ?? "—"}</span>
          </button>
        );
      })}
    </div>
  );
}
