import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sport, SPORTS, sportLabel } from "@/lib/sports";
import { Zone, ZONES, zoneLabel } from "@/lib/zones";
import { useTranslation } from "react-i18next";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { waitForAuthSession } from "@/lib/db";
import { Trash2, Plus, X, BookmarkPlus } from "lucide-react";
import { listTemplates, saveTemplate, deleteTemplate, type WorkoutTemplate } from "@/lib/workoutTemplates";
import StravaHrChart from "./StravaHrChart";
import ShootingSets from "./ShootingSets";
import { parseShootingSets, type ShootingSet } from "@/lib/shooting";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
type Slot = "rano" | "dopoledne" | "odpoledne";

export type Segment = { zone: Zone; duration_minutes: number };

export function durationToMinutes(s: string): number {
  if (!s) return 0;
  const m = s.match(/^(\d{1,3}):(\d{1,2})$/);
  if (!m) {
    const just = parseInt(s, 10);
    return Number.isFinite(just) ? just : 0;
  }
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
export function minutesToDuration(min: number): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Parse segments out of a block row (handles legacy blocks without segments). */
export function getBlockSegments(b: { segments?: unknown; zone?: string; duration_minutes?: number } | null | undefined): Segment[] {
  if (!b) return [];
  const raw = (b as { segments?: unknown }).segments;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((s) => ({
        zone: ((s as { zone?: string })?.zone ?? "VOLNA") as Zone,
        duration_minutes: Number((s as { duration_minutes?: number })?.duration_minutes) || 0,
      }))
      .filter((s) => ZONES.includes(s.zone));
  }
  if (b.zone && b.duration_minutes && b.duration_minutes > 0) {
    return [{ zone: b.zone as Zone, duration_minutes: b.duration_minutes }];
  }
  return [];
}

export function sumSegments(segs: Segment[]): number {
  return segs.reduce((a, s) => a + (s.duration_minutes || 0), 0);
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  athleteId: string;
  blockDate: string; // yyyy-mm-dd
  slot: Slot;
  planOrReal: "plan" | "real";
  existing: Block | null;
  canEdit: boolean;
  onSaved: (block: Block, message?: string) => void;
  onDeleted: (id: string) => void;
}

type SegmentDraft = { zone: Zone; duration: string };

const emptySegment = (): SegmentDraft => ({ zone: "I1", duration: "" });

// Tolerantní parsování čísel z inputu: prázdné => null, podporuje českou desetinnou čárku.
// Vrací NaN pro nevalidní vstup, aby backend vyhodil čitelnou chybu místo tichého null.
function parseDecimal(s: string): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function parseInteger(s: string): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(",", ".");
  if (t === "") return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : NaN;
}

export default function BlockEditor({ open, onOpenChange, athleteId, blockDate, slot, planOrReal, existing, canEdit, onSaved, onDeleted }: Props) {
  const { t } = useTranslation();
  const [sport, setSport] = useState<Sport>("beh");
  const [segments, setSegments] = useState<SegmentDraft[]>([emptySegment()]);
  const [distance, setDistance] = useState("");
  const [hr, setHr] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [planMinutes, setPlanMinutes] = useState("");
  const [hits, setHits] = useState("");
  const [shots, setShots] = useState("");
  const [shootingSets, setShootingSets] = useState<ShootingSet[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isBiathlete, setIsBiathlete] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const draftKey = `bl_draft:${athleteId}:${blockDate}:${slot}:${planOrReal}:${existing?.id ?? "new"}`;
  const isFreeTextPlan = planOrReal === "plan";

  useEffect(() => {
    if (!open || !athleteId) return;
    let cancelled = false;
    supabase.from("profiles").select("is_biathlete").eq("id", athleteId).maybeSingle().then(({ data }) => {
      if (!cancelled) setIsBiathlete(!!(data as { is_biathlete?: boolean } | null)?.is_biathlete);
    });
    return () => { cancelled = true; };
  }, [open, athleteId]);

  useEffect(() => {
    if (open && athleteId) setTemplates(listTemplates(athleteId));
  }, [open, athleteId]);

  useEffect(() => {
    if (open) {
      setSaveError(null);
      let draft: any = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) draft = JSON.parse(raw);
      } catch { /* ignore */ }

      const src = draft ?? existing;
      setSport((src?.sport as Sport) ?? "beh");

      // Segments: prefer draft, then existing.segments, then legacy single zone/duration
      let segs: SegmentDraft[] = [];
      if (draft?.segments && Array.isArray(draft.segments) && draft.segments.length) {
        segs = draft.segments.map((s: any) => ({
          zone: (s?.zone ?? "I1") as Zone,
          duration: typeof s?.duration === "string" ? s.duration : minutesToDuration(Number(s?.duration_minutes) || 0),
        }));
      } else if (existing) {
        const fromBlock = getBlockSegments(existing);
        segs = fromBlock.length
          ? fromBlock.map((s) => ({ zone: s.zone, duration: minutesToDuration(s.duration_minutes) }))
          : [emptySegment()];
      } else {
        segs = [emptySegment()];
      }
      setSegments(segs.length ? segs : [emptySegment()]);

      // Pozor: prázdný string z draftu by jinak přepsal hodnotu z DB; bereme draft jen pokud má reálnou hodnotu.
      setDistance(draft?.distance ? draft.distance : (existing?.distance_km != null ? String(existing.distance_km) : ""));
      setHr(draft?.hr ? draft.hr : (existing?.avg_heart_rate != null ? String(existing.avg_heart_rate) : ""));
      setRpe(draft?.rpe ? draft.rpe : (existing?.rpe != null ? String(existing.rpe) : ""));
      setNotes(draft?.notes ?? existing?.notes ?? "");
      setPlanMinutes(
        draft?.planMinutes ? draft.planMinutes : (existing?.duration_minutes ? String(existing.duration_minutes) : ""),
      );
      setHits(draft?.hits ? draft.hits : (existing?.shooting_hits != null ? String(existing.shooting_hits) : ""));
      setShots(draft?.shots ? draft.shots : (existing?.shooting_shots != null ? String(existing.shooting_shots) : ""));
      setShootingSets(
        parseShootingSets(
          draft?.shootingSets && Array.isArray(draft.shootingSets) && draft.shootingSets.length
            ? draft.shootingSets
            : (existing as { shooting_sets?: unknown } | null)?.shooting_sets,
        ),
      );

    }
  }, [open, existing, draftKey, planOrReal]);

  const persistDraft = () => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ sport, segments, distance, hr, rpe, notes, hits, shots, planMinutes, shootingSets }),
      );
    } catch { /* quota — ignore */ }
  };

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  };



  const totalMinutes = segments.reduce((a, s) => a + durationToMinutes(s.duration), 0);

  const updateSegment = (idx: number, patch: Partial<SegmentDraft>) => {
    setSegments((curr) => curr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addSegment = () => setSegments((curr) => [...curr, emptySegment()]);
  const removeSegment = (idx: number) =>
    setSegments((curr) => (curr.length <= 1 ? curr : curr.filter((_, i) => i !== idx)));

  const applyTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setSport(tpl.sport as Sport);
    setSegments(
      tpl.segments.length
        ? tpl.segments.map((sg) => ({ zone: sg.zone as Zone, duration: sg.duration }))
        : [emptySegment()],
    );
    setDistance(tpl.distance ?? "");
    setNotes(tpl.notes ?? "");
    toast.success(t("block.templateApplied", { name: tpl.name }));
  };

  const handleSaveTemplate = () => {
    const usable = segments.filter((sg) => durationToMinutes(sg.duration) > 0);
    if (!usable.length) return toast.error(t("block.errNoSegment"));
    const name = window.prompt(t("block.templateNamePrompt"), sportLabel(sport))?.trim();
    if (!name) return;
    saveTemplate(athleteId, { name, sport, segments: usable, distance, notes });
    setTemplates(listTemplates(athleteId));
    toast.success(t("block.templateSaved"));
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(deleteTemplate(athleteId, id));
  };

  const handleSave = async () => {
    const isFreeText = isFreeTextPlan;

    let normSegs: Segment[] = [];
    let totalMin = 0;
    let dominantZone: Zone = "VOLNA";

    if (isFreeText) {
      if (!notes.trim()) return toast.error(t("block.errPlanNotes"));
      totalMin = Math.max(0, parseInteger(planMinutes) ?? 0);
    } else {
      normSegs = segments
        .map((s) => ({ zone: s.zone, duration_minutes: durationToMinutes(s.duration) }))
        .filter((s) => s.duration_minutes > 0);
      if (!normSegs.length) return toast.error(t("block.errNoSegment"));
      totalMin = normSegs.reduce((a, s) => a + s.duration_minutes, 0);
      dominantZone = [...normSegs].sort((a, b) => b.duration_minutes - a.duration_minutes)[0].zone;
    }

    const session = await waitForAuthSession();
    if (!session?.user) {
      setSaveError(t("block.errSession"));
      return;
    }
    setSaving(true);

    const payload = {
      athlete_id: athleteId,
      block_date: blockDate,
      slot,
      plan_or_real: planOrReal,
      sport,
      zone: dominantZone,
      duration_minutes: totalMin,
      segments: normSegs,
      distance_km: isFreeText ? null : parseDecimal(distance),
      avg_heart_rate: isFreeText ? null : parseInteger(hr),
      rpe: isFreeText ? null : parseInteger(rpe),
      notes: notes.trim() || null,
      shooting_hits: null,
      shooting_shots: isFreeText || !isBiathlete ? null : parseInteger(shots),
      shooting_intensity: null,
      shooting_sets: isFreeText || !isBiathlete
        ? []
        : shootingSets.map((x) => ({
            stance: x.stance,
            misses: x.misses,
            miss_clock: x.miss_clock.filter((c) => c >= 1 && c <= 12),
            intensity: x.intensity ?? null,
            first_shot_seconds: x.first_shot_seconds ?? null,
            total_seconds: x.total_seconds ?? null,
          })),

    };

    persistDraft();
    setSaveError(null);
    setTestResult(null);
    console.log("Supabase training block save payload", { existingId: existing?.id ?? null, payload });
    const body = { id: existing?.id ?? null, ...payload };
    let data: { block?: Block; error?: string } | null = null;
    let error: { message?: string } | null = null;
    try {
      const response = await supabase.functions.invoke("training-block-save", { body });
      data = response.data as { block?: Block; error?: string } | null;
      error = response.error;
    } catch (error) {
      console.log("Training block save exception", error);
      setSaving(false);
      setSaveError(error instanceof Error ? error.message : t("block.errSaveBackend"));
      return;
    }
    setSaving(false);
    if (error || data?.error || !data?.block) {
      console.log("Training block save error", { error, data });
      setSaveError(data?.error ?? error?.message ?? t("block.errSave"));
      return;
    }
    const savedId = data.block.id;
    console.log("Training block save result", data.block);
    clearDraft();
    setTestResult(t("block.savedCheck"));
    toast.success(t("block.saved"));
    onSaved(data.block, t("block.savedCheck"));
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm(t("block.confirmDelete"))) return;
    const { data, error } = await supabase.functions.invoke("training-block-save", {
      body: { action: "delete", id: existing.id, athlete_id: existing.athlete_id, plan_or_real: existing.plan_or_real },
    });
    if (error || data?.error) return toast.error(data?.error ?? error?.message ?? t("block.errDelete"));
    toast.success(t("block.deleted"));
    onDeleted(existing.id);
    onOpenChange(false);
  };

  const slotLabel: Record<Slot, string> = {
    rano: t("slots.dopoledne"),
    dopoledne: t("slots.dopoledne"),
    odpoledne: t("slots.odpoledne"),
  };

  const hasStrava = planOrReal === "real" && !!existing?.strava_activity_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex max-h-[90vh] flex-col p-0 ${hasStrava ? "max-w-md lg:max-w-5xl lg:w-[80vw]" : "max-w-md"}`}>
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle>
            {slotLabel[slot]} – {planOrReal === "plan" ? t("common.plan") : t("common.real")}
          </DialogTitle>
          <DialogDescription>{t("block.desc")}</DialogDescription>
        </DialogHeader>

        <div className={`flex-1 overflow-y-auto px-6 py-4 ${hasStrava ? "lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 space-y-3" : "space-y-3"}`}>
          <div className="space-y-3">
          {isFreeTextPlan ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="plan-duration">{t("block.planDuration")}</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={planMinutes}
                  onChange={(e) => setPlanMinutes(e.target.value)}
                  placeholder="90"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
              <Label>{t("block.planNotes")}</Label>
              <Textarea
                rows={10}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("block.planPlaceholder")}
                disabled={!canEdit}
                className="min-h-[200px]"
              />
              </div>
            </div>
          ) : (
            <>
              {!existing && canEdit && templates.length > 0 && (
                <div className="space-y-1 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider">{t("block.templates")}</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("block.templatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name} · {sportLabel(tpl.sport as Sport)} · {minutesToDuration(tpl.segments.reduce((a, sg) => a + durationToMinutes(sg.duration), 0))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                        aria-label={`${t("block.templateDelete")}: ${tpl.name}`}
                      >
                        {tpl.name} <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>{t("block.sport")}</Label>
                <Select
                  value={sport}
                  onValueChange={(v) => {
                    const next = v as Sport;
                    setSport(next);
                    if (next === "osi" || next === "strelba") {
                      setSegments((curr) => [{ zone: "VOLNA", duration: curr[0]?.duration ?? "" }]);
                    }
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPORTS.map((s) => <SelectItem key={s} value={s}>{sportLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Segments */}
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider">{t("block.segments")}</Label>
                  <span className="text-xs font-semibold text-primary">
                    {t("block.total")}: {minutesToDuration(totalMinutes) || "0:00"}
                  </span>
                </div>
                <div className="space-y-2">
                  {segments.map((seg, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {sport !== "osi" && sport !== "strelba" && (
                        <Select
                          value={seg.zone}
                          onValueChange={(v) => updateSegment(idx, { zone: v as Zone })}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ZONES.map((z) => <SelectItem key={z} value={z}>{zoneLabel(z)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        className={sport === "osi" || sport === "strelba" ? "h-9 flex-1" : "h-9 w-24"}
                        value={seg.duration}
                        onChange={(e) => updateSegment(idx, { duration: e.target.value })}
                        placeholder="0:30"
                        disabled={!canEdit}
                      />
                      {canEdit && sport !== "osi" && sport !== "strelba" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSegment(idx)}
                          disabled={segments.length <= 1}
                          aria-label={t("block.removeSegment")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && sport !== "osi" && sport !== "strelba" && (
                  <Button type="button" variant="outline" size="sm" onClick={addSegment} className="w-full">
                    <Plus className="mr-1 h-4 w-4" /> {t("block.addSegment")}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("block.distance")}</Label>
                  <Input value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="12.5" disabled={!canEdit} />
                </div>
                <div className="space-y-1">
                  <Label>{t("block.hr")}</Label>
                  <Input value={hr} onChange={(e) => setHr(e.target.value)} placeholder="145" disabled={!canEdit} />
                </div>
              </div>

              <div className={isBiathlete ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                <div className="space-y-1">
                  <Label>{t("block.rpe")}</Label>
                  <Input value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="6" disabled={!canEdit} />
                </div>
                {isBiathlete && (
                  <div className="space-y-1">
                    <Label>{t("block.shots")}</Label>
                    <Input value={shots} onChange={(e) => setShots(e.target.value)} placeholder="20" disabled={!canEdit} />
                  </div>
                )}
              </div>

              {isBiathlete && (
                <ShootingSets sets={shootingSets} onChange={setShootingSets} disabled={!canEdit} />
              )}


              <div className="space-y-1">
                <Label>{t("block.notes")}</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
              </div>
            </>
          )}

          </div>
          {hasStrava && existing?.strava_activity_id && (
            <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              <StravaHrChart athleteId={existing.athlete_id} activityId={existing.strava_activity_id} />
            </div>
          )}
          <div className="space-y-3 lg:col-span-2">




          {saveError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{t("block.errSave")}</p>
              <p className="mt-1 text-xs">{saveError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleSave} disabled={saving}>
                {t("block.retry")}
              </Button>
            </div>
          )}

          {testResult && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
              {testResult}
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="flex justify-between border-t bg-background p-4 sm:justify-between">
          <div>
            {existing && canEdit && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-1 h-4 w-4" /> {t("block.delete")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {canEdit && !isFreeTextPlan && (
              <Button variant="ghost" size="sm" onClick={handleSaveTemplate}>
                <BookmarkPlus className="mr-1 h-4 w-4" /> {t("block.saveTemplate")}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("block.close")}</Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("block.saving") : t("block.save")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
