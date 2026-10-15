import { Database } from "@/integrations/supabase/types";
import { Sport, SPORTS, SPORT_ROW_LABEL } from "./sports";
import { TRAINING_ZONES, Zone } from "./zones";

export type Block = Database["public"]["Tables"]["training_blocks"]["Row"];
export type WeeklyMeta = Database["public"]["Tables"]["weekly_meta"]["Row"];

export type DayCol = number; // 0..6 (po..ne)

/** Sum minutes by sport×zone across the 7 days. Returns minutes per (sport,zone,day) and totals. */
export function aggregateBlocks(blocks: Block[], dateToCol: (iso: string) => DayCol | -1) {
  // [sport][zone][day] = minutes
  const grid: Record<string, Record<string, number[]>> = {};
  for (const s of SPORTS) {
    grid[s] = {};
    for (const z of ["VOLNA", ...TRAINING_ZONES] as Zone[]) {
      grid[s][z] = [0, 0, 0, 0, 0, 0, 0];
    }
  }
  for (const b of blocks) {
    if (b.sport === "strelba") continue;
    const col = dateToCol(b.block_date);
    if (col < 0) continue;
    const segs = extractSegments(b);
    if (segs.length) {
      for (const s of segs) {
        if (!grid[b.sport][s.zone]) continue;
        grid[b.sport][s.zone][col] += s.duration_minutes || 0;
      }
    } else {
      grid[b.sport][b.zone][col] += b.duration_minutes || 0;
    }
  }
  return grid;
}

type RawSegment = { zone?: string; duration_minutes?: number };
function extractSegments(b: Block): { zone: Zone; duration_minutes: number }[] {
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

/** Sum across all sports, by zone+day. */
export function totalByZone(grid: ReturnType<typeof aggregateBlocks>) {
  const totals: Record<string, number[]> = {};
  for (const z of ["VOLNA", ...TRAINING_ZONES] as Zone[]) {
    totals[z] = [0, 0, 0, 0, 0, 0, 0];
    for (const s of SPORTS) {
      for (let i = 0; i < 7; i++) totals[z][i] += grid[s][z][i];
    }
  }
  return totals;
}

export function rowSum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/** Sum km per sport per day. */
export function aggregateKm(blocks: Block[], dateToCol: (iso: string) => DayCol | -1) {
  const km: Record<string, number[]> = {};
  for (const s of SPORTS) km[s] = [0, 0, 0, 0, 0, 0, 0];
  for (const b of blocks) {
    if (b.sport === "strelba") continue;
    const col = dateToCol(b.block_date);
    if (col < 0) continue;
    const d = Number(b.distance_km) || 0;
    if (!d) continue;
    if (!km[b.sport]) continue;
    km[b.sport][col] += d;
  }
  return km;
}

/** Total km across all sports per day. */
export function totalKmPerDay(km: Record<string, number[]>): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const s of Object.keys(km)) {
    for (let i = 0; i < 7; i++) out[i] += km[s][i];
  }
  return out;
}

export const SPORT_TABLE_ORDER: { key: Sport; label: string }[] = [
  { key: "beh", label: SPORT_ROW_LABEL.beh },
  { key: "kolo", label: SPORT_ROW_LABEL.kolo },
  { key: "kolobezka_lyze", label: SPORT_ROW_LABEL.kolobezka_lyze },
  { key: "lyze", label: SPORT_ROW_LABEL.lyze },
  { key: "plavani", label: SPORT_ROW_LABEL.plavani },
  { key: "ostatni", label: SPORT_ROW_LABEL.ostatni },
];

/** Sum minutes per day for blocks of a specific sport (uses segments if present). */
export function aggregateMinutesForSport(
  blocks: Block[],
  sport: Sport,
  dateToCol: (iso: string) => DayCol | -1,
): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const b of blocks) {
    if (b.sport !== sport) continue;
    const col = dateToCol(b.block_date);
    if (col < 0) continue;
    const segs = extractSegments(b);
    if (segs.length) {
      for (const s of segs) out[col] += s.duration_minutes || 0;
    } else {
      out[col] += b.duration_minutes || 0;
    }
  }
  return out;
}
