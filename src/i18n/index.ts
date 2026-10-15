import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "./locales/cs.json";
import sk from "./locales/sk.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import no from "./locales/no.json";
import fi from "./locales/fi.json";
import sv from "./locales/sv.json";
import it from "./locales/it.json";
import fr from "./locales/fr.json";
import pl from "./locales/pl.json";
import ru from "./locales/ru.json";

export const LANGUAGES = [
  { code: "cs", label: "CZ", name: "Čeština", flag: "🇨🇿", ogLocale: "cs_CZ" },
  { code: "sk", label: "SK", name: "Slovenčina", flag: "🇸🇰", ogLocale: "sk_SK" },
  { code: "en", label: "EN", name: "English", flag: "🇬🇧", ogLocale: "en_US" },
  { code: "de", label: "DE", name: "Deutsch", flag: "🇩🇪", ogLocale: "de_DE" },
  { code: "no", label: "NO", name: "Norsk", flag: "🇳🇴", ogLocale: "nb_NO" },
  { code: "fi", label: "FI", name: "Suomi", flag: "🇫🇮", ogLocale: "fi_FI" },
  { code: "sv", label: "SV", name: "Svenska", flag: "🇸🇪", ogLocale: "sv_SE" },
  { code: "it", label: "IT", name: "Italiano", flag: "🇮🇹", ogLocale: "it_IT" },
  { code: "fr", label: "FR", name: "Français", flag: "🇫🇷", ogLocale: "fr_FR" },
  { code: "pl", label: "PL", name: "Polski", flag: "🇵🇱", ogLocale: "pl_PL" },
  { code: "ru", label: "RU", name: "Русский", flag: "🇷🇺", ogLocale: "ru_RU" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

/** Language codes that have their own public landing path (/sk, /en, /de, …). */
export const LOCALIZED_PATHS = LANGUAGES.filter((l) => l.code !== "cs").map((l) => l.code);

export const STORAGE_KEY = "pallbi_lang";

const isLang = (v: unknown): v is LanguageCode =>
  typeof v === "string" && LANGUAGES.some((l) => l.code === v);

function detect(): LanguageCode {
  if (typeof window === "undefined") return "cs";
  const path = window.location.pathname.split("/")[1];
  if (isLang(path) && path !== "cs") return path;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLang(stored)) return stored;
  const nav = window.navigator.language?.slice(0, 2);
  if (isLang(nav)) return nav;
  return "cs";
}

i18n.use(initReactI18next).init({
  resources: {
    cs: { translation: cs },
    sk: { translation: sk },
    en: { translation: en },
    de: { translation: de },
    no: { translation: no },
    fi: { translation: fi },
    sv: { translation: sv },
    it: { translation: it },
    fr: { translation: fr },
    pl: { translation: pl },
    ru: { translation: ru },
  },
  lng: detect(),
  fallbackLng: "cs", // untranslated keys fall back to Czech
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lng);
});

if (typeof document !== "undefined") document.documentElement.lang = i18n.language;

export default i18n;
