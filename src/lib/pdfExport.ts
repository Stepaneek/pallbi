import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import i18n from "@/i18n";
import { fmtMin, isoDate } from "@/lib/week";
import { Sport, SPORTS, sportRowLabel } from "@/lib/sports";
import { TRAINING_ZONES, Zone, zoneLabel } from "@/lib/zones";
import { Database } from "@/integrations/supabase/types";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
type RawSegment = { zone?: string; duration_minutes?: number };

const FONT = "DejaVuSans";
let fontCache: { regular: string; bold: string } | null = null;

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
};

/** Load a Unicode font so Czech/Polish/Russian diacritics render correctly. */
async function loadFont(doc: jsPDF) {
  try {
    if (!fontCache) {
      const [r, b] = await Promise.all([
        fetch("/fonts/DejaVuSans.ttf").then((res) => res.arrayBuffer()),
        fetch("/fonts/DejaVuSans-Bold.ttf").then((res) => res.arrayBuffer()),
      ]);
      fontCache = { regular: toBase64(r), bold: toBase64(b) };
    }
    doc.addFileToVFS("DejaVuSans.ttf", fontCache.regular);
    doc.addFont("DejaVuSans.ttf", FONT, "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", fontCache.bold);
    doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");
    doc.setFont(FONT, "normal");
    return FONT;
  } catch {
    return "helvetica";
  }
}

function segments(b: Block): { zone: Zone; duration_minutes: number }[] {
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

const fmtKm = (v: number) => (!v ? "" : Number.isInteger(v) ? String(v) : v.toFixed(1));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

type Agg = {
  minBySport: Record<string, number[]>;
  kmBySport: Record<string, number[]>;
  minByZone: Record<string, number[]>;
  totalMin: number[];
  totalKm: number[];
  dryMin: number[];
  /** Totals counting only blocks where inRange(date) is true (strict month filter). */
  rTotalMin: number;
  rTotalKm: number;
  rDryMin: number;
  rMinBySport: Record<string, number>;
  rKmBySport: Record<string, number>;
  rMinByZone: Record<string, number>;
};

function aggregate(blocks: Block[], cols: number, colOf: (iso: string) => number, inRange?: (iso: string) => boolean): Agg {
  const empty = () => Array.from({ length: cols }, () => 0);
  const agg: Agg = {
    minBySport: {},
    kmBySport: {},
    minByZone: {},
    totalMin: empty(),
    totalKm: empty(),
    dryMin: empty(),
    rTotalMin: 0,
    rTotalKm: 0,
    rDryMin: 0,
    rMinBySport: {},
    rKmBySport: {},
    rMinByZone: {},
  };
  for (const s of SPORTS) {
    agg.minBySport[s] = empty();
    agg.kmBySport[s] = empty();
    agg.rMinBySport[s] = 0;
    agg.rKmBySport[s] = 0;
  }
  for (const z of ["VOLNA", ...TRAINING_ZONES]) {
    agg.minByZone[z] = empty();
    agg.rMinByZone[z] = 0;
  }

  const inR = (b: Block) => (inRange ? inRange(b.block_date) : true);

  for (const b of blocks) {
    const col = colOf(b.block_date);
    if (col < 0) continue;
    const r = inR(b);
    const segs = segments(b);
    const minutes = segs.length ? sum(segs.map((s) => s.duration_minutes)) : b.duration_minutes || 0;
    if (b.sport === "strelba") {
      agg.dryMin[col] += minutes;
      if (r) agg.rDryMin += minutes;
      continue;
    }
    if (agg.minBySport[b.sport]) agg.minBySport[b.sport][col] += minutes;
    agg.totalMin[col] += minutes;
    if (r) {
      agg.rTotalMin += minutes;
      if (agg.rMinBySport[b.sport] !== undefined) agg.rMinBySport[b.sport] += minutes;
    }
    const km = Number(b.distance_km) || 0;
    if (km && agg.kmBySport[b.sport]) {
      agg.kmBySport[b.sport][col] += km;
      agg.totalKm[col] += km;
      if (r) {
        agg.rTotalKm += km;
        agg.rKmBySport[b.sport] += km;
      }
    }
    if (segs.length) {
      for (const s of segs) {
        if (agg.minByZone[s.zone]) agg.minByZone[s.zone][col] += s.duration_minutes;
        if (r && agg.rMinByZone[s.zone] !== undefined) agg.rMinByZone[s.zone] += s.duration_minutes;
      }
    } else if (agg.minByZone[b.zone]) {
      agg.minByZone[b.zone][col] += minutes;
      if (r) agg.rMinByZone[b.zone] += minutes;
    }
  }
  return agg;
}

const KM_SPORTS: Sport[] = ["beh", "kolo", "kolobezka_lyze", "lyze", "plavani", "ostatni"];

/** Zone colors for PDF drawing (RGB) — mirrors the in-app zone palette. */
const ZONE_RGB: Record<string, [number, number, number]> = {
  VOLNA: [148, 163, 184],
  I1: [34, 197, 94],
  I2: [132, 204, 22],
  I3: [245, 158, 11],
  I4: [249, 115, 22],
  I5: [239, 68, 68],
  I6: [136, 19, 55],
};

const hoursOf = (min: number) => Math.round((min / 60) * 10) / 10;

/** Horizontal bar chart of the intensity-zone distribution. Returns the bottom Y. */
function drawZoneChart(
  doc: jsPDF,
  font: string,
  agg: Agg,
  x: number,
  y: number,
  width: number,
): number {
  const t = i18n.t.bind(i18n);
  const zones = (["VOLNA", ...TRAINING_ZONES] as Zone[]).map((z) => ({
    z,
    min: sum(agg.minByZone[z]),
  }));
  const total = zones.reduce((a, b) => a + b.min, 0);

  doc.setFont(font, "bold");
  doc.setFontSize(10);
  doc.text(t("summary.hoursByZone"), x, y);
  let cy = y + 4;

  if (!total) {
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(t("analytics.noData"), x, cy + 3);
    doc.setTextColor(0);
    return cy + 6;
  }

  const labelW = 26;
  const barMax = width - labelW - 26;
  const barH = 4.4;
  doc.setFontSize(8);
  for (const { z, min } of zones) {
    const pct = (min / total) * 100;
    doc.setFont(font, "normal");
    doc.text(zoneLabel(z), x, cy + barH - 1);
    // track
    doc.setFillColor(235, 238, 242);
    doc.rect(x + labelW, cy, barMax, barH, "F");
    if (min > 0) {
      const [r, g, b] = ZONE_RGB[z];
      doc.setFillColor(r, g, b);
      doc.rect(x + labelW, cy, Math.max((barMax * pct) / 100, 0.6), barH, "F");
    }
    doc.setFont(font, "bold");
    doc.text(
      `${hoursOf(min).toFixed(1)} h  ${Math.round(pct * 10) / 10} %`,
      x + labelW + barMax + 2,
      cy + barH - 1,
    );
    cy += barH + 1.8;
  }
  return cy;
}

async function buildPdf(opts: {
  title: string;
  subtitle: string;
  athleteName: string;
  colLabels: string[];
  blocks: Block[];
  planBlocks?: Block[];
  colOf: (iso: string) => number;
  /** Strict date filter for the "Celkem" column (e.g. startOfMonth..endOfMonth). */
  inRange?: (iso: string) => boolean;
  fileName: string;
}) {
  const t = i18n.t.bind(i18n);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const font = await loadFont(doc);
  const agg = aggregate(opts.blocks, opts.colLabels.length, opts.colOf, opts.inRange);

  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.text(opts.title, 14, 16);
  doc.setFont(font, "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text([opts.subtitle, opts.athleteName].filter(Boolean).join("  •  "), 14, 22);
  doc.setTextColor(0);

  const head = [[opts.title.split("\n")[0] ? "" : "", ...opts.colLabels, t("common.total")]];
  head[0][0] = t("common.week");

  const body: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][] = [];
  const section = (label: string) => {
    body.push([{ content: label, colSpan: opts.colLabels.length + 2, styles: { fontStyle: "bold", fillColor: [238, 240, 244] } }]);
  };
  const row = (label: string, values: number[], fmt: (v: number) => string, bold = false, totalOverride?: number) => {
    body.push([
      { content: label, styles: bold ? { fontStyle: "bold" } : {} },
      ...values.map((v) => ({ content: fmt(v), styles: bold ? { fontStyle: "bold" } : {} })),
      { content: fmt(totalOverride ?? sum(values)), styles: { fontStyle: "bold" } },
    ]);
  };

  const mins = (v: number) => (v ? fmtMin(v) : "");
  row(t("common.total"), agg.totalMin, mins, true, agg.rTotalMin);
  row(t("common.totalKm"), agg.totalKm, fmtKm, true, agg.rTotalKm);

  section(t("summary.hoursByZone"));
  for (const z of ["VOLNA", ...TRAINING_ZONES] as Zone[]) {
    row(zoneLabel(z), agg.minByZone[z], mins, false, agg.rMinByZone[z]);
  }

  section(t("common.volumeBySport"));
  for (const s of KM_SPORTS) {
    if (!sum(agg.minBySport[s]) && !sum(agg.kmBySport[s])) continue;
    row(sportRowLabel(s), agg.minBySport[s], mins, false, agg.rMinBySport[s]);
    row(`${sportRowLabel(s)} km`, agg.kmBySport[s], fmtKm, false, agg.rKmBySport[s]);
  }

  if (sum(agg.dryMin)) {
    section(t("summary.dryTraining"));
    row(t("summary.dryTraining"), agg.dryMin, mins, false, agg.rDryMin);
  }

  autoTable(doc, {
    head,
    body: body as never,
    startY: 28,
    styles: { font, fontSize: 8, cellPadding: 1.6, lineColor: [210, 214, 220], lineWidth: 0.1 },
    headStyles: { font, fontStyle: "bold", fillColor: [23, 37, 61], textColor: 255 },
    columnStyles: { 0: { cellWidth: 45, halign: "left" } },
    bodyStyles: { halign: "center" },
    didParseCell: (d) => {
      if (d.column.index === 0) d.cell.styles.halign = "left";
    },
  });

  // ---- Plan vs. actual (right column) + zone distribution chart (left column) ----
  // The summary block (zone chart + plan vs. actual) always gets its own page so
  // it never gets split by an automatic page break.
  const BLOCK_H = 62;
  doc.addPage();
  const blockY = 20;
  const blockPage = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const planAgg = opts.planBlocks
    ? aggregate(opts.planBlocks, opts.colLabels.length, opts.colOf, opts.inRange)
    : null;

  const inR = (b: Block) => (opts.inRange ? opts.inRange(b.block_date) : true);

  if (planAgg) {
    const plannedMin = planAgg.rTotalMin;
    const actualMin = agg.rTotalMin;
    const plannedKm = Object.values(planAgg.rKmBySport).reduce((a, b) => a + b, 0);
    const actualKm = Object.values(agg.rKmBySport).reduce((a, b) => a + b, 0);
    const plannedSessions = opts.planBlocks!.filter((b) => opts.colOf(b.block_date) >= 0 && inR(b)).length;
    const actualSessions = opts.blocks.filter((b) => opts.colOf(b.block_date) >= 0 && inR(b)).length;
    const pct = plannedMin > 0 ? `${Math.round((actualMin / plannedMin) * 100)} %` : "—";
    const diff = (a: number, b: number, unit: string) => {
      const d = Math.round((a - b) * 10) / 10;
      return `${d > 0 ? "+" : ""}${d}${unit}`;
    };

    autoTable(doc, {
      startY: blockY,
      pageBreak: "avoid",
      margin: { left: 155 },
      tableWidth: 128,
      head: [[t("pdf.planVsActual"), t("common.plan"), t("common.real"), t("pdf.diff")]],
      body: [
        [t("pdf.hours"), `${hoursOf(plannedMin).toFixed(1)} h`, `${hoursOf(actualMin).toFixed(1)} h`, diff(hoursOf(actualMin), hoursOf(plannedMin), " h")],
        ["km", plannedKm.toFixed(1), actualKm.toFixed(1), diff(actualKm, plannedKm, "")],
        [t("pdf.sessions"), String(plannedSessions), String(actualSessions), diff(actualSessions, plannedSessions, "")],
        [{ content: t("pdf.completion"), styles: { fontStyle: "bold" } }, { content: pct, colSpan: 3, styles: { fontStyle: "bold", halign: "center" } }] as never,
      ],
      styles: { font, fontSize: 8, cellPadding: 1.6, lineColor: [210, 214, 220], lineWidth: 0.1 },
      headStyles: { font, fontStyle: "bold", fillColor: [23, 37, 61], textColor: 255 },
      bodyStyles: { halign: "center" },
      columnStyles: { 0: { halign: "left", cellWidth: 42 } },
    });
  }

  doc.setPage(blockPage);
  const chartBottom = drawZoneChart(doc, font, agg, 14, blockY + 4, 130);
  const afterBlock = Math.max(chartBottom, blockY + BLOCK_H - 10);

  // Workout list
  const list = [...opts.blocks]
    .filter((b) => opts.colOf(b.block_date) >= 0 && inR(b))
    .sort((a, b) => a.block_date.localeCompare(b.block_date));
  if (list.length) {
    const y = afterBlock;
    autoTable(doc, {
      startY: y + 8,
      head: [[t("common.date"), t("block.sport"), t("diary.time"), "km", t("common.zone"), t("block.notes")]],
      body: list.map((b) => [
        b.block_date,
        b.sport === "strelba" ? i18n.t("summary.dryTraining") : sportRowLabel(b.sport as Sport),
        b.duration_minutes ? fmtMin(b.duration_minutes) : "",
        fmtKm(Number(b.distance_km) || 0),
        b.sport === "strelba" ? "" : zoneLabel(b.zone as Zone),
        (b.notes ?? "").slice(0, 120),
      ]),
      styles: { font, fontSize: 8, cellPadding: 1.4 },
      headStyles: { font, fontStyle: "bold", fillColor: [23, 37, 61], textColor: 255 },
      columnStyles: { 5: { cellWidth: 90 } },
    });
  }

  doc.save(opts.fileName);
}

export async function exportWeekPdf(args: {
  athleteName: string;
  weekTitle: string;
  subtitle: string;
  days: Date[];
  dayLabels: string[];
  blocks: Block[];
  planBlocks?: Block[];
}) {
  const isos = args.days.map((d) => isoDate(d));
  await buildPdf({
    title: args.weekTitle,
    subtitle: args.subtitle,
    athleteName: args.athleteName,
    colLabels: args.dayLabels,
    blocks: args.blocks,
    planBlocks: args.planBlocks,
    colOf: (iso) => isos.indexOf(iso.slice(0, 10)),
    fileName: `pallbi-${isos[0]}.pdf`,
  });
}

export async function exportMonthPdf(args: {
  athleteName: string;
  monthTitle: string;
  subtitle: string;
  weeks: { startIso: string; endIso: string }[];
  weekLabels: string[];
  blocks: Block[];
  planBlocks?: Block[];
  /** Strict month bounds (yyyy-MM-dd) for the "Celkem" column. */
  monthStartIso: string;
  monthEndIso: string;
}) {
  await buildPdf({
    title: args.monthTitle,
    subtitle: args.subtitle,
    athleteName: args.athleteName,
    colLabels: args.weekLabels,
    blocks: args.blocks,
    planBlocks: args.planBlocks,
    colOf: (iso) => {
      const d = iso.slice(0, 10);
      return args.weeks.findIndex((w) => d >= w.startIso && d <= w.endIso);
    },
    inRange: (iso) => {
      const d = iso.slice(0, 10);
      return d >= args.monthStartIso && d <= args.monthEndIso;
    },
    fileName: `pallbi-${args.weeks[0]?.startIso ?? "month"}.pdf`,
  });
}
