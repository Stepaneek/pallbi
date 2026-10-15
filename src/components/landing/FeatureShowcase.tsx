import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, LineChart, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Key = "diary" | "analytics" | "pdf";

const TABS: Array<{ key: Key; icon: typeof Calendar }> = [
  { key: "diary", icon: Calendar },
  { key: "analytics", icon: LineChart },
  { key: "pdf", icon: FileDown },
];

const DiaryMock = () => {
  const { t } = useTranslation();
  return (
  <div className="space-y-2">
    <div className="grid grid-cols-7 gap-1">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col items-center rounded-md border px-1 py-1.5 text-[10px] uppercase",
            i === 3 ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground",
          )}
        >
          {t(`days.short.${i}`)}
          <span className="text-sm font-bold text-foreground">{16 + i}</span>
        </div>
      ))}
    </div>
    <div className="space-y-1.5">
      {[
        { label: t("sports.row.beh"), zone: "I1", w: "72%", color: "bg-emerald-500" },
        { label: t("sports.row.kolo"), zone: "I2", w: "54%", color: "bg-sky-500" },
        { label: t("sports.row.lyze"), zone: "I3", w: "36%", color: "bg-amber-500" },
        { label: t("sports.row.osi"), zone: "VOL", w: "22%", color: "bg-muted-foreground/50" },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
          <span className="w-24 truncate text-xs font-semibold">{r.label}</span>
          <span className="w-9 text-[10px] font-bold text-muted-foreground">{r.zone}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", r.color)} style={{ width: r.w }} />
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};

const AnalyticsMock = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[
        { v: "412 h", color: "text-primary" },
        { v: "3 180 km", color: "text-emerald-500" },
        { v: "11,4 h/t", color: "text-amber-500" },
      ].map((s) => (
        <div key={s.v} className="rounded-md border bg-card px-2 py-2 text-center">
          <p className={cn("text-sm font-extrabold", s.color)}>{s.v}</p>
          <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-muted" />
        </div>
      ))}
    </div>
    <div className="flex h-32 items-end gap-1.5 rounded-md border bg-card p-3">
      {[38, 52, 44, 66, 58, 74, 62, 88, 70, 94, 80, 100].map((h, i) => (
        <div key={i} className="flex-1 rounded-t bg-primary/80" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

const PdfMock = () => (
  <div className="mx-auto max-w-[280px] rounded-md border bg-card p-4 shadow-sm">
    <div className="h-2 w-24 rounded-full bg-primary" />
    <div className="mt-3 space-y-1.5">
      {[100, 88, 94, 70, 82, 60].map((w, i) => (
        <div key={i} className="h-1.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
      ))}
    </div>
    <div className="mt-4 grid grid-cols-6 gap-1">
      {["bg-muted-foreground/40", "bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-orange-500", "bg-rose-500"].map((c, i) => (
        <div key={i} className={cn("h-10 self-end rounded-t", c)} style={{ height: `${18 + i * 8}px` }} />
      ))}
    </div>
  </div>
);

export default function FeatureShowcase() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Key>("diary");

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("landing.showcaseTitle")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("landing.showcaseSubtitle")}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                "flex min-w-[220px] items-start gap-3 rounded-xl border p-4 text-left transition-colors md:min-w-0",
                active === key ? "border-primary bg-primary/5" : "bg-card hover:bg-accent",
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", active === key ? "text-primary" : "text-muted-foreground")} strokeWidth={2.25} />
              <div>
                <h3 className="text-sm font-semibold">{t(`landing.showcase.${key}Title`)}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(`landing.showcase.${key}Text`)}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-secondary/30 p-4 shadow-sm md:p-6">
          {active === "diary" && <DiaryMock />}
          {active === "analytics" && <AnalyticsMock />}
          {active === "pdf" && <PdfMock />}
        </div>
      </div>
    </section>
  );
}
