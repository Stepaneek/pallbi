import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/integrations/supabase/types";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

/** Copy one training block to another date and/or other athletes. */
export default function CopyBlockDialog({ block, athletes, onClose, onDone }: {
  block: Block | null;
  athletes: { id: string; name: string | null }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (block) { setDate(block.block_date); setTargets([block.athlete_id]); } }, [block]);

  const copy = async () => {
    if (!block || !date || !targets.length) return;
    setBusy(true);
    let ok = 0;
    for (const athlete_id of targets) {
      const { data, error } = await supabase.functions.invoke("training-block-save", {
        body: {
          id: null, athlete_id, block_date: date, slot: block.slot, plan_or_real: block.plan_or_real,
          sport: block.sport, zone: block.zone, duration_minutes: block.duration_minutes, segments: block.segments,
          distance_km: block.distance_km, avg_heart_rate: block.avg_heart_rate, rpe: block.rpe, notes: block.notes,
          shooting_hits: block.shooting_hits, shooting_shots: block.shooting_shots, shooting_sets: block.shooting_sets,
          shooting_intensity: block.shooting_intensity,
        },
      });
      if (!error && !(data as { error?: string } | null)?.error) ok++;
    }
    setBusy(false);
    if (ok === targets.length) toast.success(t("copyBlock.done", { count: ok }));
    else toast.error(t("copyBlock.partial", { ok, total: targets.length }));
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!block} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t("copyBlock.title")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="copy-date">{t("copyBlock.date")}</Label><Input id="copy-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {athletes.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>{t("copyBlock.athletes")}</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTargets(targets.length === athletes.length ? [] : athletes.map((a) => a.id))}>{t("copyBlock.all")}</Button></div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {athletes.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={targets.includes(a.id)} onCheckedChange={(c) => setTargets((p) => (c ? [...p, a.id] : p.filter((x) => x !== a.id)))} />
                    {a.name ?? "—"}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("common.cancel", { defaultValue: "Zrušit" })}</Button>
          <Button onClick={copy} disabled={busy || !date || !targets.length}>{busy ? <Loader2 className="animate-spin" /> : <Copy />}{t("copyBlock.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
