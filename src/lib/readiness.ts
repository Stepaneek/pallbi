export type ReadinessLevel = "ok" | "warn" | "alert";

export interface ReadinessInput {
  morningHr?: number;
  baselineHr?: number;
  sleep?: number; // 1-5, 1 = best (sleep quality reversed)
  fatigue?: number; // 1-5, 5 = most tired
  soreness?: number; // 1-5, 5 = most sore
}

export interface ReadinessResult {
  level: ReadinessLevel;
  score: number; // 0-100
  /** True when the score is derived only from morning HR (no subjective ratings). */
  hrOnly?: boolean;
}

/**
 * Readiness = weighted combination of two components:
 *  - 50 % morning HR deviation from the athlete's baseline
 *  - 50 % average of subjective ratings (sleep/fatigue/soreness)
 * When only one component is available, the score comes from that component
 * alone; missing subjective ratings never get a default value.
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult | null {
  const { morningHr, baselineHr, sleep, fatigue, soreness } = input;
  const parts: number[] = [];

  if (sleep) parts.push(((5 - sleep) / 4) * 100);
  if (fatigue) parts.push(((5 - fatigue) / 4) * 100);
  if (soreness) parts.push(((5 - soreness) / 4) * 100);

  const hasHr = !!morningHr && !!baselineHr;
  if (!parts.length && !hasHr) return null;

  let hrScore: number | undefined;
  if (hasHr) {
    const dev = morningHr! - baselineHr!;
    // Each bpm above baseline costs ~4 points (capped), below baseline gives a small bonus.
    const penalty = dev > 0 ? Math.min(40, dev * 4) : Math.max(-10, dev * 2);
    hrScore = 70 - penalty;
  }

  const subjScore = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : undefined;

  let score: number;
  if (hrScore !== undefined && subjScore !== undefined) score = (hrScore + subjScore) / 2;
  else score = hrScore ?? subjScore ?? 0;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: ReadinessLevel = score >= 70 ? "ok" : score >= 45 ? "warn" : "alert";
  return { level, score, hrOnly: hrScore !== undefined && subjScore === undefined };
}

/** Median of non-zero morning HR values, used as personal baseline. */
export function morningHrBaseline(values: number[]): number | undefined {
  const vals = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!vals.length) return undefined;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}

export const READINESS_DOT: Record<ReadinessLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-red-500",
};

export const READINESS_BADGE: Record<ReadinessLevel, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  alert: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
};
