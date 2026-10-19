import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Target, RotateCcw, Undo2, Save, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { publicDb } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZeroingTarget } from "./ZeroingTarget";
import { appendZeroingShot, groupCenter, offsetMm, clockHour, formatClock, corrections, DEFAULT_CLICK_MM, MAX_ZEROING_SHOTS, type Shot, type ZeroStance } from "@/lib/zeroing";

type ItemType = "zeroing" | "training" | "race";
const parseShots = (raw: unknown): Shot[] => Array.isArray(raw) ? raw.filter((s): s is Shot => !!s && typeof s === "object" && typeof s.x === "number" && typeof s.y === "number") : [];
const decimal = (n: number) => n.toFixed(1);

export function ShootingZeroingView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isCoach, athletes, viewingAthleteId, setViewingAthleteId, loading } = useRole();
  const athleteId = isCoach ? viewingAthleteId : user?.id;
  const client = useQueryClient();
  const [stance, setStance] = useState<ZeroStance>("prone");
  const [shots, setShots] = useState<Shot[]>([]);
  const [tab, setTab] = useState("zeroing");
  const [itemType, setItemType] = useState<ItemType>("zeroing");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { setShots([]); setNotes(""); setPage(0); }, [athleteId]);
  const history = useQuery({
    queryKey: ["shooting-sessions", athleteId, page],
    enabled: !!athleteId && tab === "history",
    queryFn: async () => {
      if (!athleteId) return { rows: [], count: 0 };
      const { data, error, count } = await publicDb.from("shooting_sessions").select("*", { count: "exact" })
        .eq("athlete_id", athleteId).order("session_date", { ascending: false }).order("created_at", { ascending: false }).range(page * 20, page * 20 + 19);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const center = groupCenter(shots);
  const correctionText = (vertical: number, horizontal: number) => {
    const parts = [];
    if (vertical) parts.push(t(vertical > 0 ? "zeroing.up" : "zeroing.down", { count: Math.abs(vertical) }));
    if (horizontal) parts.push(t(horizontal > 0 ? "zeroing.right" : "zeroing.left", { count: Math.abs(horizontal) }));
    return parts.join(", ") || t("zeroing.noCorrection");
  };
  const fix = center ? corrections(center) : null;
  const save = async () => {
    if (!user || !athleteId || !center || !date || saving) return;
    setSaving(true);
    try {
      const clicks = corrections(center);
      const { error } = await publicDb.from("shooting_sessions").insert({
        athlete_id: athleteId, author_id: user.id, session_date: date, item_type: itemType, stance,
        shots, center_x_mm: center.x, center_y_mm: center.y, offset_mm: offsetMm(center), clock_hour: clockHour(center),
        click_mm: DEFAULT_CLICK_MM, clicks_vertical: clicks.vertical, clicks_horizontal: clicks.horizontal, notes: notes.trim() || null,
      });
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["shooting-sessions", athleteId] });
      setShots([]); setNotes(""); setPage(0); setTab("history");
      toast.success(t("zeroing.saved"));
    } catch { toast.error(t("zeroing.saveError")); }
    finally { setSaving(false); }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Target className="h-6 w-6 text-primary" />{t("zeroing.title")}</h2>
      <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="zeroing">{t("zeroing.new")}</TabsTrigger><TabsTrigger value="history"><History className="mr-2 h-4 w-4" />{t("zeroing.history")}</TabsTrigger></TabsList></Tabs>
    </div>
    {isCoach && <div className="max-w-sm space-y-1.5"><Label htmlFor="zeroing-athlete">{t("zeroing.athlete")}</Label>
      <Select value={athleteId ?? ""} onValueChange={setViewingAthleteId} disabled={saving || loading}><SelectTrigger id="zeroing-athlete"><SelectValue placeholder={t("zeroing.selectAthlete")} /></SelectTrigger>
        <SelectContent>{athletes.map(a => <SelectItem key={a.id} value={a.id}>{a.name ?? t("zeroing.unnamedAthlete")}</SelectItem>)}</SelectContent></Select>
    </div>}
    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : !athleteId ? <p className="text-muted-foreground">{t("zeroing.noAthlete")}</p> : tab === "zeroing" ?
      <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="zeroing-date">{t("zeroing.date")}</Label><Input id="zeroing-date" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={saving} /></div>
            <div className="space-y-1.5"><Label htmlFor="zeroing-type">{t("zeroing.type")}</Label><Select value={itemType} onValueChange={v => setItemType(v as ItemType)} disabled={saving}><SelectTrigger id="zeroing-type"><SelectValue /></SelectTrigger><SelectContent>{(["zeroing", "training", "race"] as const).map(type => <SelectItem key={type} value={type}>{t(`zeroing.types.${type}`)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>{t("zeroing.stance")}</Label><div className="grid grid-cols-2 gap-2">{(["prone", "standing"] as const).map(s => <Button key={s} variant={stance === s ? "default" : "outline"} className="h-auto min-h-14 flex-col gap-0.5 whitespace-normal" disabled={saving} aria-pressed={stance === s} onClick={() => { if (s !== stance) { setStance(s); setShots([]); } }}><span>{t(`zeroing.stances.${s}`)}</span><span className="text-xs font-normal">{s === "prone" ? "45" : "115"} mm</span></Button>)}</div></div>
          <div className="flex gap-2"><Button variant="outline" className="flex-1" disabled={!shots.length || saving} onClick={() => setShots(prev => prev.slice(0, -1))}><Undo2 />{t("zeroing.undo")}</Button><Button variant="outline" className="flex-1" disabled={!shots.length || saving} onClick={() => setShots([])}><RotateCcw />{t("zeroing.clear")}</Button></div>
          <div className="border-y py-4">
            <h3 className="mb-3 font-semibold">{t("zeroing.results")}</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("zeroing.shotCount")}</dt><dd className="font-semibold tabular-nums">{shots.length} / {MAX_ZEROING_SHOTS}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{t("zeroing.center")}</dt><dd className="font-semibold tabular-nums">{center ? `X ${decimal(center.x)}, Y ${decimal(center.y)} mm` : "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("zeroing.offset")}</dt><dd className="font-semibold">{center ? `${decimal(offsetMm(center))} mm` : "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("zeroing.clock")}</dt><dd className="font-semibold">{center ? formatClock(clockHour(center)) : "—"}</dd></div>
            </dl>
            <div className="mt-4 border-t pt-3"><p className="text-sm text-muted-foreground">{t("zeroing.correction")}</p><p className="mt-1 text-lg font-bold text-primary" aria-live="polite">{fix ? correctionText(fix.vertical, fix.horizontal) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{t("zeroing.calibration")}</p></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="zeroing-notes">{t("zeroing.notes")}</Label><Textarea id="zeroing-notes" value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} rows={2} /></div>
          <Button className="w-full whitespace-normal" disabled={!center || !date || saving} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{t(saving ? "zeroing.saving" : "zeroing.save")}</Button>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="mx-auto max-w-[560px] overflow-hidden rounded-md border"><ZeroingTarget stance={stance} shots={shots} onShot={shot => { if (!saving) setShots(prev => appendZeroingShot(prev, shot)); }} /></div>
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{t("zeroing.target")}</span><span>{shots.length} / {MAX_ZEROING_SHOTS}</span></div>
          <div className="border-t pt-3"><h3 className="mb-2 text-sm font-semibold">{t("zeroing.shots")}</h3>{!shots.length ? <p className="text-sm text-muted-foreground">{t("zeroing.noShots")}</p> : <ol className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums sm:grid-cols-3">{shots.map((s, i) => <li key={i}>#{i + 1}: X {decimal(s.x)}, Y {decimal(s.y)} mm</li>)}</ol>}</div>
        </div>
      </div> : <div className="space-y-4">
        {history.isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : history.isError ? <div role="alert"><p>{t("zeroing.loadError")}</p><Button variant="outline" onClick={() => history.refetch()}>{t("zeroing.retry")}</Button></div> : !history.data?.rows.length ? <p className="py-12 text-center text-muted-foreground">{t("zeroing.emptyHistory")}</p> : history.data.rows.map(row => <details key={row.id} className="rounded-md border bg-card p-4">
          <summary className="cursor-pointer"><span className="inline-flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="font-semibold">{format(new Date(`${row.session_date}T12:00:00`), "dd.MM.yyyy")}</span><span>{t(`zeroing.types.${row.item_type}`)} · {t(`zeroing.stances.${row.stance}`)}</span><span>{parseShots(row.shots).length} {t("zeroing.shotsShort")} · {decimal(row.offset_mm)} mm · {formatClock(row.clock_hour)}</span><span className="font-semibold text-primary">{correctionText(row.clicks_vertical, row.clicks_horizontal)}</span></span></summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="max-w-[320px] overflow-hidden rounded-md"><ZeroingTarget stance={row.stance === "standing" ? "standing" : "prone"} shots={parseShots(row.shots)} /></div><div className="space-y-3 text-sm"><p>{t("zeroing.center")}: X {decimal(row.center_x_mm)}, Y {decimal(row.center_y_mm)} mm</p><ol className="space-y-1 tabular-nums">{parseShots(row.shots).map((s, i) => <li key={i}>#{i + 1}: X {decimal(s.x)}, Y {decimal(s.y)} mm</li>)}</ol>{row.notes && <p className="whitespace-pre-wrap break-words text-muted-foreground">{row.notes}</p>}</div></div>
        </details>)}
        {(history.data?.count ?? 0) > 20 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("zeroing.previous")}</Button><span>{page + 1}</span><Button variant="outline" disabled={(page + 1) * 20 >= (history.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>{t("zeroing.next")}</Button></div>}
      </div>}
  </section>;
}
