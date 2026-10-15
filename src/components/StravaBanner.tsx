import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StravaBadge from "@/components/StravaBadge";
import StravaConnectButton from "@/components/StravaConnectButton";

const SHOWN_KEY = "strava_banner_shown";

export default function StravaBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasStrava, setHasStrava] = useState<boolean | null>(null);
  const [shown, setShown] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setShown(localStorage.getItem(`${SHOWN_KEY}_${user.id}`) === "1");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("strava_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setHasStrava(!!data && !error);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    // Show modal when we know the user doesn't have Strava and hasn't seen the banner
    if (hasStrava === false && !shown) {
      setOpen(true);
    }
  }, [hasStrava, shown]);

  const handleClose = () => {
    setOpen(false);
    if (user) {
      localStorage.setItem(`${SHOWN_KEY}_${user.id}`, "1");
    }
    setShown(true);
  };

  const handleConnect = () => {
    handleClose();
    navigate("/profile");
  };

  // Don't render anything while loading or if user has Strava or already seen it
  if (hasStrava === null || hasStrava === true || shown) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-md p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center px-8 pb-8 pt-10 text-center">
          <div className="mb-6 max-w-full"><StravaBadge variant="compatible" /></div>

          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {t("misc.stravaBanner.title")}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              {t("misc.stravaBanner.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-8 flex w-full flex-col items-center gap-3">
            <StravaConnectButton onClick={handleConnect} />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleClose}
            >
              {t("misc.stravaBanner.notNow")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
