import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const IDS = ["strava", "coach", "free", "sports", "data", "pdf"] as const;

export default function FaqSection() {
  const { t } = useTranslation();

  return (
    <section className="border-t bg-secondary/30">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("landing.faqTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("landing.faqSubtitle")}</p>

        <Accordion type="single" collapsible className="mt-8">
          {IDS.map((id) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {t(`landing.faq.${id}Q`)}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t(`landing.faq.${id}A`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
