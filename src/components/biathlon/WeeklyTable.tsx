import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Database } from "@/integrations/supabase/types";
import { SPORT_COLOR, sportRowLabel, Sport } from "@/lib/sports";
import { aggregateBlocks, totalByZone, rowSum, SPORT_TABLE_ORDER, aggregateKm, totalKmPerDay, aggregateMinutesForSport } from "@/lib/aggregate";
import { seasonWeek, weekDays, isoDate, fmtMin } from "@/lib/week";
import { TRAINING_ZONES, zoneLabel, Zone, zoneClass } from "@/lib/zones";
import { MetaData, ensureArr } from "@/hooks/useWeeklyMeta";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

const ZEROS = () => [0, 0, 0, 0, 0, 0, 0];

interface Props {
  athleteId: string;
  weekStart: Date;
  planOrReal: "plan" | "real";
  blocks: Block[];
  canEdit: boolean;
  meta: MetaData;
  setMetaCell: (key: keyof MetaData, day: number, val: string) => void;
  selectedDayIndex?: number;
}

export default function WeeklyTable({ weekStart, planOrReal, blocks, canEdit, meta, setMetaCell, selectedDayIndex }: Props) {
  const { t } = useTranslation();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const dayIso = useMemo(() => days.map(isoDate), [days]);
  const iso_week = useMemo(() => seasonWeek(weekStart), [weekStart]);

  // Aggregate blocks
  const dateToCol = (iso: string) => dayIso.indexOf(iso);
  const grid = useMemo(() => aggregateBlocks(blocks, dateToCol), [blocks, dayIso]);
  const zoneTotals = useMemo(() => totalByZone(grid), [grid]);
  const kmGrid = useMemo(() => aggregateKm(blocks, dateToCol), [blocks, dayIso]);
  const kmTotals = useMemo(() => totalKmPerDay(kmGrid), [kmGrid]);
  const suchyMinutes = useMemo(() => aggregateMinutesForSport(blocks, "strelba", dateToCol), [blocks, dayIso]);

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-auto rounded-2xl border border-border bg-card shadow-md dark:border-white/[0.08] dark:shadow-none">
      <table className="pallbi-table w-full min-w-[640px] border-collapse text-xs [&_td]:border-foreground/15 [&_th]:border-foreground/15 dark:[&_td]:border-border dark:[&_th]:border-border [&_.data-row_td]:border-b-2 [&_.data-row_td]:border-r-2 dark:[&_.data-row_td]:border-b dark:[&_.data-row_td]:border-r">
        <thead className="sticky top-0 z-20 bg-muted">
          <tr>
            <th className="sticky top-0 left-0 z-30 w-[180px] bg-muted border-b border-r px-2 py-2 text-left font-semibold">
              {t("common.week")} {iso_week}
            </th>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <th
                key={i}
                className={`sticky top-0 z-20 w-[60px] border-b px-1 py-2 text-center font-semibold ${
                  selectedDayIndex === i ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {t(`days.short.${i}`)}
              </th>
            ))}
            <th className="sticky top-0 z-20 w-[70px] border-b border-l bg-muted px-2 py-2 text-center font-bold">{t("common.total")}</th>
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-muted/50">
          {/* Counter rows */}
          {([
            ["NEMOC", "table.nemoc"],
            ["BIA.START", "table.biaStart"],
          ] as const).map(([key, labelKey]) => (
            <CounterRow key={key} label={t(labelKey)}
              values={ensureArr(meta[key])}
              onChange={(d, v) => setMetaCell(key, d, v)}
              canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          ))}

          <SectionRow label={t("table.regeneration")} />
          <CounterRow label={t("table.regActive")} indent
            values={ensureArr(meta["REG.aktivni"])}
            onChange={(d, v) => setMetaCell("REG.aktivni", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          <CounterRow label={t("table.regPassive")} indent
            values={ensureArr(meta["REG.pasivni"])}
            onChange={(d, v) => setMetaCell("REG.pasivni", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />

          <SectionRow label={t("table.loadHours")} />
          <ZoneRow label={zoneLabel("VOLNA")} zone="VOLNA" values={zoneTotals.VOLNA} selectedDayIndex={selectedDayIndex} />
          {TRAINING_ZONES.map((z) => (
            <ZoneRow key={z} label={zoneLabel(z)} zone={z} values={zoneTotals[z]} selectedDayIndex={selectedDayIndex} />
          ))}
          <TotalHoursRow
            values={(["VOLNA", ...TRAINING_ZONES] as Zone[]).reduce(
              (acc, z) => acc.map((v, i) => v + (zoneTotals[z]?.[i] || 0)),
              [0, 0, 0, 0, 0, 0, 0],
            )}
            selectedDayIndex={selectedDayIndex}
          />

          {/* Sport breakdowns */}
          {SPORT_TABLE_ORDER.map(({ key }) => (
            <>
              <SectionRow key={`s-${key}`} label={sportRowLabel(key as Sport)} color={SPORT_COLOR[key]} />
              <KmRow key={`s-${key}-km`} values={kmGrid[key] || ZEROS()} selectedDayIndex={selectedDayIndex} />
              <ZoneRow key={`s-${key}-V`} label={zoneLabel("VOLNA")} zone="VOLNA" values={grid[key].VOLNA} indent selectedDayIndex={selectedDayIndex} />
              {TRAINING_ZONES.map((z) => (
                <ZoneRow key={`s-${key}-${z}`} label={zoneLabel(z)} zone={z} values={grid[key][z]} indent selectedDayIndex={selectedDayIndex} />
              ))}
            </>
          ))}

          <TotalKmRow values={kmTotals} selectedDayIndex={selectedDayIndex} />

          <SectionRow label={sportRowLabel("osi")} color={SPORT_COLOR.osi} />
          <ZoneRow
            label={sportRowLabel("osi")}
            zone="VOLNA"
            values={(["VOLNA", ...TRAINING_ZONES] as Zone[]).reduce(
              (acc, z) => acc.map((v, i) => v + (grid.osi[z]?.[i] || 0)),
              [0, 0, 0, 0, 0, 0, 0],
            )}
            selectedDayIndex={selectedDayIndex}
          />
          <SectionRow label={t("table.dryTraining")} />
          <ZoneRow
            label={t("table.dryShort")}
            zone="VOLNA"
            values={suchyMinutes}
            selectedDayIndex={selectedDayIndex}
          />
          <SectionRow label={t("table.ssi")} />
          {(["I1", "I2", "I3", "I4", "I5"] as const).map((z) => (
            <CounterRow key={`ssi-${z}`} label={zoneLabel(z as Zone)} indent zoneTag={z}
              values={ensureArr(meta[`SSI.${z}` as keyof MetaData])}
              onChange={(d, v) => setMetaCell(`SSI.${z}` as keyof MetaData, d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          ))}

          <SectionRow label={t("table.vn")} />
          <CounterRow label={t("table.vnRest")} indent
            values={ensureArr(meta["VN.klid"])}
            onChange={(d, v) => setMetaCell("VN.klid", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          <CounterRow label={t("table.vnI12")} indent
            values={ensureArr(meta["VN.I12"])}
            onChange={(d, v) => setMetaCell("VN.I12", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          <CounterRow label={t("table.vnI3")} indent
            values={ensureArr(meta["VN.I3"])}
            onChange={(d, v) => setMetaCell("VN.I3", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          <CounterRow label={t("table.vnI45")} indent
            values={ensureArr(meta["VN.I45"])}
            onChange={(d, v) => setMetaCell("VN.I45", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          <CounterRow label={t("table.nt")}
            values={ensureArr(meta.NT)}
            onChange={(d, v) => setMetaCell("NT", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />

          {planOrReal === "real" && (
            <CounterRow label={t("table.morningHr")}
              values={ensureArr(meta.MORNING_HR)}
              onChange={(d, v) => setMetaCell("MORNING_HR", d, v)} canEdit={canEdit} selectedDayIndex={selectedDayIndex} />
          )}
        </tbody>
      </table>
    </div>
  );
}

function ZoneLabel({ zone, label }: { zone: Zone; label: string }) {
  if (zone === "VOLNA") {
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${zoneClass(zone)}`}>
        {label}
      </span>
    );
  }
  const colorMap: Record<Exclude<Zone, "VOLNA">, string> = {
    I1: "hsl(var(--zone-i1))",
    I2: "hsl(var(--zone-i2))",
    I3: "hsl(var(--zone-i3))",
    I4: "hsl(var(--zone-i4))",
    I5: "hsl(var(--zone-i5))",
    I6: "hsl(var(--zone-i6))",
  };
  return (
    <span
      className="label-ink inline-block px-1.5 py-0.5 text-[10px] font-bold"
      style={{ "--ink": colorMap[zone] } as React.CSSProperties}
    >
      {label}
    </span>
  );
}

function SectionRow({ label, color }: { label: string; color?: string }) {
  return (
    <tr>
      <td
        colSpan={9}
        className={`sticky left-0 border-y ${color ? "label-ink" : ""} border-border/80 bg-primary/10 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-primary dark:bg-slate-800/50`}
        style={
          color
            ? {
                borderLeft: `4px solid ${color}`,
                "--ink": color,
                backgroundColor: `${color}22`,
              } as React.CSSProperties
            : undefined
        }
       
      >
        {label}
      </td>
    </tr>
  );
}

function ZoneRow({ label, zone, values, indent, selectedDayIndex }: { label: string; zone: Zone; values: number[]; indent?: boolean; selectedDayIndex?: number }) {
  const total = rowSum(values);
  return (
    <tr className="data-row border-b">
      <td className={`sticky left-0 border-r bg-card px-2 py-2 ${indent ? "pl-6" : ""}`}>
        <ZoneLabel zone={zone} label={label} />
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`border-r px-1.5 py-2 text-center text-muted-foreground ${
            selectedDayIndex === i ? "bg-primary/10" : ""
          }`}
        >
          {v ? fmtMin(v) : ""}
        </td>
      ))}
      <td className="bg-muted/70 px-2 py-1.5 text-center font-semibold">{total ? fmtMin(total) : ""}</td>
    </tr>
  );
}

function CounterRow({
  label, values, onChange, canEdit, indent, zoneTag, selectedDayIndex,
}: {
  label: string; values: number[]; onChange: (day: number, v: string) => void;
  canEdit: boolean; indent?: boolean; zoneTag?: Zone; selectedDayIndex?: number;
}) {
  const total = rowSum(values);
  return (
    <tr className="data-row border-b">
      <td className={`sticky left-0 border-r bg-card px-2 py-2 ${indent ? "pl-6" : ""}`}>
        {zoneTag ? (
          <ZoneLabel zone={zoneTag} label={label} />
        ) : (
          <span className="text-[11px] font-medium">{label}</span>
        )}
      </td>
      {values.map((v, i) => (
        <td key={i} className={`border-r p-0 ${selectedDayIndex === i ? "bg-primary/10" : ""}`}>
          <input
            type="number"
            step="0.5"
            disabled={!canEdit}
            value={v || ""}
            onChange={(e) => onChange(i, e.target.value)}
            className="h-8 w-full border-0 bg-transparent px-1.5 text-center text-xs outline-none focus:bg-primary/20 disabled:cursor-default"
          />
        </td>
      ))}
      <td className="bg-muted/70 px-2 py-1.5 text-center font-semibold">{total || ""}</td>
    </tr>
  );
}

function fmtKm(v: number): string {
  if (!v) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function KmRow({ values, selectedDayIndex }: { values: number[]; selectedDayIndex?: number }) {
  const total = rowSum(values);
  return (
    <tr className="data-row border-b">
      <td className="sticky left-0 border-r bg-card px-2 py-2 pl-6">
        <span className="text-[11px] font-medium text-muted-foreground">km</span>
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`border-r px-1.5 py-2 text-center text-muted-foreground ${
            selectedDayIndex === i ? "bg-primary/10" : ""
          }`}
        >
          {fmtKm(v)}
        </td>
      ))}
      <td className="bg-muted/70 px-2 py-1.5 text-center font-semibold">{fmtKm(total)}</td>
    </tr>
  );
}

function TotalHoursRow({ values, selectedDayIndex }: { values: number[]; selectedDayIndex?: number }) {
  const { t } = useTranslation();
  const total = rowSum(values);
  return (
    <tr className="border-y-2 border-primary/40 dark:border-slate-500">
      <td className="sticky left-0 border-r bg-primary/10 px-2 py-2 font-bold uppercase text-foreground dark:bg-slate-800 dark:text-white">
        {t("common.total")}
      </td>
      {values.map((v, i) => (
        <td key={i} className={`border-r px-1 py-2 text-center font-bold text-foreground dark:bg-slate-800 dark:text-pink-400 ${
          selectedDayIndex === i ? "bg-primary/20" : "bg-primary/5"
        }`}>
          {v ? fmtMin(v) : ""}
        </td>
      ))}
      <td className="bg-primary/15 px-2 py-2 text-center text-sm font-extrabold text-foreground dark:bg-slate-800 dark:text-pink-400">
        {total ? fmtMin(total) : ""}
      </td>

    </tr>


  );
}

function TotalKmRow({ values, selectedDayIndex }: { values: number[]; selectedDayIndex?: number }) {
  const { t } = useTranslation();
  const total = rowSum(values);
  return (
    <tr className="border-y-2 border-primary/40 dark:border-slate-500">
      <td className="sticky left-0 border-r bg-primary/10 px-2 py-2 font-bold uppercase text-foreground dark:bg-slate-800 dark:text-white">
        {t("common.totalKm")}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`border-r px-1 py-2 text-center font-bold text-foreground dark:bg-slate-800 dark:text-pink-400 ${
            selectedDayIndex === i ? "bg-primary/20" : "bg-primary/5"
          }`}
        >
          {fmtKm(v)}
        </td>
      ))}
      <td className="bg-primary/15 px-2 py-2 text-center font-bold text-foreground dark:bg-slate-800 dark:text-pink-400">{fmtKm(total)}</td>

    </tr>


  );
}

