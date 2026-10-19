import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Maximize2, X, Target, RotateCcw, Undo2, Save, History, Loader2, Trash2, BarChart3 } from "lucide-react";
import { ShootingAnalyticsPanel } from "./ShootingAnalyticsPanel";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { publicDb } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AthleteBar from "@/components/AthleteBar";
import { ZeroingTarget } from "./ZeroingTarget";
import { appendZeroingShot, groupCenter, offsetMm, clockHour, formatClock, parseZeroingShots, MAX_ZEROING_SHOTS, type Shot, type ZeroStance } from "@/lib/zeroing";

type ItemType = "zeroing" | "training" | "race";
const parseShots = parseZeroingShots;
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
  const [section, setSection] = useState<"record" | "analytics">("record");
  const [itemType, setItemType] = useState<ItemType>("zeroing");
  const [intensity, setIntensity] = useState<string | null>(null);
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [field, setField] = useState(false);
  useEffect(() => { setShots([]); setNotes(""); setIntensity(null); setPage(0); }, [athleteId]);
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
  const save = async () => {
    if (!user || !athleteId || !center || !date || saving) return;
    setSaving(true);
    try {
      const { error } = await publicDb.from("shooting_sessions").insert({
        athlete_id: athleteId, author_id: user.id, session_date: date, item_type: itemType, stance,
        shots, center_x_mm: center.x, center_y_mm: center.y, offset_mm: offsetMm(center), clock_hour: clockHour(center),
        intensity: itemType === "race" ? "i5" : itemType === "training" ? intensity : null, notes: notes.trim() || null,
      });
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["shooting-sessions", athleteId] });
      setShots([]); setNotes(""); setIntensity(null); setPage(0); setTab("history");
      toast.success(t("zeroing.saved"));
    } catch { toast.error(t("zeroing.saveError")); }
    finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const { error } = await publicDb.from("shooting_sessions").delete().eq("id", deleteId);
      if (error) throw error;
      if (history.data?.rows.length === 1 && page > 0) setPage(p => p - 1);
      await client.invalidateQueries({ queryKey: ["shooting-sessions", athleteId] });
      toast.success(t("zeroing.deleted"));
      setDeleteId(null);
    } catch { toast.error(t("zeroing.deleteError")); }
    finally { setDeleting(false); }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Target className="h-6 w-6 text-primary" />{t("zeroing.title")}</h2>
      <Tabs value={section} onValueChange={v => setSection(v as "record" | "analytics")}><TabsList><TabsTrigger value="record"><History className="mr-2 h-4 w-4" />{t("zeroing.sectionRecord", { defaultValue: "Záznam & Historie" })}</TabsTrigger><TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />{t("zeroing.sectionAnalytics", { defaultValue: "Střelecká analytika" })}</TabsTrigger></TabsList></Tabs>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3">
    {isCoach ? <div className="min-w-0 max-w-full space-y-1.5"><Label>{t("zeroing.athlete")}</Label><AthleteBar athletes={athletes} value={athleteId ?? null} onChange={id => { if (!saving) setViewingAthleteId(id); }} /></div> : <div />}
    {section === "record" && <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="zeroing">{t("zeroing.new")}</TabsTrigger><TabsTrigger value="history">{t("zeroing.history")}</TabsTrigger></TabsList></Tabs>}
    </div>
    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : !athleteId ? <p className="text-muted-foreground">{t("zeroing.noAthlete")}</p> : section === "analytics" ? <ShootingAnalyticsPanel athleteId={athleteId} /> : tab === "zeroing" ?
      <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="zeroing-date">{t("zeroing.date")}</Label><Input id="zeroing-date" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={saving} /></div>
            <div className="space-y-1.5"><Label htmlFor="zeroing-type">{t("zeroing.type")}</Label><Select value={itemType} onValueChange={v => setItemType(v as ItemType)} disabled={saving}><SelectTrigger id="zeroing-type"><SelectValue /></SelectTrigger><SelectContent>{(["zeroing", "training", "race"] as const).map(type => <SelectItem key={type} value={type}>{t(`zeroing.types.${type}`)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {itemType === "training" && <div className="space-y-2"><Label>{t("zeroing.intensity")}</Label><div className="grid grid-cols-5 gap-1" role="group" aria-label={t("zeroing.intensity")}>{["i1", "i2", "i3", "i4", "i5"].map(value => <Button key={value} variant={intensity === value ? "default" : "outline"} disabled={saving} aria-pressed={intensity === value} onClick={() => setIntensity(value)}>{value.toUpperCase()}</Button>)}</div></div>}
          {itemType === "race" && <div className="space-y-2"><Label>{t("zeroing.intensity")}</Label><div className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold" aria-label={t("zeroing.intensity")}>I5</div></div>}
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
          </div>
          <div className="space-y-1.5"><Label htmlFor="zeroing-notes">{t("zeroing.notes")}</Label><Textarea id="zeroing-notes" value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} rows={2} /></div>
          <Button className="w-full whitespace-normal" disabled={!center || !date || saving} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{t(saving ? "zeroing.saving" : "zeroing.save")}</Button>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="mx-auto max-w-[560px] overflow-hidden rounded-md border"><ZeroingTarget stance={stance} shots={shots} onShot={shot => { if (!saving) { navigator.vibrate?.(15); setShots(prev => appendZeroingShot(prev, shot)); } }} /></div>
          <Button variant="outline" className="w-full" onClick={() => setField(true)}><Maximize2 />{t("zeroing.fieldMode")}</Button>
          {field && createPortal(<div className="fixed inset-0 z-50 flex flex-col gap-3 bg-canvas p-3" role="dialog" aria-modal="true" aria-label={t("zeroing.fieldMode")}>
            <div className="relative z-10 flex shrink-0 items-center justify-between"><span className="text-lg font-bold tabular-nums">{t(`zeroing.stances.${stance}`)} · {shots.length} / {MAX_ZEROING_SHOTS}</span><Button variant="ghost" size="icon" aria-label={t("zeroing.closeField")} onClick={() => setField(false)}><X className="h-6 w-6" /></Button></div>
            <div className="flex min-h-0 flex-1 items-center justify-center"><div className="aspect-square w-full max-w-[min(100%,calc(100vh-170px))] overflow-hidden rounded-md border"><ZeroingTarget stance={stance} shots={shots} onShot={shot => { if (!saving) { navigator.vibrate?.(15); setShots(prev => appendZeroingShot(prev, shot)); } }} /></div></div>
            <div className="grid grid-cols-3 gap-2"><Button variant="outline" className="h-14 text-base" disabled={!shots.length || saving} onClick={() => setShots(prev => prev.slice(0, -1))}><Undo2 />{t("zeroing.undo")}</Button><Button variant="outline" className="h-14 text-base" disabled={!shots.length || saving} onClick={() => setShots([])}><RotateCcw />{t("zeroing.clear")}</Button><Button className="h-14 text-base" disabled={!center || !date || saving} onClick={async () => { await save(); setField(false); }}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{t("zeroing.saveShort")}</Button></div>
          </div>, document.body)}
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{t("zeroing.target")}</span><span>{shots.length} / {MAX_ZEROING_SHOTS}</span></div>
          <div className="border-t pt-3"><h3 className="mb-2 text-sm font-semibold">{t("zeroing.shots")}</h3>{!shots.length ? <p className="text-sm text-muted-foreground">{t("zeroing.noShots")}</p> : <ol className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums sm:grid-cols-3">{shots.map((s, i) => <li key={i}>#{i + 1}: X {decimal(s.x)}, Y {decimal(s.y)} mm</li>)}</ol>}</div>
        </div>
      </div> : <div className="space-y-4">
        {history.isLoading ? <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div> : history.isError ? <div role="alert"><p>{t("zeroing.loadError")}</p><Button variant="outline" onClick={() => history.refetch()}>{t("zeroing.retry")}</Button></div> : !history.data?.rows.length ? <EmptyState icon={Target} title={t("zeroing.emptyHistory")} actionLabel={t("zeroing.emptyAction")} onAction={() => setTab("zeroing")} /> : history.data.rows.map(row => <details key={row.id} className="rounded-md border bg-card p-4">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2"><span className="inline-flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="font-semibold">{format(new Date(`${row.session_date}T12:00:00`), "dd.MM.yyyy")}</span><span>{t(`zeroing.types.${row.item_type}`)} · {t(`zeroing.stances.${row.stance}`)}{row.intensity ? ` · ${row.intensity.toUpperCase()}` : ""}</span><span>{parseShots(row.shots).length} {t("zeroing.shotsShort")} · {decimal(row.offset_mm)} mm · {formatClock(row.clock_hour)}</span></span><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={t("zeroing.delete")} onClick={e => { e.preventDefault(); e.stopPropagation(); setDeleteId(row.id); }}><Trash2 className="h-4 w-4" /></Button></summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="max-w-[320px] overflow-hidden rounded-md"><ZeroingTarget stance={row.stance === "standing" ? "standing" : "prone"} shots={parseShots(row.shots)} /></div><div className="space-y-3 text-sm"><p>{t("zeroing.center")}: X {decimal(row.center_x_mm)}, Y {decimal(row.center_y_mm)} mm</p><ol className="space-y-1 tabular-nums">{parseShots(row.shots).map((s, i) => <li key={i}>#{i + 1}: X {decimal(s.x)}, Y {decimal(s.y)} mm</li>)}</ol>{row.notes && <p className="whitespace-pre-wrap break-words text-muted-foreground">{row.notes}</p>}</div></div>
        </details>)}
        <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("zeroing.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("zeroing.deleteConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("zeroing.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={e => { e.preventDefault(); confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>{deleting ? <Loader2 className="animate-spin" /> : <Trash2 className="h-4 w-4" />}{t("zeroing.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {(history.data?.count ?? 0) > 20 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("zeroing.previous")}</Button><span>{page + 1}</span><Button variant="outline" disabled={(page + 1) * 20 >= (history.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>{t("zeroing.next")}</Button></div>}
      </div>}
  </section>;
}
