import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { savePendingCoachInvite } from "@/lib/coachInvite";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AcceptInvite() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) savePendingCoachInvite(token);
  }, [token]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("misc.acceptInvite.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("misc.acceptInvite.description")}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={() => navigate("/auth?mode=signin")}>{t("misc.acceptInvite.signIn")}</Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>{t("misc.acceptInvite.signUp")}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
