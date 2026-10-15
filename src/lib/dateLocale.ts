import { cs, sk, enGB } from "date-fns/locale";
import type { Locale } from "date-fns";
import i18n from "@/i18n";

/** date-fns locale matching the active i18n language. */
export function dateLocale(lng?: string): Locale {
  const code = (lng ?? i18n.language ?? "cs").slice(0, 2);
  if (code === "sk") return sk;
  if (code === "en") return enGB;
  return cs;
}
