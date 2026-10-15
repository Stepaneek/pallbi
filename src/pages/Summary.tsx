import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown, ImageDown } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfISOWeek,
  endOfISOWeek,
  addMonths,
  subMonths,
  addDays,
  format,
  getISOWeek,
} from "date-fns";
import { useTranslation } from "react-i18next";
import { dateLocale } from "@/lib/dateLocale";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { isoDate, fmtMin } from "@/lib/week";
import { isSeasonSeedBlock } from "@/lib/seasonSeed";
import { TRAINING_ZONES, zoneLabel, Zone, zoneClass } from "@/lib/zones";
import { Sport, sportRowLabel, SPORT_COLOR } from "@/lib/sports";
import { exportMonthPdf } from "@/lib/pdfExport";
import { exportNodeAsPng } from "@/lib/pngExport";
import { toast } from "sonner";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

type RawSegment = { zone?: string; duration_minutes?: number };

function blockSegments(b: Block): { zone: Zone; duration_minutes: number }[] {
  const raw = (b as unknown as { segments?: unknown }).segments;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: { zone: Zone; duration_minutes: number }[] = [];
  for (const s of raw as RawSegment[]) {
    const z = s?.zone as Zone | undefined;
    const d = Number(s?.duration_minutes) || 0;
    if (z && d > 0) out.push({ zone: z, duration_minutes: d });
  }
  return out;
}

const KM_SPORTS: Sport[] = ["beh", "kolo", "kolobezka_lyze", "lyze", "plavani", "ostatni"];

function fmtKm(v: number): string {
  if (!v) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function Summary() {
  const { t, i18n } = useTranslation();
  const { athletes, viewingAthleteId, setViewingAthleteId, loading: roleLoading } = useRole();
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [planOrReal, setPlanOrReal] = useState<"plan" | "real">("real");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setReloadKey((k) => k + 1);
  }, [location.key]);

  const athleteId = viewingAthleteId;

  // Compute weeks in the month (full ISO weeks intersecting the month).
  // Pracujeme s ISO datem (yyyy-MM-dd), abychom se vyhli problemum se zacatkem/koncem dne.
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const firstWeekStart = startOfISOWeek(monthStart);
    const lastWeekStart = startOfISOWeek(monthEnd);
    const out: { start: Date; end: Date; startIso: string; endIso: string; isoWeek: number }[] = [];
    let cur = firstWeekStart;
    while (cur <= lastWeekStart) {
      const end = addDays(cur, 6);
      out.push({
        start: cur,
        end,
        startIso: isoDate(cur),
        endIso: isoDate(end),
        isoWeek: getISOWeek(cur),
      });
      cur = addDays(cur, 7);
    }
    return out;
  }, [anchor]);

  const rangeStart = weeks[0]?.start;
  const rangeEnd = weeks[weeks.length - 1]?.end;

  useEffect(() => {
    if (!athleteId || !rangeStart || !rangeEnd) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.functions.invoke("training-week-load", {
        body: {
          athlete_id: athleteId,
          plan_or_real: planOrReal,
          start: isoDate(rangeStart),
          end: isoDate(rangeEnd),
        },
      });
      if (cancelled) return;
      const payload = data as { blocks?: Block[]; error?: string } | null;
      if (err || payload?.error) {
        setError(payload?.error || err?.message || t("week.loadFailed"));
        setBlocks([]);
      } else {
        setBlocks(payload?.blocks ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, planOrReal, rangeStart?.getTime(), rangeEnd?.getTime(), reloadKey]);

  // Aggregate per week column
  const data = useMemo(() => {
    const W = weeks.length;
    const empty = () => Array.from({ length: W }, () => 0);

    const totalMin = empty();
    const totalKm = empty();
    const suchyMin = empty();
    const kmBySport: Record<Sport, number[]> = {
      beh: empty(), kolo: empty(), kolobezka_lyze: empty(), lyze: empty(), plavani: empty(), ostatni: empty(), strelba: empty(), osi: empty(),
    };
    const minByZone: Record<Zone, number[]> = {
      VOLNA: empty(), I1: empty(), I2: empty(), I3: empty(), I4: empty(), I5: empty(), I6: empty(),
    };

    // Month-only totals: strict date filter (startOfMonth..endOfMonth),
    // so days of edge weeks belonging to a different month are excluded.
    const monthStartIso = isoDate(startOfMonth(anchor));
    const monthEndIso = isoDate(endOfMonth(anchor));
    const inMonth = (iso: string) => {
      const d = iso.slice(0, 10);
      return d >= monthStartIso && d <= monthEndIso;
    };
    let mTotalMin = 0;
    let mTotalKm = 0;
    let mSuchyMin = 0;
    const mKmBySport: Record<Sport, number> = {
      beh: 0, kolo: 0, kolobezka_lyze: 0, lyze: 0, plavani: 0, ostatni: 0, strelba: 0, osi: 0,
    };
    const mMinByZone: Record<Zone, number> = {
      VOLNA: 0, I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0,
    };

    const colOf = (iso: string): number => {
      const d = iso.slice(0, 10);
      for (let i = 0; i < W; i++) {
        if (d >= weeks[i].startIso && d <= weeks[i].endIso) return i;
      }
      return -1;
    };

    for (const b of blocks) {
      if (isSeasonSeedBlock(b)) continue;
      const col = colOf(b.block_date);
      const inM = inMonth(b.block_date);
      if (col < 0) continue;

      if (b.sport === "strelba") {
        const segs = blockSegments(b);
        if (segs.length) {
          for (const s of segs) {
            suchyMin[col] += s.duration_minutes;
            if (inM) mSuchyMin += s.duration_minutes;
          }
        } else {
          const m = b.duration_minutes || 0;
          suchyMin[col] += m;
          if (inM) mSuchyMin += m;
        }
        continue;
      }

      // Km
      const km = Number(b.distance_km) || 0;
      if (km && kmBySport[b.sport as Sport]) {
        kmBySport[b.sport as Sport][col] += km;
        totalKm[col] += km;
        if (inM) {
          mKmBySport[b.sport as Sport] += km;
          mTotalKm += km;
        }
      }

      // Minutes by zone (segments-aware)
      const segs = blockSegments(b);
      if (segs.length) {
        for (const s of segs) {
          if (!minByZone[s.zone]) continue;
          minByZone[s.zone][col] += s.duration_minutes;
          totalMin[col] += s.duration_minutes;
          if (inM) {
            mMinByZone[s.zone] += s.duration_minutes;
            mTotalMin += s.duration_minutes;
          }
        }
      } else {
        const m = b.duration_minutes || 0;
        if (m && minByZone[b.zone as Zone]) {
          minByZone[b.zone as Zone][col] += m;
          totalMin[col] += m;
          if (inM) {
            mMinByZone[b.zone as Zone] += m;
            mTotalMin += m;
          }
        }
      }
    }

    return { totalMin, totalKm, kmBySport, minByZone, suchyMin, mTotalMin, mTotalKm, mKmBySport, mMinByZone, mSuchyMin };
  }, [blocks, weeks, anchor]);


  if (roleLoading) {
    return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!athleteId) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("common.noAthletes")}</p>
      </Card>
    );
  }

  const monthLabel = format(anchor, "LLLL yyyy", { locale: dateLocale(i18n.language) });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const loadBlocksFor = async (mode: "plan" | "real"): Promise<Block[]> => {
    if (mode === planOrReal) return blocks;
    if (!athleteId || !rangeStart || !rangeEnd) return [];
    const { data } = await supabase.functions.invoke("training-week-load", {
      body: {
        athlete_id: athleteId,
        plan_or_real: mode,
        start: isoDate(rangeStart),
        end: isoDate(rangeEnd),
      },
    });
    return (data as { blocks?: Block[] } | null)?.blocks ?? [];
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const [realBlocks, planBlocks] = await Promise.all([loadBlocksFor("real"), loadBlocksFor("plan")]);
      await exportMonthPdf({
        athleteName: athletes.find((a) => a.id === athleteId)?.name ?? "",
        monthTitle: monthLabelCap,
        subtitle: planOrReal === "plan" ? t("common.plan") : t("common.real"),
        weeks: weeks.map((w) => ({ startIso: w.startIso, endIso: w.endIso })),
        weekLabels: weeks.map((w, i) => `${t("summary.weekN", { n: i + 1 })} (KW${w.isoWeek})`),
        blocks: realBlocks,
        planBlocks,
        monthStartIso: isoDate(startOfMonth(anchor)),
        monthEndIso: isoDate(endOfMonth(anchor)),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleExportPng = async () => {
    if (!captureRef.current) return;
    setExportingPng(true);
    try {
      await exportNodeAsPng(captureRef.current, `pallbi-${format(anchor, "yyyy-MM")}.png`, monthLabelCap);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(subMonths(anchor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center">
            <p className="text-base font-bold">{monthLabelCap}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addMonths(anchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>{t("common.today")}</Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
            <FileDown className="mr-1.5 h-4 w-4" />
            {t("common.exportPdf")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exportingPng}>
            <ImageDown className="mr-1.5 h-4 w-4" />
            {exportingPng ? t("common.exportingPng") : t("common.exportPng")}
          </Button>
          {athletes.length > 1 && (
            <Select value={athleteId} onValueChange={setViewingAthleteId}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {athletes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name ?? "—"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="inline-flex items-center gap-0.5 rounded-md border bg-muted p-0.5 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPlanOrReal("plan")}
              className={`h-7 rounded px-3.5 text-xs ${
                planOrReal === "plan"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {t("common.plan")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPlanOrReal("real")}
              className={`h-7 rounded px-3.5 text-xs ${
                planOrReal === "real"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {t("common.real")}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div ref={captureRef} className="overflow-x-auto rounded-lg border bg-card shadow-sm dark:shadow-none">
        <table className="pallbi-table w-full min-w-[640px] border-collapse text-xs">
          <thead className="sticky top-0 bg-muted/60">
            <tr>
              <th className="sticky left-0 z-10 w-[200px] bg-muted/60 border-b border-r px-2 py-2 text-left font-semibold">
                {monthLabelCap}
              </th>
              {weeks.map((w, i) => (
                <th key={i} className="w-[80px] border-b px-1 py-2 text-center font-semibold">
                  <div>{t("summary.weekN", { n: i + 1 })}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    KW{w.isoWeek}
                  </div>
                </th>
              ))}
              <th className="w-[80px] border-b border-l bg-muted px-2 py-2 text-center font-bold">{t("common.total")}</th>
            </tr>
          </thead>
          <tbody>
            {/* Total hours */}
            <tr className="border-y-2 border-primary/40">
              <td className="sticky left-0 border-r bg-primary/10 px-2 py-2 font-bold uppercase text-primary">
                {t("summary.totalHours")}
              </td>
              {data.totalMin.map((v, i) => (
                <td key={i} className="border-r bg-primary/5 px-1 py-2 text-center font-bold">
                  {v ? fmtMin(v) : ""}
                </td>
              ))}
              <td className="bg-primary/15 px-2 py-2 text-center font-bold text-primary">
                {data.mTotalMin ? fmtMin(data.mTotalMin) : ""}
              </td>
            </tr>

            {/* Total km */}
            <tr className="border-b-2 border-primary/40">
              <td className="sticky left-0 border-r bg-primary/10 px-2 py-2 font-bold uppercase text-primary">
                {t("common.totalKm")}
              </td>
              {data.totalKm.map((v, i) => (
                <td key={i} className="border-r bg-primary/5 px-1 py-2 text-center font-bold">
                  {fmtKm(v)}
                </td>
              ))}
              <td className="bg-primary/15 px-2 py-2 text-center font-bold text-primary">
                {fmtKm(data.mTotalKm)}
              </td>
            </tr>

            <SectionRow label={t("summary.kmBySport")} cols={weeks.length + 2} />
            {KM_SPORTS.map((key) => {
              const label = `${sportRowLabel(key)} km`;
              const vals = data.kmBySport[key];
              const total = data.mKmBySport[key];
              return (
                <tr key={key} className="data-row border-b">
                  <td className="sticky left-0 border-r bg-card px-2 py-2 text-[11px] font-medium">
                    <span
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]"
                      style={{ backgroundColor: SPORT_COLOR[key] }}
                      aria-hidden="true"
                    />
                    {label}
                  </td>
                  {vals.map((v, i) => (
                    <td key={i} className="border-r px-1.5 py-2 text-center text-muted-foreground">
                      {fmtKm(v)}
                    </td>
                  ))}
                  <td className="bg-muted/40 px-2 py-1.5 text-center font-semibold">{fmtKm(total)}</td>
                </tr>
              );
            })}

            <SectionRow label={t("summary.hoursByZone")} cols={weeks.length + 2} />
            <ZoneRow label={zoneLabel("VOLNA")} zone="VOLNA" values={data.minByZone.VOLNA} monthTotal={data.mMinByZone.VOLNA} />
            {TRAINING_ZONES.map((z) => (
              <ZoneRow key={z} label={zoneLabel(z)} zone={z} values={data.minByZone[z]} monthTotal={data.mMinByZone[z]} />
            ))}

            <SectionRow label={t("summary.dryTraining")} cols={weeks.length + 2} />
            <tr className="data-row border-b">
              <td className="sticky left-0 border-r bg-card px-2 py-2 text-[11px] font-medium">
                {t("summary.dryTraining")}
              </td>
              {data.suchyMin.map((v, i) => (
                <td key={i} className="border-r px-1.5 py-2 text-center text-muted-foreground">
                  {v ? fmtMin(v) : ""}
                </td>
              ))}
              <td className="bg-muted/40 px-2 py-1.5 text-center font-semibold">
                {data.mSuchyMin ? fmtMin(data.mSuchyMin) : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {loading && <p className="text-center text-xs text-muted-foreground">{t("common.loading")}</p>}
    </div>
  );
}

function SectionRow({ label, cols }: { label: string; cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="sticky left-0 border-y border-border/80 bg-primary/5 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-primary">
        {label}
      </td>
    </tr>
  );
}

function ZoneRow({ label, zone, values, monthTotal }: { label: string; zone: Zone; values: number[]; monthTotal: number }) {
  const total = monthTotal;
  return (
    <tr className="data-row border-b">
      <td className="sticky left-0 border-r bg-card px-2 py-2">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${zoneClass(zone)}`}>
          {label}
        </span>
      </td>
      {values.map((v, i) => (
        <td key={i} className="border-r px-1.5 py-2 text-center text-muted-foreground">
          {v ? fmtMin(v) : ""}
        </td>
      ))}
      <td className="bg-muted/40 px-2 py-1.5 text-center font-semibold">{total ? fmtMin(total) : ""}</td>
    </tr>
  );
}
