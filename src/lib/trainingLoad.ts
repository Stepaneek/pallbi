import { Zone } from "@/lib/zones";

/**
 * Training-load model (TRIMP-like).
 * Each minute in a zone is weighted by intensity, giving a daily load score.
 * From the daily series we derive:
 *  - CTL (Fitness)  = 42-day exponentially weighted average
 *  - ATL (Fatigue)  =  7-day exponentially weighted average
 *  - TSB (Form)     = CTL(yesterday) - ATL(yesterday)
 */
export const ZONE_LOAD_WEIGHT: Record<Zone, number> = {
  VOLNA: 0.6,
  I1: 1,
  I2: 1.5,
  I3: 2.5,
  I4: 4,
  I5: 6,
  I6: 8,
};

export const CTL_DAYS = 42;
export const ATL_DAYS = 7;

type RawSegment = { zone?: string; duration_minutes?: number };
type LoadBlock = {
  block_date: string;
  sport: string;
  zone: string;
  duration_minutes: number | null;
  segments?: unknown;
};

/** Load score of a single training block. */
export function blockLoad(b: LoadBlock): number {
  const raw = b.segments;
  const segs: RawSegment[] = Array.isArray(raw) ? (raw as RawSegment[]) : [];
  const valid = segs.filter((s) => s?.zone && (Number(s.duration_minutes) || 0) > 0);
  if (valid.length) {
    return valid.reduce(
      (a, s) => a + (Number(s.duration_minutes) || 0) * (ZONE_LOAD_WEIGHT[s.zone as Zone] ?? 1),
      0,
    );
  }
  const min = b.duration_minutes || 0;
  return min * (ZONE_LOAD_WEIGHT[b.zone as Zone] ?? 1);
}

/** Sum of load per ISO date. Dry training is excluded (no cardiovascular load). */
export function dailyLoadMap(blocks: LoadBlock[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of blocks) {
    if (b.sport === "strelba") continue;
    const key = b.block_date.slice(0, 10);
    map.set(key, (map.get(key) || 0) + blockLoad(b));
  }
  return map;
}

export type LoadPoint = {
  date: string;
  load: number;
  ctl: number;
  atl: number;
  tsb: number;
};

const round = (v: number) => Math.round(v * 10) / 10;

/** Walk the day series and compute CTL/ATL/TSB for every day. */
export function computeLoadSeries(dates: string[], loads: Map<string, number>): LoadPoint[] {
  const kCtl = 2 / (CTL_DAYS + 1);
  const kAtl = 2 / (ATL_DAYS + 1);
  let ctl = 0;
  let atl = 0;
  const out: LoadPoint[] = [];
  for (const d of dates) {
    const prevCtl = ctl;
    const prevAtl = atl;
    const load = loads.get(d) || 0;
    ctl = prevCtl + (load - prevCtl) * kCtl;
    atl = prevAtl + (load - prevAtl) * kAtl;
    out.push({
      date: d,
      load: round(load),
      ctl: round(ctl),
      atl: round(atl),
      tsb: round(prevCtl - prevAtl),
    });
  }
  return out;
}

export type FormState = "fresh" | "optimal" | "neutral" | "tired" | "overreached";

/** Qualitative reading of the current form (TSB) value. */
export function formState(tsb: number): FormState {
  if (tsb > 25) return "fresh";
  if (tsb > 5) return "optimal";
  if (tsb >= -10) return "neutral";
  if (tsb >= -30) return "tired";
  return "overreached";
}
