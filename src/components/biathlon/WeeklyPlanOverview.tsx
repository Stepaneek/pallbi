import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { isoDate } from "@/lib/week";
import { Database } from "@/integrations/supabase/types";
import { SlotLabel, highlightIntensity } from "@/lib/intensityText";
import { dateLocale } from "@/lib/dateLocale";

type Block = Database["public"]["Tables"]["training_blocks"]["Row"];

const SLOTS = ["rano", "dopoledne", "odpoledne"];

interface Props {
  days: Date[];
  blocks: Block[];
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
}

export default function WeeklyPlanOverview({ days, blocks, selectedDay, onSelectDay }: Props) {
  const { t, i18n } = useTranslation();
  const loc = dateLocale(i18n.language);
  return (
    <div className="space-y-2">
      {days.map((d, i) => {
        const iso = isoDate(d);
        const dayBlocks = blocks.filter((b) => b.block_date === iso);
        const isSel = iso === isoDate(selectedDay);
        const isToday = iso === isoDate(new Date());
        const entries = SLOTS.map((key) => ({
          key,
          text: dayBlocks
            .filter((b) => b.slot === key)
            .map((b) => b.notes?.trim())
            .filter(Boolean)
            .join("\n"),
        })).filter((e) => e.text);

        return (
          <Card
            key={iso}
            onClick={() => onSelectDay(d)}
            className={`cursor-pointer p-3 transition-colors ${
              isSel ? "border-primary ring-1 ring-primary" : isToday ? "border-primary/50 hover:bg-accent/50" : "hover:bg-accent/50"
            }`}
          >
            <p className={`text-sm font-semibold ${isSel ? "text-primary" : ""}`}>
              {t(`days.long.${i}`)} {format(d, "d.M.", { locale: loc })}
            </p>
            {entries.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">{t("week.dayOff")}</p>
            ) : (
              <div className="mt-2 divide-y divide-border/70">
                {entries.map((e, idx) => (
                  <div key={e.key} className={idx === 0 ? "pb-2" : "py-2 last:pb-0"}>
                    <SlotLabel slot={e.key} />
                    <p className="mt-1.5 max-w-full overflow-hidden whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {highlightIntensity(e.text)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

