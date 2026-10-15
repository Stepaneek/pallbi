import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, X } from "lucide-react";
import {
  CLOCK_POSITIONS,
  DEFAULT_SHOTS,
  SHOOTING_INTENSITIES,
  STANCES,
  ShootingSet,
  type ShootingIntensity,
  Stance,
  stanceLabel,
} from "@/lib/shooting";

interface Props {
  sets: ShootingSet[];
  onChange: (sets: ShootingSet[]) => void;
  disabled?: boolean;
}

const emptySet = (): ShootingSet => ({
  stance: "prone",
  misses: 0,
  miss_clock: [],
  shots: 5,
  intensity: null,
  first_shot_seconds: null,
  total_seconds: null,
});
/** every set is fixed at 5 shots */
const shotsOf = (_set: ShootingSet) => DEFAULT_SHOTS;
const secOrNull = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 10) / 10;
};


export default function ShootingSets({ sets, onChange, disabled }: Props) {
  const { t } = useTranslation();

  const patch = (idx: number, p: Partial<ShootingSet>) =>
    onChange(sets.map((s, i) => (i === idx ? { ...s, ...p } : s)));

  /** Keep one clock slot per miss (unset slots are omitted). */
  const clockSlots = (set: ShootingSet): number[] => {
    const arr = set.miss_clock.filter((c) => c > 0 && c <= 12);
    while (arr.length < set.misses) arr.push(-1);
    return arr.slice(0, set.misses);
  };

  const setMisses = (idx: number, misses: number) => {
    // misses can never exceed the number of shots in the set
    const clamped = Math.min(shotsOf(sets[idx]), Math.max(0, misses));
    patch(idx, {
      misses: clamped,
      miss_clock: sets[idx].miss_clock.filter((c) => c > 0 && c <= 12).slice(0, clamped),
    });
  };


  const setClock = (idx: number, missIdx: number, pos: number) => {
    const arr = clockSlots(sets[idx]);
    arr[missIdx] = pos;
    patch(idx, { miss_clock: arr.filter((c) => c > 0 && c <= 12) });
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider">{t("shooting.title")}</Label>
        {sets.length > 0 && (
          <span className="text-xs font-semibold text-primary">
            {t("shooting.missesTotal", {
              count: sets.reduce((a, s) => a + s.misses, 0),
              defaultValue: "Chyb: {{count}}",
            })}
          </span>
        )}
      </div>

      {sets.map((set, idx) => (
        <div key={idx} className="space-y-2 rounded-md border bg-card p-2">
          <div className="flex items-center justify-between border-b pb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {idx + 1}. {t("shooting.setLabel", { defaultValue: "Položka" })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={set.stance}
              onValueChange={(v) => patch(idx, { stance: v as Stance })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANCES.map((s) => <SelectItem key={s} value={s}>{stanceLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex w-36 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-8 shrink-0"
                onClick={() => setMisses(idx, set.misses - 1)}
                disabled={disabled || set.misses <= 0}
                aria-label={t("common.decrease", { defaultValue: "Snížit" })}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                className="h-9 flex-1 text-center"
                type="number"
                min={0}
                max={shotsOf(set)}
                step={1}
                value={set.misses}
                placeholder={t("shooting.misses")}
                aria-label={t("shooting.misses")}
                onChange={(e) => setMisses(idx, parseInt(e.target.value, 10) || 0)}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-8 shrink-0"
                onClick={() => setMisses(idx, set.misses + 1)}
                disabled={disabled || set.misses >= shotsOf(set)}
                aria-label={t("common.increase", { defaultValue: "Zvýšit" })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(sets.filter((_, i) => i !== idx))}
                aria-label={t("shooting.removeSet")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("shooting.firstShotTime", { defaultValue: "Čas 1. rány (s)" })}
              </Label>
              <Input
                className="h-9"
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={set.first_shot_seconds ?? ""}
                placeholder="–"
                onChange={(e) => patch(idx, { first_shot_seconds: secOrNull(e.target.value) })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("shooting.totalTime", { defaultValue: "Celkový čas položky (s)" })}
              </Label>
              <Input
                className="h-9"
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={set.total_seconds ?? ""}
                placeholder="–"
                onChange={(e) => patch(idx, { total_seconds: secOrNull(e.target.value) })}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("shooting.intensity.label", { defaultValue: "Intenzita střelby" })}
            </Label>
            <Select
              value={set.intensity ?? "none"}
              onValueChange={(v) => patch(idx, { intensity: v === "none" ? null : (v as ShootingIntensity) })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("shooting.intensity.none", { defaultValue: "Neuvedeno" })}</SelectItem>
                {SHOOTING_INTENSITIES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`shooting.intensity.${k}`, { defaultValue: k.toUpperCase() })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          {set.misses > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("shooting.missDirection")}
              </p>
              <div className="space-y-1.5">
                {clockSlots(set).map((pos, missIdx) => (
                  <div key={missIdx} className="flex items-start gap-1.5">
                    <span className="w-12 shrink-0 pt-1.5 text-[11px] text-muted-foreground">
                      {t("shooting.missNo", { n: missIdx + 1 })}
                    </span>
                    <div className="grid grid-cols-6 gap-1">
                      {CLOCK_POSITIONS.map((c) => {
                        const selected = pos === c;
                        return (
                          <Button
                            key={c}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-10 px-0 text-xs"
                            onClick={() => setClock(idx, missIdx, c)}
                            disabled={disabled}
                            aria-label={t("shooting.oclock", { n: c })}
                            aria-pressed={selected}
                          >
                            {c}h
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange([...sets, emptySet()])}>
          <Plus className="mr-1 h-4 w-4" /> {t("shooting.addSet")}
        </Button>
      )}
    </div>
  );
}

