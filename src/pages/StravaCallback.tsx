import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function StravaCallback() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("error");
    if (err) { setError(t("misc.strava.error", { err })); return; }
    if (!code) { setError(t("misc.strava.missingCode")); return; }
    (async () => {
      const redirect_uri = `${window.location.origin}/strava/callback`;
      const { data, error } = await supabase.functions.invoke("strava-exchange", { body: { code, redirect_uri } });
      if (error || data?.error) {
        setError(data?.error || error?.message || t("misc.strava.connectFailed"));
        return;
      }
      toast.success(t("misc.strava.connected"));
      // Force a fresh sync after connecting
      localStorage.removeItem("biathlon.lastStravaSync");
      navigate("/");
    })();
  }, [params, navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="text-destructive">{error}</p>
        <Button className="mt-4" onClick={() => navigate("/")}>{t("misc.strava.back")}</Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{t("misc.strava.connecting")}</p>
    </div>
  );
}
