import i18n from "@/i18n";

export type Stance = "prone" | "standing";

/** One shooting entry. `miss_clock` holds one clock direction per miss (1–12). */
export type ShootingSet = {
  stance: Stance;
  misses: number;
  miss_clock: number[];
  /** optional intensity at which this entry was shot */
  intensity?: ShootingIntensity | null;
  /** number of shots in the set (biathlon default 5) */
  shots?: number;
  /** optional timing: seconds to the first shot */
  first_shot_seconds?: number | null;
  /** optional timing: total seconds of the set */
  total_seconds?: number | null;
  /** legacy field kept for backwards compatibility with older records */
  time_seconds?: number | null;
};

export const DEFAULT_SHOTS = 5;


export type ShootingEntry = ShootingSet & { date: string };

export const STANCES: Stance[] = ["prone", "standing"];

export const stanceLabel = (s: Stance): string =>
  i18n.t(`shooting.stance.${s}`, { defaultValue: s === "prone" ? "Ležka" : "Stojka" });

/** Clock directions on a target face (1 h to 12 h). */
export const CLOCK_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Safely parse the `shooting_sets` jsonb column of a training block. */
export function parseShootingSets(raw: unknown): ShootingSet[] {
  if (!Array.isArray(raw)) return [];
  const out: ShootingSet[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const stance: Stance = s.stance === "standing" ? "standing" : "prone";
    const misses = Math.min(DEFAULT_SHOTS, Math.max(0, Math.round(Number(s.misses) || 0)));
    const clocks = Array.isArray(s.miss_clock)
      ? (s.miss_clock as unknown[])
          .map((c) => Math.round(Number(c)))
          .filter((c) => Number.isFinite(c) && c >= 1 && c <= 12)
      : [];
    const num = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
    };
    // every shooting set is fixed at 5 shots
    const shots = DEFAULT_SHOTS;
    out.push({
      stance,
      misses,
      miss_clock: clocks,
      shots,
      intensity: isShootingIntensity(s.intensity) ? s.intensity : null,
      first_shot_seconds: num(s.first_shot_seconds),
      total_seconds: num(s.total_seconds) ?? num(s.time_seconds),
    });
  }

  return out;
}

/** Flatten all shooting entries of the given blocks, tagged with their date. */
export function collectShootingEntries(
  blocks: { block_date: string; shooting_sets?: unknown }[],
): ShootingEntry[] {
  const out: ShootingEntry[] = [];
  for (const b of blocks) {
    for (const s of parseShootingSets(b.shooting_sets)) out.push({ ...s, date: b.block_date });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Count misses per clock direction (index 1..12 = o'clock). Index 0 is unused. */
export function missDistribution(sets: ShootingSet[]): number[] {
  const counts = new Array(13).fill(0) as number[];
  for (const s of sets) for (const c of s.miss_clock) if (c >= 1 && c <= 12) counts[c] += 1;
  return counts;
}


/** Aggregate stats for a list of shooting sets. */
export function shootingStats(sets: ShootingSet[]) {
  let shots = 0;
  let misses = 0;
  let firstSum = 0;
  let firstN = 0;
  let totalSum = 0;
  let totalN = 0;
  for (const s of sets) {
    shots += DEFAULT_SHOTS;
    misses += Math.min(DEFAULT_SHOTS, s.misses);
    if (s.first_shot_seconds != null) {
      firstSum += s.first_shot_seconds;
      firstN += 1;
    }
    if (s.total_seconds != null) {
      totalSum += s.total_seconds;
      totalN += 1;
    }
  }
  const hits = Math.max(0, shots - misses);
  return {
    sets: sets.length,
    shots,
    misses,
    hits,
    accuracy: shots > 0 ? (hits / shots) * 100 : null,
    avgFirstShot: firstN > 0 ? firstSum / firstN : null,
    avgTotal: totalN > 0 ? totalSum / totalN : null,
  };
}

/** Optional shooting intensity values stored on training_blocks.shooting_intensity. */
export const SHOOTING_INTENSITIES = ["klidova", "i1", "i2", "i3", "i4", "i5"] as const;
export type ShootingIntensity = (typeof SHOOTING_INTENSITIES)[number];
export function isShootingIntensity(v: unknown): v is ShootingIntensity {
  return typeof v === "string" && (SHOOTING_INTENSITIES as readonly string[]).includes(v);
}
