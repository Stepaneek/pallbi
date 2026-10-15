import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { publicDb } from "@/lib/db";
import { cn } from "@/lib/utils";

const LS_DONE_KEY = "onboarding_completed";
const TOTAL_STEPS = 2;

export default function OnboardingModal() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);

  const [hr, setHr] = useState({ free: "", i1: "", i2: "", i3: "", i4: "", i5: "" });
  const [savingHr, setSavingHr] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setChecking(false); return; }
    (async () => {
      if (localStorage.getItem(LS_DONE_KEY) === "1") {
        setChecking(false);
        return;
      }
      const { data } = await publicDb
        .from("profiles")
        .select("name, onboarding_completed, hr_i1_max, hr_i2_max, hr_i3_max, hr_i4_max, hr_i5_max, max_hr_free")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // Skip if already completed OR user has a name already (legacy user)
      const alreadyDone = data?.onboarding_completed === true ||
        (data?.name && data.name.trim().length > 0);
      if (alreadyDone) {
        localStorage.setItem(LS_DONE_KEY, "1");
        setChecking(false);
        return;
      }
      setHr({
        free: data?.max_hr_free?.toString() ?? "",
        i1: data?.hr_i1_max?.toString() ?? "",
        i2: data?.hr_i2_max?.toString() ?? "",
        i3: data?.hr_i3_max?.toString() ?? "",
        i4: data?.hr_i4_max?.toString() ?? "",
        i5: data?.hr_i5_max?.toString() ?? "",
      });
      const { data: tok } = await publicDb
        .from("strava_tokens").select("user_id").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      setStravaConnected(!!tok);
      setOpen(true);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const markCompleted = async () => {
    if (!user) return null;
    const { error } = await publicDb
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    localStorage.setItem(LS_DONE_KEY, "1");
    return error;
  };

  const saveHr = async () => {
    if (!user) return;
    const parse = (v: string) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 && n < 300 ? n : null;
    };
    setSavingHr(true);
    const { error } = await publicDb
      .from("profiles")
      .update({
        hr_i1_max: parse(hr.i1),
        hr_i2_max: parse(hr.i2),
        hr_i3_max: parse(hr.i3),
        hr_i4_max: parse(hr.i4),
        hr_i5_max: parse(hr.i5),
        max_hr_free: parse(hr.free),
      })
      .eq("id", user.id);
    if (error) {
      setSavingHr(false);
      toast.error(error.message);
      return;
    }
    await markCompleted();
    setSavingHr(false);
    setOpen(false);
  };

  const connectStrava = async () => {
    const redirect = `${window.location.origin}/strava/callback`;
    const url =
      `https://www.strava.com/oauth/authorize?client_id=232420` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
      `&approval_prompt=auto&scope=read,activity:read_all`;
    // Mark as complete before leaving so onboarding isn't shown again on return
    await markCompleted();
    window.location.href = url;
  };

  const finish = async () => {
    setFinishing(true);
    await markCompleted();
    setFinishing(false);
    setOpen(false);
  };

  if (checking || !open) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* not dismissable */ }}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("misc.onboarding.step", { step, total: TOTAL_STEPS })}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-colors",
                    i < step ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
          <DialogTitle>
            {step === 1 ? t("misc.onboarding.title4") : t("misc.onboarding.title3")}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? t("misc.onboarding.desc4") : t("misc.onboarding.desc3")}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#FC4C02] text-white font-bold">
                  S
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Strava</p>
                  <p className="text-xs text-muted-foreground">
                    {stravaConnected ? t("misc.onboarding.stravaConnected") : t("misc.onboarding.stravaNotConnected")}
                  </p>
                </div>
              </div>
              {!stravaConnected && (
                <Button className="mt-4 w-full bg-[#FC4C02] text-white hover:bg-[#e04502]" onClick={connectStrava}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {t("misc.onboarding.connect")}
                </Button>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {stravaConnected ? t("misc.onboarding.continue") : t("misc.onboarding.skipLater")}
              </Button>
              <Button onClick={() => setStep(2)}>{t("misc.onboarding.continue")}</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(["free", "i1", "i2", "i3", "i4", "i5"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs uppercase">{k === "free" ? t("misc.onboarding.hrFreeLabel") : `${k.toUpperCase()} max`}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={50}
                    max={250}
                    value={hr[k]}
                    onChange={(e) => setHr((p) => ({ ...p, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("misc.onboarding.hrHint")}</p>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>{t("misc.onboarding.back")}</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={finish} disabled={finishing}>{t("misc.onboarding.skip")}</Button>
                <Button onClick={saveHr} disabled={savingHr}>
                  {savingHr ? "…" : t("misc.onboarding.finish")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
