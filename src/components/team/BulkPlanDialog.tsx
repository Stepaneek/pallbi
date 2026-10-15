import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { publicDb } from "@/lib/db";
import { SPORTS, Sport, sportLabel } from "@/lib/sports";
import { ZONES, Zone, zoneLabel } from "@/lib/zones";
import { AthleteGroup } from "@/hooks/useAthleteGroups";

type Slot = "rano" | "dopoledne" | "odpoledne";
type Target = "all" | "group" | "custom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  athletes: { id: string; name: string | null }[];
  groups: AthleteGroup[];
  athleteIdsInGroup: (groupId: string) => string[];
  defaultDate: string;
  onSaved?: () => void;
}

export default function BulkPlanDialog({
  open, onOpenChange, athletes, groups, athleteIdsInGroup, defaultDate, onSaved,
}: Props) {
  const { t } = useTranslation();
  const [date, setDate] = useState(defaultDate);
  const [slot, setSlot] = useState<Slot>("dopoledne");
  const [sport, setSport] = useState<Sport>("beh");
  const [zone, setZone] = useState<Zone>("I1");
  const [minutes, setMinutes] = useState("60");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<Target>("all");
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const targetIds = useMemo(() => {
    if (target === "all") return athletes.map((a) => a.id);
    if (target === "group") return groupId ? athleteIdsInGroup(groupId).filter((id) => athletes.some((a) => a.id === id)) : [];
    return picked;
  }, [target, groupId, picked, athletes, athleteIdsInGroup]);

  const submit = async () => {
    if (!targetIds.length) return toast.error(t("bulk.noTargets"));
    if (!date) return toast.error(t("bulk.noDate"));
    const dur = Math.max(0, parseInt(minutes, 10) || 0);
    setSaving(true);
    const rows = targetIds.map((athlete_id) => ({
      athlete_id,
      block_date: date,
      slot,
      plan_or_real: "plan" as const,
      sport,
      zone,
      duration_minutes: dur,
      distance_km: distance ? Number(distance) : null,
      notes: notes || null,
      segments: dur > 0 ? [{ zone, duration_minutes: dur }] : [],
    }));
    const { error } = await publicDb.from("training_blocks").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("bulk.saved", { count: rows.length }));
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bulk.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("bulk.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("bulk.slot")}</Label>
              <Select value={slot} onValueChange={(v) => setSlot(v as Slot)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dopoledne">{t("diary.slotMorningPart")}</SelectItem>
                  <SelectItem value="odpoledne">{t("diary.slotAfternoonPart")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("bulk.sport")}</Label>
              <Select value={sport} onValueChange={(v) => setSport(v as Sport)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => <SelectItem key={s} value={s}>{sportLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("bulk.zone")}</Label>
              <Select value={zone} onValueChange={(v) => setZone(v as Zone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{zoneLabel(z)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("bulk.minutes")}</Label>
              <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("bulk.distance")}</Label>
              <Input type="number" min={0} step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("bulk.notes")}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("bulk.notesPlaceholder")} />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>{t("bulk.assignTo")}</Label>
            <div className="flex flex-wrap gap-2">
              {(["all", "group", "custom"] as Target[]).map((k) => (
                <Button key={k} type="button" size="sm" variant={target === k ? "default" : "outline"} onClick={() => setTarget(k)}>
                  {t(`bulk.target.${k}`)}
                </Button>
              ))}
            </div>

            {target === "group" && (
              groups.length ? (
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder={t("bulk.pickGroup")} /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">{t("groups.empty")}</p>
              )
            )}

            {target === "custom" && (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {athletes.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.includes(a.id)}
                      onCheckedChange={(c) =>
                        setPicked((prev) => (c ? [...prev, a.id] : prev.filter((x) => x !== a.id)))
                      }
                    />
                    {a.name ?? "—"}
                  </label>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t("bulk.selectedCount", { count: targetIds.length })}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={saving || !targetIds.length}>
            {saving ? t("common.saving") : t("bulk.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
