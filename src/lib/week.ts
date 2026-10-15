import {
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  subWeeks,
  getISOWeek,
  getISOWeekYear,
  format,
  addDays,
  parseISO,
  isSameDay,
} from "date-fns";

export const DAY_LABELS = ["po", "út", "st", "čt", "pá", "so", "ne"] as const;
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function weekRange(date: Date) {
  return { start: startOfISOWeek(date), end: endOfISOWeek(date) };
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isoYearWeek(date: Date) {
  return { iso_year: getISOWeekYear(date), iso_week: getISOWeek(date) };
}

export function seasonWeek(date: Date): number {
  const seasonStart = startOfISOWeek(new Date(2026, 3, 1)); // 1.4.2026
  const weekStart = startOfISOWeek(date);
  const diffDays = Math.round((weekStart.getTime() - seasonStart.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

export function weekHeader(date: Date) {
  const { start, end } = weekRange(date);
  const w = seasonWeek(date);
  return `${w}. Týden / ${format(start, "d.M.")} – ${format(end, "d.M.yyyy").replace(",", "")}`;
}

export function nextWeek(d: Date) { return addWeeks(d, 1); }
export function prevWeek(d: Date) { return subWeeks(d, 1); }

export function dayIndexFromDate(start: Date, d: Date): DayIndex {
  for (let i = 0; i < 7; i++) {
    if (isSameDay(addDays(start, i), d)) return i as DayIndex;
  }
  return 0;
}

export function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromIso(s: string): Date {
  return parseISO(s);
}

export function fmtMin(totalMin: number): string {
  if (!totalMin) return "";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}m`;
}
