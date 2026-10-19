import { useEffect, useState } from "react";
import { publicDb } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { Copy, Trash2, Check, ChevronsUpDown, RefreshCw, Unlink, HelpCircle, Clock } from "lucide-react";
import { IntensityLegend } from "@/lib/intensityText";
import { useStravaSync } from "@/hooks/useStravaSync";
import StravaBadge from "@/components/StravaBadge";
import StravaConnectButton from "@/components/StravaConnectButton";
import { useTranslation } from "react-i18next";

import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";
import { CZECH_BIATHLON_CLUBS } from "@/lib/clubs";
import { cn } from "@/lib/utils";

type Invite = Database["public"]["Tables"]["coach_invites"]["Row"];
type Link = Database["public"]["Tables"]["coach_athlete_links"]["Row"];

export default function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAthlete, isCoach, refresh } = useRole();
  const [name, setName] = useState("");
  const [club, setClub] = useState<string>("");
  const [clubOpen, setClubOpen] = useState(false);
  const [isBiathlete, setIsBiathlete] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [coachEmail, setCoachEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [coaches, setCoaches] = useState<{ id: string; name: string | null; email: string | null }[]>([]);

  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaLastSync, setStravaLastSync] = useState<string | null>(null);





  const [hrZones, setHrZones] = useState<{ i1: string; i2: string; i3: string; i4: string; i5: string; free: string }>({
    i1: "", i2: "", i3: "", i4: "", i5: "", free: "",
  });
  const [useBikeZones, setUseBikeZones] = useState(false);
  const [bikeZones, setBikeZones] = useState<{ i1: string; i2: string; i3: string; i4: string; i5: string; free: string }>({
    i1: "", i2: "", i3: "", i4: "", i5: "", free: "",
  });
  const [savingHr, setSavingHr] = useState(false);
  const [removeCoachId, setRemoveCoachId] = useState<string | null>(null);
  const [removingCoach, setRemovingCoach] = useState(false);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  type SubRow = {
    status: string | null;
    plan: string | null;
    current_period_end: string | null;
    stripe_subscription_id: string | null;
    cancel_at_period_end: boolean | null;
  };
  const [subscription, setSubscription] = useState<SubRow | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const loadSubscription = async () => {
    if (!user) return;
    const { data } = await (publicDb as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: SubRow | null }> } } }
    })
      .from("subscriptions")
      .select("status,plan,current_period_end,stripe_subscription_id,cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    setSubscription(data ?? null);
  };

  const startCheckout = async (plan: "monthly" | "yearly") => {
    setSubLoading(true);
    const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { plan } });
    setSubLoading(false);
    const payload = data as { url?: string; error?: string } | null;
    if (error || payload?.error || !payload?.url) {
      return toast.error(payload?.error || error?.message || t("profile.checkoutFailed"));
    }
    window.location.href = payload.url;
  };

  const cancelSubscription = async (resume = false) => {
    setSubLoading(true);
    const { data, error } = await supabase.functions.invoke("stripe-cancel", { body: { resume } });
    setSubLoading(false);
    setCancelOpen(false);
    const payload = data as { ok?: boolean; error?: string } | null;
    if (error || payload?.error) {
      return toast.error(payload?.error || error?.message || (resume ? t("profile.resumeFailed") : t("profile.cancelFailed")));
    }
    toast.success(resume ? t("profile.subscriptionResumed") : t("profile.subscriptionWillCancel"));
    loadSubscription();
  };



  const changePassword = async () => {
    if (!user?.email) return;
    if (pwNew.length < 6) return toast.error(t("profile.passwordTooShort"));
    if (pwNew !== pwConfirm) return toast.error(t("profile.passwordsDontMatch"));
    setChangingPw(true);
    // Verify current password
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwCurrent,
    });
    if (verifyErr) {
      setChangingPw(false);
      return toast.error(t("profile.currentPasswordWrong"));
    }
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setChangingPw(false);
    if (error) return toast.error(error.message);
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    toast.success(t("profile.passwordChanged"));
  };

  const deleteAccount = async () => {
    if (!deletePassword) return toast.error(t("profile.enterPassword"));
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { password: deletePassword },
    });
    const payload = data as { error?: string; ok?: boolean } | null;
    if (error || payload?.error) {
      setDeleting(false);
      return toast.error(payload?.error || error?.message || t("profile.deleteFailed"));
    }
    await supabase.auth.signOut();
    toast.success(t("profile.accountDeleted"));
    window.location.href = "/auth";
  };

  const loadHrZones = async () => {
    if (!user) return;
    const { data } = await publicDb
      .from("profiles")
      .select("hr_i1_max,hr_i2_max,hr_i3_max,hr_i4_max,hr_i5_max,max_hr_free,use_bike_hr_zones,bike_hr_i1_max,bike_hr_i2_max,bike_hr_i3_max,bike_hr_i4_max,bike_hr_i5_max,bike_max_hr_free")
      .eq("id", user.id)
      .maybeSingle();
    const row = data as Record<string, number | boolean | null> | null;
    const str = (v: unknown) => (typeof v === "number" ? String(v) : "");
    setHrZones({
      i1: str(row?.hr_i1_max),
      i2: str(row?.hr_i2_max),
      i3: str(row?.hr_i3_max),
      i4: str(row?.hr_i4_max),
      i5: str(row?.hr_i5_max),
      free: str(row?.max_hr_free),
    });
    setUseBikeZones(row?.use_bike_hr_zones === true);
    setBikeZones({
      i1: str(row?.bike_hr_i1_max),
      i2: str(row?.bike_hr_i2_max),
      i3: str(row?.bike_hr_i3_max),
      i4: str(row?.bike_hr_i4_max),
      i5: str(row?.bike_hr_i5_max),
      free: str(row?.bike_max_hr_free),
    });
  };

  const saveHrZones = async () => {
    if (!user) return;
    const parse = (v: string) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 && n < 300 ? n : null;
    };
    setSavingHr(true);
    const { error } = await publicDb
      .from("profiles")
      .update({
        hr_i1_max: parse(hrZones.i1),
        hr_i2_max: parse(hrZones.i2),
        hr_i3_max: parse(hrZones.i3),
        hr_i4_max: parse(hrZones.i4),
        hr_i5_max: parse(hrZones.i5),
        max_hr_free: parse(hrZones.free),
        use_bike_hr_zones: useBikeZones,
        bike_hr_i1_max: parse(bikeZones.i1),
        bike_hr_i2_max: parse(bikeZones.i2),
        bike_hr_i3_max: parse(bikeZones.i3),
        bike_hr_i4_max: parse(bikeZones.i4),
        bike_hr_i5_max: parse(bikeZones.i5),
        bike_max_hr_free: parse(bikeZones.free),
      } as never)
      .eq("id", user.id);
    setSavingHr(false);
    if (error) return toast.error(error.message);
    toast.success(t("profile.hrZonesSaved"));
  };

  const loadStrava = async () => {
    if (!user) return;
    const { data: tok } = await publicDb
      .from("strava_tokens").select("user_id").eq("user_id", user.id).maybeSingle();
    setStravaConnected(!!tok);
    const lastLocal = localStorage.getItem("biathlon.lastStravaSync");
    setStravaLastSync(lastLocal ? new Date(Number(lastLocal)).toISOString() : null);
  };

  const { status: stravaStatus, sync: runStravaSync } = useStravaSync(user?.id, () => loadStrava());

  const connectStrava = () => {
    const redirect = `${window.location.origin}/strava/callback`;
    const url =
      `https://www.strava.com/oauth/authorize?client_id=232420` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
      `&approval_prompt=auto&scope=read,activity:read_all`;
    window.location.href = url;
  };


  const disconnectStrava = async () => {
    if (!user) return;
    if (!confirm(t("profile.disconnectConfirm"))) return;
    const { error } = await publicDb.from("strava_tokens").delete().eq("user_id", user.id);
    if (error) return toast.error(error.message);
    localStorage.removeItem("biathlon.lastStravaSync");
    toast.success(t("profile.stravaDisconnected"));
    loadStrava();
  };





  const load = async () => {
    if (!user) return;
    const { data: profRes, error: profErr } = await supabase.functions.invoke("profile-manage", {
      body: { action: "get" },
    });
    if (profErr) {
      setProfileError(profErr.message);
    } else {
      const p = (profRes as { profile?: { name?: string | null; club?: string | null; is_biathlete?: boolean | null } } | null)?.profile;
      setName(p?.name ?? "");
      setClub(p?.club ?? "");
      setIsBiathlete(!!p?.is_biathlete);
    }


    const { data: inv } = await publicDb
      .from("coach_invites").select("*").eq("athlete_id", user.id).order("created_at", { ascending: false });

    const { data: links } = await publicDb
      .from("coach_athlete_links").select("coach_id").eq("athlete_id", user.id);
    const coachIds = (links ?? []).map((l) => l.coach_id);
    const linkedSet = new Set(coachIds);
    const filteredInv = (inv ?? []).filter((i) => {
      if (i.status === "pending") return true;
      if (i.status === "accepted" && i.accepted_by && linkedSet.has(i.accepted_by)) return true;
      return false;
    });
    setInvites(filteredInv);
    if (coachIds.length) {
      const { data: profs } = await publicDb.from("profiles").select("id,name").in("id", coachIds);
      const emailByCoach = new Map<string, string>();
      for (const i of inv ?? []) {
        if (i.status === "accepted" && i.accepted_by && !emailByCoach.has(i.accepted_by)) {
          emailByCoach.set(i.accepted_by, i.coach_email);
        }
      }
      const profById = new Map((profs ?? []).map((p) => [p.id, p.name] as const));
      setCoaches(coachIds.map((id) => ({
        id,
        name: profById.get(id) ?? null,
        email: emailByCoach.get(id) ?? null,
      })));
    } else {
      setCoaches([]);
    }
  };

  useEffect(() => { load(); loadStrava(); loadHrZones(); loadSubscription(); }, [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      toast.success(t("profile.subscriptionActivated"));
      // give webhook a moment
      setTimeout(() => loadSubscription(), 1500);
      const url = new URL(window.location.href);
      url.searchParams.delete("subscription");
      window.history.replaceState({}, "", url.toString());
    } else if (params.get("subscription") === "cancelled") {
      toast.info(t("profile.paymentCancelled"));
      const url = new URL(window.location.href);
      url.searchParams.delete("subscription");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveName = async () => {
    if (!user) return;
    setSavingName(true);
    setProfileError(null);
    const { data, error } = await supabase.functions.invoke("profile-manage", {
      body: { action: "update", name, club: club || null, is_biathlete: isBiathlete },
    });
    setSavingName(false);
    const payload = data as { error?: string; profile?: { name?: string | null; club?: string | null; is_biathlete?: boolean | null } } | null;
    if (error || payload?.error) {
      setProfileError(payload?.error || error?.message || t("profile.saveFailed"));
      return;
    }
    if (payload?.profile?.name != null) setName(payload.profile.name);
    if (payload?.profile && "club" in payload.profile) setClub(payload.profile.club ?? "");
    if (payload?.profile && "is_biathlete" in payload.profile) setIsBiathlete(!!payload.profile.is_biathlete);
    toast.success(t("profile.saved"));
  };

  const createInvite = async () => {
    if (!user) return;
    const parsed = z.string().email().safeParse(coachEmail);
    if (!parsed.success) return toast.error(t("profile.invalidEmail"));
    setCreating(true);
    const { error } = await publicDb
      .from("coach_invites")
      .insert({ athlete_id: user.id, coach_email: parsed.data });
    setCreating(false);
    if (error) return toast.error(error.message);
    setCoachEmail("");
    toast.success(t("profile.inviteCreated"));
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await publicDb.from("coach_invites").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeCoach = async () => {
    if (!user || !removeCoachId) return;
    setRemovingCoach(true);
    const { error } = await publicDb
      .from("coach_athlete_links").delete()
      .eq("athlete_id", user.id).eq("coach_id", removeCoachId);
    if (!error) {
      await publicDb
        .from("coach_invites")
        .delete()
        .eq("athlete_id", user.id)
        .eq("accepted_by", removeCoachId);
    }
    setRemovingCoach(false);
    if (error) return toast.error(error.message);
    toast.success(t("profile.coachRemoved"));
    setRemoveCoachId(null);
    load(); refresh();
  };

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;
  const copyInvite = (token: string) => {
    navigator.clipboard.writeText(inviteUrl(token));
    toast.success(t("profile.linkCopied"));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">{t("profile.myProfile")}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("profile.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="is-biathlete">{t("profile.isBiathlete")}</Label>
              <p className="text-xs text-muted-foreground">{t("profile.isBiathleteHint")}</p>
            </div>
            <Switch id="is-biathlete" checked={isBiathlete} onCheckedChange={setIsBiathlete} />
          </div>
          <div className="space-y-2">
            <Label>{isBiathlete ? t("profile.club") : t("profile.clubOrTeam")}</Label>
            {isBiathlete ? (
              <Popover open={clubOpen} onOpenChange={setClubOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={clubOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !club && "text-muted-foreground")}>
                      {club || t("profile.selectClub")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("profile.searchClub")} />
                    <CommandList>
                      <CommandEmpty>{t("profile.noClubFound")}</CommandEmpty>
                      <CommandGroup>
                        {CZECH_BIATHLON_CLUBS.map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={(v) => {
                              setClub(v === club ? "" : v);
                              setClubOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", club === c ? "opacity-100" : "opacity-0")} />
                            {c === "Ostatní" ? t("profile.otherClub") : c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <Input
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder={t("profile.clubPlaceholder")}
                maxLength={200}
              />
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveName} disabled={savingName}>{savingName ? "…" : t("profile.save")}</Button>
          </div>
          {profileError && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{t("profile.saveFailed")}</p>
              <p className="mt-1 text-xs">{profileError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={saveName} disabled={savingName}>
                {t("profile.tryAgain")}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-lg font-bold">{t("profile.connectedServices")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t("profile.connectedServicesHint")}
        </p>
        <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <StravaBadge variant="compatible" />
              <p className="text-xs text-muted-foreground">
                {stravaConnected === null
                  ? t("profile.loading")
                  : stravaConnected
                  ? stravaLastSync
                    ? t("profile.lastSync", { date: format(new Date(stravaLastSync), "d.M.yyyy HH:mm") })
                    : t("profile.connectedNotSynced")
                  : t("profile.notConnected")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stravaConnected ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runStravaSync(true)}
                  disabled={stravaStatus === "syncing"}
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", stravaStatus === "syncing" && "animate-spin")} />
                  {stravaStatus === "syncing" ? t("profile.syncing") : t("profile.sync")}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={disconnectStrava}>
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  {t("profile.disconnect")}
                </Button>
              </>
            ) : (
              <StravaConnectButton onClick={connectStrava} disabled={stravaConnected === null} />
            )}
          </div>
        </div>
      </Card>


      <Card className="p-5">
        <h2 className="mb-2 text-lg font-bold">{t("profile.hrZones")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t("profile.hrZonesHint")}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(["free", "i1", "i2", "i3", "i4", "i5"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs uppercase">{k === "free" ? t("profile.volMax") : t("profile.zoneMax", { zone: k.toUpperCase() })}</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={50}
                max={250}
                value={hrZones[k]}
                onChange={(e) => setHrZones((prev) => ({ ...prev, [k]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="use-bike-zones" className="text-sm font-medium">
              {t("profile.useBikeZones")}
            </Label>
            <Switch id="use-bike-zones" checked={useBikeZones} onCheckedChange={setUseBikeZones} />
          </div>
          {useBikeZones && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">{t("profile.bikeZonesHint")}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {(["free", "i1", "i2", "i3", "i4", "i5"] as const).map((k) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs uppercase">{k === "free" ? t("profile.volMax") : t("profile.zoneMax", { zone: k.toUpperCase() })}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={50}
                      max={250}
                      value={bikeZones[k]}
                      onChange={(e) => setBikeZones((prev) => ({ ...prev, [k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <HelpCircle className="h-4 w-4" />
                {t("profile.explanations")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(92vw,26rem)]">
              <p className="mb-2 text-sm font-semibold">{t("profile.intensityZones")}</p>
              <IntensityLegend />
            </PopoverContent>
          </Popover>
          <Button onClick={saveHrZones} disabled={savingHr}>{savingHr ? "…" : t("profile.saveZones")}</Button>
        </div>

      </Card>

      {isAthlete && (
        <>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold">{t("profile.coaches")}</h2>
            {coaches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("profile.noCoachYet")}</p>
            ) : (
              <ul className="space-y-2">
                {coaches.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name?.trim() || c.email || t("profile.coachFallback")}</p>
                      {c.name?.trim() && c.email && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRemoveCoachId(c.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {t("profile.removeCoach")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold">{t("profile.inviteCoach")}</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("profile.inviteCoachHint")}
            </p>
            <div className="mb-4 flex gap-2">
              <Input
                placeholder={t("profile.coachEmailPlaceholder")}
                value={coachEmail}
                onChange={(e) => setCoachEmail(e.target.value)}
              />
              <Button onClick={createInvite} disabled={creating}>{creating ? "…" : t("profile.create")}</Button>
            </div>

            {invites.filter((i) => i.status !== "revoked").length > 0 && (
              <div className="space-y-2">
                {invites.filter((i) => i.status !== "revoked").map((i) => (
                  <div key={i.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{i.coach_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.status === "pending" && t("profile.expiresOn", { date: format(new Date(i.expires_at), "d.M.yyyy") })}
                          {i.status === "accepted" && t("profile.acceptedOn", { date: i.accepted_at ? format(new Date(i.accepted_at), "d.M.yyyy") : "" })}
                          {i.status === "revoked" && t("profile.revoked")}
                          {i.status === "expired" && t("profile.expired")}
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        i.status === "pending" ? "bg-warning/20 text-warning" :
                        i.status === "accepted" ? "bg-success/20 text-success" :
                        "bg-muted text-muted-foreground"
                      }`}>{i.status}</span>
                    </div>
                    {i.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <Input readOnly value={inviteUrl(i.token)} className="text-xs" />
                        <Button size="sm" variant="outline" onClick={() => copyInvite(i.token)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(i.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {isCoach && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">{t("profile.subscription")}</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("profile.subscriptionHint")}
          </p>
          {(() => {
            const isActive = subscription
              && ["active", "trialing"].includes(subscription.status ?? "")
              && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
            if (isActive) {
              const canceling = subscription!.cancel_at_period_end === true;
              const cpe = subscription!.current_period_end
                ? format(new Date(subscription!.current_period_end), "d.M.yyyy")
                : null;
              const planLabel = subscription!.plan === "yearly" ? t("profile.planYearly") : t("profile.planMonthly");
              return (
                <div className="space-y-3">
                  <div className={canceling
                    ? "rounded-md border border-warning/40 bg-warning/10 p-3"
                    : "rounded-md border border-success/40 bg-success/10 p-3"}>
                    <p className={canceling ? "text-sm font-semibold text-warning" : "text-sm font-semibold text-success"}>
                      {canceling ? t("profile.subscriptionCancelled") : t("profile.subscriptionActive")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("profile.planLabel", { plan: planLabel })}
                      {cpe && (canceling ? t("profile.accessEnds", { date: cpe }) : t("profile.renewsOn", { date: cpe }))}
                    </p>
                    {canceling && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {t("profile.cancelingNotice")}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    {canceling ? (
                      <Button onClick={() => cancelSubscription(true)} disabled={subLoading}>
                        {subLoading ? "…" : t("profile.resumeSubscription")}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={subLoading}>
                        {t("profile.cancelSubscription")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <Badge className="w-full justify-center gap-1.5 border-warning/45 bg-warning/15 py-1.5 text-warning sm:w-auto">
                  <Clock className="h-3.5 w-3.5" />
                  {t("profile.earlyBirdBadge")}
                </Badge>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    onClick={() => startCheckout("monthly")}
                    disabled={subLoading}
                    className="h-auto flex-col items-start gap-1.5 py-3"
                  >
                    <span className="text-sm font-semibold">{t("profile.monthlyPlan")}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-lg font-bold leading-none">{t("profile.monthlySale")}</span>
                      <span className="text-xs font-normal leading-none line-through opacity-70">{t("profile.monthlyRegular")}</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => startCheckout("yearly")}
                    disabled={subLoading}
                    variant="secondary"
                    className="h-auto flex-col items-start gap-1.5 py-3"
                  >
                    <span className="text-sm font-semibold">{t("profile.yearlyPlan")}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-lg font-bold leading-none">{t("profile.yearlySale")}</span>
                      <span className="text-xs font-normal leading-none line-through opacity-70">{t("profile.yearlyRegular")}</span>
                    </span>
                  </Button>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      <Card className="p-5">

        <h2 className="mb-4 text-lg font-bold">{t("profile.changePassword")}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("profile.currentPassword")}</Label>
            <Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-2">
            <Label>{t("profile.newPassword")}</Label>
            <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label>{t("profile.confirmNewPassword")}</Label>
            <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={changingPw || !pwCurrent || !pwNew || !pwConfirm}>
              {changingPw ? "…" : t("profile.changePasswordBtn")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 border-destructive/40">
        <h2 className="mb-2 text-lg font-bold text-destructive">{t("profile.deleteAccount")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t("profile.deleteAccountHint")}
        </p>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          {t("profile.deleteAccountBtn")}
        </Button>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeletePassword(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.deleteAccountConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.deleteAccountConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>{t("profile.confirmWithPassword")}</Label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("profile.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteAccount(); }}
              disabled={deleting || !deletePassword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("profile.deleting") : t("profile.deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.cancelSubscriptionConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.cancelSubscriptionConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={subLoading}>{t("profile.back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelSubscription(); }}
              disabled={subLoading}
            >
              {subLoading ? "…" : t("profile.cancelSubscription")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeCoachId} onOpenChange={(o) => { if (!o) setRemoveCoachId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.removeCoachConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.removeCoachConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingCoach}>{t("profile.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); removeCoach(); }}
              disabled={removingCoach}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingCoach ? t("profile.removing") : t("profile.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
