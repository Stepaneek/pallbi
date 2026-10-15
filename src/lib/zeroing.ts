/** Biathlon zeroing math. Coordinates in mm, origin = target centre, x → right, y → up. */
export type ZeroStance = "prone" | "standing";
export type Shot = { x: number; y: number };

/** Diameter of the black aiming/hit area at 50 m. */
export const BLACK_DIAMETER_MM: Record<ZeroStance, number> = { prone: 45, standing: 115 };
/** Typical biathlon diopter: 1 click moves the point of impact ≈ 1.5 mm at 50 m. */
export const DEFAULT_CLICK_MM = 1.5;

export function groupCenter(shots: Shot[]): Shot | null {
  if (!shots.length) return null;
  const sx = shots.reduce((a, s) => a + s.x, 0);
  const sy = shots.reduce((a, s) => a + s.y, 0);
  return { x: sx / shots.length, y: sy / shots.length };
}

export const offsetMm = (p: Shot) => Math.hypot(p.x, p.y);

/** Clock direction 1–12 rounded to half hours (12 = straight up, 3 = right). */
export function clockHour(p: Shot): number | null {
  if (offsetMm(p) < 0.5) return null;
  let deg = (Math.atan2(p.x, p.y) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  let h = Math.round((deg / 30) * 2) / 2;
  if (h <= 0) h += 12;
  return h > 12 ? h - 12 : h;
}

export const formatClock = (h: number | null) =>
  h == null ? "—" : `${Math.floor(h)}:${h % 1 ? "30" : "00"}`;

/** Clicks needed to move the group back to centre. Positive vertical = up, positive horizontal = right. */
export function corrections(p: Shot, clickMm = DEFAULT_CLICK_MM) {
  const r = (v: number) => (Math.abs(v) < clickMm / 2 ? 0 : Math.round(v / clickMm));
  return { vertical: -r(p.y) || 0, horizontal: -r(p.x) || 0 };
}

/** Group spread = max distance between any two shots. */
export function groupSize(shots: Shot[]): number {
  let m = 0;
  for (let i = 0; i < shots.length; i++)
    for (let j = i + 1; j < shots.length; j++)
      m = Math.max(m, Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y));
  return m;
}
