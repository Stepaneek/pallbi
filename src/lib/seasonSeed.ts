/**
 * Identifies the one-off "season starting state" block (e.g. 102 h / 967 km
 * entered as a single block at the season start). Such blocks must count into
 * overall season totals, but must be excluded from weekly charts and weekly
 * overviews so they don't distort the scale of a single week.
 */
export const SEASON_SEED_NOTES_PREFIX = "Počáteční stav sezóny";

export function isSeasonSeedBlock(block: { notes?: string | null }): boolean {
  return (block.notes ?? "").trim().startsWith(SEASON_SEED_NOTES_PREFIX);
}
