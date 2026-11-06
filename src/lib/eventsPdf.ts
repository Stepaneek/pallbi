import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import i18n from "@/i18n";
import type { CalEvent } from "@/lib/events";
import { fillFreeGaps } from "@/lib/freeGaps";

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

const czDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)}. ${Number(m)}. ${y}`;
};

const dateRange = (ev: CalEvent) =>
  ev.start_date === ev.end_date ? czDate(ev.start_date) : `${czDate(ev.start_date)} – ${czDate(ev.end_date)}`;

/** Clean list/table export of calendar events for a given period. */
export async function exportEventsPdf(args: {
  title: string;
  subtitle: string;
  events: CalEvent[];
  fileName: string;
  /** Insert month subheadings inside the table (season export). */
  groupByMonth?: boolean;
  monthLabel?: (iso: string) => string;
  /** Fill uncovered days in this range with "Volno" rows. */
  freeRange?: { from: string; to: string } | null;
}) {
  const t = i18n.t.bind(i18n);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const font = await loadFont(doc);

  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.text(args.title, 14, 16);
  doc.setFont(font, "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(args.subtitle, 14, 22);
  doc.setTextColor(0);

  const sorted = args.freeRange
    ? fillFreeGaps(args.events, args.freeRange.from, args.freeRange.to, t("eventTypes.volno"))
    : [...args.events].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const row = (ev: CalEvent) => [
    ev.title,
    dateRange(ev),
    t(`eventTypes.${ev.event_type}`),
    (ev.notes ?? "").slice(0, 200),
  ];

  const body: unknown[] = [];
  if (!sorted.length) {
    body.push([{ content: t("analytics.noData"), colSpan: 4, styles: { halign: "center" } }]);
  } else if (args.groupByMonth) {
    let current = "";
    for (const ev of sorted) {
      const key = ev.start_date.slice(0, 7);
      if (key !== current) {
        current = key;
        body.push([
          {
            content: args.monthLabel ? args.monthLabel(ev.start_date) : key,
            colSpan: 4,
            styles: { fontStyle: "bold", fillColor: [232, 236, 242], textColor: 20 },
          },
        ]);
      }
      body.push(row(ev));
    }
  } else {
    for (const ev of sorted) body.push(row(ev));
  }

  autoTable(doc, {
    startY: 28,
    head: [[t("races.name"), t("races.date"), t("races.type"), t("block.notes")]],
    body: body as never,
    styles: { font, fontSize: 9, cellPadding: 2, lineColor: [210, 214, 220], lineWidth: 0.1 },
    headStyles: { font, fontStyle: "bold", fillColor: [23, 37, 61], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 42 },
      2: { cellWidth: 30 },
      3: { cellWidth: 48 },
    },
  });

  doc.save(args.fileName);
}

