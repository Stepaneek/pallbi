import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LS_KEY = "pallbi_whatsnew_dismissed_v1";

export default function WhatsNewBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(LS_KEY) === "1";
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(LS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  const points = t("announcements.points", { returnObjects: true }) as string[];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("announcements.title")}
            </p>
            <ul className="space-y-1.5">
              {points.map((point, idx) => (
                <li key={idx} className="text-xs leading-relaxed text-muted-foreground">
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleClose}
            aria-label={t("announcements.close")}
          >
            {t("announcements.close")}
            <X className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
