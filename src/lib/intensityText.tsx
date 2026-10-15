import { ReactNode } from "react";
import { Sunrise, Sun, Sunset } from "lucide-react";
import { ClickHint } from "@/components/ui/info-popover";
import i18n from "@/i18n";

/**
 * Visual highlighting of intensity markers (VOLNÁ, i1–i6) inside free-text training notes.
 * Purely presentational — no data changes.
 */

const INTENSITY_CLASS: Record<string, string> = {
  "1": "itag-i1",
  "2": "itag-i2",
  "3": "itag-i3",
  "4": "itag-i4",
  "5": "itag-i5",
  "6": "itag-i6",
};

export type IntensityKey = "VOL" | "1" | "2" | "3" | "4" | "5" | "6";

export function getIntensityInfo(): Record<IntensityKey, { label: string; title: string; desc: string; cls: string }> {
  return {
    VOL: {
      label: i18n.t("zones.VOLNA", { defaultValue: "VOLNÁ" }),
      title: i18n.t("profile.intensity.vol.title"),
      desc: i18n.t("profile.intensity.vol.desc"),
      cls: "itag-vol",
    },
    "1": { label: "I1", title: i18n.t("profile.intensity.i1.title"), desc: i18n.t("profile.intensity.i1.desc"), cls: "itag-i1" },
    "2": { label: "I2", title: i18n.t("profile.intensity.i2.title"), desc: i18n.t("profile.intensity.i2.desc"), cls: "itag-i2" },
    "3": { label: "I3", title: i18n.t("profile.intensity.i3.title"), desc: i18n.t("profile.intensity.i3.desc"), cls: "itag-i3" },
    "4": { label: "I4", title: i18n.t("profile.intensity.i4.title"), desc: i18n.t("profile.intensity.i4.desc"), cls: "itag-i4" },
    "5": { label: "I5", title: i18n.t("profile.intensity.i5.title"), desc: i18n.t("profile.intensity.i5.desc"), cls: "itag-i5" },
    "6": { label: "I6", title: i18n.t("profile.intensity.i6.title"), desc: i18n.t("profile.intensity.i6.desc"), cls: "itag-i6" },
  };
}

export const INTENSITY_INFO: Record<IntensityKey, { label: string; title: string; desc: string; cls: string }> = getIntensityInfo();

export const INTENSITY_ORDER: IntensityKey[] = ["VOL", "1", "2", "3", "4", "5", "6"];

// matches i1..i6 (also "I3", "i 4"), plus "vol", "vol.", "volná", "volno", "volné (tempo)"
const TOKEN_RE = /\b(i\s?[1-6]|voln[áaéeoyí]\w*|vol\.?)/gi;

function IntensityTag({ raw, tone }: { raw: string; tone: IntensityKey }) {
  const info = getIntensityInfo()[tone];
  return (
    <ClickHint
      contentClassName="max-w-[min(220px,calc(100vw-24px))]"
      trigger={
        <span
          tabIndex={0}
          role="button"
          className={`cursor-pointer rounded px-1 py-px text-[0.95em] font-bold outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring ${info.cls}`}
        >
          {raw}
        </span>
      }
    >
      <p className="text-xs font-semibold">
        {info.label} — {info.title}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{info.desc}</p>
    </ClickHint>
  );
}

export function highlightIntensity(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  let k = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const raw = m[0];
    const digit = raw.replace(/[^1-6]/g, "");
    const tone: IntensityKey = (digit || "VOL") as IntensityKey;
    out.push(<IntensityTag key={`t${k++}`} raw={raw} tone={tone} />);
    last = m.index + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Compact legend of all intensity zones. */
export function IntensityLegend() {
  const info_map = getIntensityInfo();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {INTENSITY_ORDER.map((k) => {
        const info = info_map[k];
        return (
          <div key={k} className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-px text-xs font-bold ${info.cls}`}>{info.label}</span>
            <span className="text-xs leading-snug">
              <span className="font-semibold">{info.title}</span>
              <span className="text-muted-foreground"> — {info.desc}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const SLOT_META: Record<
  string,
  { label: string; icon: typeof Sun; chip: string }
> = {
  rano: {
    label: "Ráno",
    icon: Sunrise,
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  dopoledne: {
    label: "Dopoledne",
    icon: Sun,
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  odpoledne: {
    label: "Odpoledne",
    icon: Sunset,
    chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  },
};

export function SlotLabel({ slot }: { slot: string }) {
  const meta = SLOT_META[slot] ?? SLOT_META.dopoledne;
  const label = i18n.t(`slots.${slot}`, { defaultValue: meta.label });
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${meta.chip}`}
    >
      {label}
    </span>
  );
}
