export type Sport = "beh" | "kolo" | "kolobezka_lyze" | "lyze" | "plavani" | "ostatni" | "strelba" | "osi";

export const SPORTS: Sport[] = ["beh", "kolo", "kolobezka_lyze", "lyze", "plavani", "ostatni", "strelba", "osi"];

export const SPORT_LABEL: Record<Sport, string> = {
  beh: "Běh",
  kolo: "Kolo",
  kolobezka_lyze: "Kol.lyže (kolečkové lyže)",
  lyze: "Lyže (běžecké)",
  plavani: "Plavání",
  ostatni: "Ostatní",
  strelba: "Suchý trénink",
  osi: "OSI",
};

// For weekly table sport rows (BĚH / KOLO / KOL.LYŽE / LYŽE / PLAVÁNÍ / OSTATNÍ)
export const SPORT_ROW_LABEL: Record<Sport, string> = {
  beh: "BĚH",
  kolo: "KOLO",
  kolobezka_lyze: "KOL.LYŽE",
  lyze: "LYŽE",
  plavani: "PLAVÁNÍ",
  ostatni: "OSTATNÍ",
  strelba: "SUCHÝ TRÉNINK",
  osi: "OSI",
};

// Bold, vibrant sport palette — distinguishable in both light and dark mode.
export const SPORT_COLOR: Record<Sport, string> = {
  beh: "#EF4444",            // bold red-orange/coral
  kolo: "#06B6D4",           // vibrant cyan
  kolobezka_lyze: "#8B5CF6", // vivid purple
  lyze: "#84CC16",           // bright lime
  plavani: "#3B82F6",        // electric blue
  ostatni: "#64748B",        // neutral slate
  osi: "#F59E0B",            // vibrant amber
  strelba: "#A1A1AA",        // muted zinc (rarely shown)
};

// Map Strava sport_type → our sport
// Run→Běh, Ride→Kolo, RollerSki→Kol.lyže, NordicSki/Ski→Lyže, Swim→Plavání,
// WeightTraining/Strength/Workout/Crossfit→OSI, Walk/Hike→Ostatní,
// everything else (yoga, pilates, elliptical, etc.) also falls back to Ostatní.
export function stravaToSport(t?: string | null): Sport {
  const x = (t || "").toLowerCase();
  if (x.includes("rollerski")) return "kolobezka_lyze";
  if (x.includes("nordicski") || x.includes("backcountryski") || x.includes("alpineski") || x === "ski" || x.includes("snowboard")) return "lyze";
  if (x.includes("swim")) return "plavani";
  if (x.includes("run")) return "beh";
  if (x.includes("ride") || x.includes("bike") || x.includes("cycling") || x.includes("ebike")) return "kolo";
  // Only core strength/fitness activities map to OSI; everything else falls back to Ostatní
  if (
    x.includes("weighttraining") ||
    x.includes("strength") ||
    x.includes("workout") ||
    x.includes("crossfit")
  ) return "osi";
  // Hike and Walk explicitly map to Ostatní so they never get skipped
  if (x.includes("walk") || x.includes("hike")) return "ostatni";
  // Fallback: any unmapped Strava activity type (yoga, pilates, elliptical, rowing, etc.) is Ostatní
  return "ostatni";
}

// ---- i18n helpers (labels translated at render time) ----
import i18n from "@/i18n";

export const sportLabel = (s: Sport): string =>
  i18n.t(`sports.label.${s}`, { defaultValue: SPORT_LABEL[s] });

export const sportRowLabel = (s: Sport): string =>
  i18n.t(`sports.row.${s}`, { defaultValue: SPORT_ROW_LABEL[s] });
