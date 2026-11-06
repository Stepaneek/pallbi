import type { CalEvent } from "@/lib/events";

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Adds synthetic "volno" rows for every day range in [from, to] not covered by any event. */
export function fillFreeGaps(events: CalEvent[], from: string, to: string, label = "Volno"): CalEvent[] {
  const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const gaps: CalEvent[] = [];
  let cursor = from; // first day not yet covered
  const push = (s: string, e: string) => {
    if (s <= e) gaps.push({ id: `free_${s}`, athlete_id: "", event_type: "volno", title: label, start_date: s, end_date: e });
  };
  for (const ev of sorted) {
    if (ev.end_date < cursor) continue;
    if (ev.start_date > to) break;
    if (ev.start_date > cursor) push(cursor, addDaysIso(ev.start_date, -1));
    const next = addDaysIso(ev.end_date, 1);
    if (next > cursor) cursor = next;
  }
  if (cursor <= to) push(cursor, to);
  return [...sorted, ...gaps].sort((a, b) => a.start_date.localeCompare(b.start_date));
}
