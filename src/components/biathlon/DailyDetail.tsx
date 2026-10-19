import { Copy } from "lucide-react";
import { format } from "date-fns";
import { parseShootingSets } from "@/lib/shooting";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Database } from "@/integrations/supabase/types";
import { sportLabel, Sport, SPORT_COLOR } from "@/lib/sports";
import { dateLocale } from "@/lib/dateLocale";
import { Zone, zoneBarClass, zoneShort } from "@/lib/zones";
import { minutesToDuration, getBlockSegments } from "./BlockEditor";
import { SlotLabel, highlightIntensity } from "@/lib/intensityText";
import { ReadinessResult, READINESS_BADGE } from "@/lib/readiness";
import { InfoPopover } from "@/components/ui/info-popover";



type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
type Slot = "rano" | "dopoledne" | "odpoledne";

const SLOTS: { key: Slot; label: string }[] = [
  { key: "dopoledne", label: "diary.slotMorningPart" },
  { key: "odpoledne", label: "diary.slotAfternoonPart" },
];

interface Props {
  date: Date;
  blocks: Block[];
  onAdd: (slot: Slot) => void;
  onOpen: (block: Block) => void;
  onCopy?: (block: Block) => void;
  canEdit: boolean;
  morningHr: number;
  onMorningHrChange: (val: string) => void;
  event?: { event_type: string; title: string } | null;
  sleep?: number;
  fatigue?: number;
  soreness?: number;
  onReadinessChange?: (key: "SLEEP" | "FATIGUE" | "SORENESS", val: number) => void;
  readiness?: ReadinessResult | null;
  /** Morning HR + readiness sections only make sense for real (executed) days, not plans. */
  showMorningData?: boolean;
}

function RatingRow({
  label, hint, tooltip, value, onChange, disabled,
}: { label: string; hint?: string; tooltip?: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {tooltip && (
            <InfoPopover label={tooltip} side="bottom" align="start" contentClassName="max-w-[min(260px,calc(100vw-24px))]">
              {tooltip}
            </InfoPopover>
          )}
        </div>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const tone = ["bg-emerald-500 border-emerald-500", "bg-lime-500 border-lime-500", "bg-amber-500 border-amber-500", "bg-orange-500 border-orange-500", "bg-red-500 border-red-500"][n - 1];
          return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`${label} ${n}`}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? 0 : n)}
            className={`h-7 w-7 rounded-md border text-xs font-semibold transition-all duration-150 ${
              value === n
                ? `${tone} scale-110 text-primary-foreground shadow-md`
                : "bg-background hover:bg-accent"
            } disabled:cursor-default disabled:opacity-60`}
          >
            {n}
          </button>
          );
        })}
      </div>
    </div>
  );
}


const EVENT_STYLE: Record<string, { cls: string; icon: string }> = {
  zavod: { cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40", icon: "🏁" },
  soustredeni: { cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40", icon: "🏕️" },
  volno: { cls: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/40", icon: "🌿" },
};

export default function DailyDetail({ date, blocks, onAdd, onOpen, onCopy, canEdit, morningHr, onMorningHrChange, event, sleep = 0, fatigue = 0, soreness = 0, onReadinessChange, readiness, showMorningData = true }: Props) {
  const { t, i18n } = useTranslation();
  const loc = dateLocale(i18n.language);
  const evStyle = event ? EVENT_STYLE[event.event_type] : null;
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-bold">{format(date, "EEEE", { locale: loc })}</h2>
          <p className="text-sm text-muted-foreground">{format(date, "d. MMMM yyyy", { locale: loc })}</p>
          {event && evStyle && (
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${evStyle.cls}`}>
              <span>{evStyle.icon}</span>
              <span>{t(`eventTypes.${event.event_type}`, { defaultValue: event.event_type })} – {event.title}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {SLOTS.map(({ key }) => {
          const slotBlocks = blocks.filter((b) => b.slot === key);
          return (
            <div key={key} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <SlotLabel slot={key} />

                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => onAdd(key)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {slotBlocks.length === 0 ? (
                <button
                  type="button"
                  onClick={() => canEdit && onAdd(key)}
                  disabled={!canEdit}
                  className="block w-full px-3 py-4 text-left text-xs text-muted-foreground hover:bg-accent disabled:cursor-default"
                >
                  {canEdit ? t("week.addBlock") : "—"}
                </button>
              ) : (
                <div className="divide-y">
                  {slotBlocks.map((b) => {
                    const segs = getBlockSegments(b);
                    return (
                    <div key={b.id} className="group relative">
                    {b.plan_or_real === "real" && (
                      <span aria-hidden className="pointer-events-none absolute inset-y-1 left-0 z-10 w-[3px] rounded-r-full" style={{ background: SPORT_COLOR[b.sport as Sport] }} />
                    )}
                    <button
                      type="button"
                      onClick={() => onOpen(b)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent/50 ${zoneBarClass(b.zone as Zone)}`}
                    >
                      <div className="min-w-0 flex-1">
                        {b.plan_or_real === "plan" ? (
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{highlightIntensity(b.notes ?? "")}</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{sportLabel(b.sport as Sport)}</span>
                              {b.strava_activity_id && (
                                <svg
                                  aria-label={t("stravaImported")}
                                  role="img"
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4 shrink-0"
                                  fill="#FC4C02"
                                >
                                  <title>{t("stravaImported")}</title>
                                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                                </svg>
                              )}
                              {segs.length > 0 ? (
                                segs.map((s, i) => (
                                  <span key={i} className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] font-bold">
                                    {zoneShort(s.zone)} {minutesToDuration(s.duration_minutes)}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] font-bold">
                                  {zoneShort(b.zone as Zone)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("week.blockTotal")} {minutesToDuration(b.duration_minutes)}
                              {b.distance_km ? ` · ${b.distance_km} km` : ""}
                              {b.avg_heart_rate ? ` · ${b.avg_heart_rate} bpm` : ""}
                              {b.rpe != null ? ` · RPE ${b.rpe}` : ""}
                              {b.shooting_shots ? ` · VN ${b.shooting_shots}` : ""}
                            </div>
                            {(() => {
                              const sets = parseShootingSets((b as { shooting_sets?: unknown }).shooting_sets);
                              if (!sets.some((s) => s.intensity)) return null;
                              return (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {sets.map((s, i) =>
                                    s.intensity ? (
                                      <span
                                        key={i}
                                        className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                                      >
                                        {i + 1}. {t(`shooting.intensity.${s.intensity}`, { defaultValue: s.intensity.toUpperCase() })}
                                      </span>
                                    ) : null,
                                  )}
                                </div>
                              );
                            })()}
                            {b.notes && <p className="mt-1 max-w-full overflow-hidden whitespace-pre-wrap break-words text-xs italic text-muted-foreground">{b.notes}</p>}
                          </>
                        )}
                      </div>
                    </button>
                    {onCopy && canEdit && (
                      <button type="button" aria-label={t("copyBlock.title")} title={t("copyBlock.title")} onClick={() => onCopy(b)}
                        className="absolute right-2 top-2 rounded-md border bg-card p-1 text-muted-foreground opacity-70 hover:text-foreground group-hover:opacity-100">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showMorningData && (
      <div className="rounded-lg border bg-card px-3 py-2.5">
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("week.morningHr")}
          </span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            disabled={!canEdit}
            value={morningHr || ""}
            onChange={(e) => onMorningHrChange(e.target.value)}
            placeholder="—"
            className="h-8 w-24 rounded-md border bg-background px-2 text-right text-sm outline-none focus:border-primary disabled:cursor-default disabled:opacity-60"
          />
        </label>

        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("readiness.title")}
            </span>
            {readiness && (
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${READINESS_BADGE[readiness.level]}`}>
                {t(`readiness.level.${readiness.level}`)} · {readiness.score}
              </span>
            )}
          </div>
          {readiness?.hrOnly && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">{t("readiness.hrOnlyNote")}</p>
          )}
          <RatingRow label={t("readiness.sleep")} hint={t("readiness.sleepHint")} tooltip={t("readiness.sleepTooltip")} value={sleep} disabled={!canEdit}
            onChange={(v) => onReadinessChange?.("SLEEP", v)} />
          <RatingRow label={t("readiness.fatigue")} hint={t("readiness.fatigueHint")} tooltip={t("readiness.fatigueTooltip")} value={fatigue} disabled={!canEdit}
            onChange={(v) => onReadinessChange?.("FATIGUE", v)} />
          <RatingRow label={t("readiness.soreness")} hint={t("readiness.sorenessHint")} tooltip={t("readiness.sorenessTooltip")} value={soreness} disabled={!canEdit}
            onChange={(v) => onReadinessChange?.("SORENESS", v)} />

        </div>
      </div>
      )}
    </div>
  );
}
