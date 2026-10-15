export type Zone = "VOLNA" | "I1" | "I2" | "I3" | "I4" | "I5" | "I6";

export const ZONES: Zone[] = ["VOLNA", "I1", "I2", "I3", "I4", "I5", "I6"];
export const TRAINING_ZONES: Zone[] = ["I1", "I2", "I3", "I4", "I5", "I6"];

export const ZONE_LABEL: Record<Zone, string> = {
  VOLNA: "VOLNÁ",
  I1: "I1 / I. – aer.",
  I2: "I2",
  I3: "I3 / II. – sm.",
  I4: "I4 / III. – anp.",
  I5: "I5 / IV. – n.an.",
  I6: "I6",
};

export const ZONE_SHORT: Record<Zone, string> = {
  VOLNA: "VOL",
  I1: "I1",
  I2: "I2",
  I3: "I3",
  I4: "I4",
  I5: "I5",
  I6: "I6",
};

export function zoneClass(z: Zone): string {
  return `zone-${z}`;
}

export function zoneBarClass(z: Zone): string {
  return `zone-bar-${z}`;
}

import i18n from "@/i18n";

/** Zone label with the free/easy zone translated; I1–I6 codes stay universal. */
export const zoneLabel = (z: Zone): string =>
  z === "VOLNA" ? i18n.t("zones.VOLNA", { defaultValue: "VOLNÁ" }) : ZONE_LABEL[z];

/** Short zone label with the easy zone translated; I1–I6 codes stay universal. */
export const zoneShort = (z: Zone): string =>
  z === "VOLNA" ? i18n.t("zones.VOLNA_SHORT", { defaultValue: "VOL" }) : ZONE_SHORT[z];
