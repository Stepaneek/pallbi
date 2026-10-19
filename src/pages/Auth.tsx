import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Activity } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { getPendingCoachInvite, redeemPendingCoachInvite } from "@/lib/coachInvite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Auth() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.slice(0, 2) ?? "cs") as "cs" | "sk" | "en";

  const emailSchema = useMemo(() => z.string().trim().email(t("auth.invalidEmail")).max(255), [t]);
  const passwordSchema = useMemo(() => z.string().min(6, t("auth.minPassword")).max(72), [t]);
  const nameSchema = useMemo(() => z.string().trim().min(1, t("auth.required")).max(80), [t]);

  /** Localized head metadata for the auth page. */
  useEffect(() => {
    document.title = t("auth.metaTitle");
    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    set('meta[name="description"]', "content", t("auth.metaDescription"));
    set('meta[property="og:title"]', "content", t("auth.metaTitle"));
    set('meta[property="og:description"]', "content", t("auth.metaDescription"));
    set('meta[property="og:locale"]', "content", lang === "cs" ? "cs_CZ" : lang === "sk" ? "sk_SK" : "en_US");
    set('link[rel="canonical"]', "href", "https://pallbi.app/auth");
    set('meta[property="og:url"]', "content", "https://pallbi.app/auth");
  }, [t, lang]);

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(resetEmail);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    setResetLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.resetSent"));
    setResetOpen(false);
    setResetEmail("");
  };

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = passwordSchema.safeParse(newPassword);
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (newPassword !== newPasswordConfirm) return toast.error(t("auth.passwordsMismatch"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: p.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.passwordChanged"));
    setRecoveryMode(false);
    setNewPassword("");
    setNewPasswordConfirm("");
    navigate("/");
  };

  const afterAuth = async () => {
    if (getPendingCoachInvite()) {
      const result = await redeemPendingCoachInvite();
      if (result.redeemed) toast.success(t("auth.inviteAccepted"));
    }
    navigate("/");
  };

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const e1 = emailSchema.safeParse(siEmail);
    const e2 = passwordSchema.safeParse(siPassword);
    if (!e1.success) return toast.error(e1.error.issues[0].message);
    if (!e2.success) return toast.error(e2.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: e1.data,
      password: e2.data,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    await afterAuth().catch((err) => toast.error(err instanceof Error ? err.message : t("auth.inviteFailed")));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nameSchema.safeParse(suName);
    const e1 = emailSchema.safeParse(suEmail);
    const e2 = passwordSchema.safeParse(suPassword);
    if (!n.success) return toast.error(n.error.issues[0].message);
    if (!e1.success) return toast.error(e1.error.issues[0].message);
    if (!e2.success) return toast.error(e2.error.issues[0].message);
    setLoading(true);
    const pending = getPendingCoachInvite();
    const { data, error } = await supabase.auth.signUp({
      email: e1.data,
      password: e2.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: n.data, ...(pending ? { initial_role: "coach" } : {}) },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      await afterAuth().catch((err) => toast.error(err instanceof Error ? err.message : "Pozvánku se nepodařilo přijmout."));
      return;
    }
    toast.success(t("auth.accountCreated"));
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      return toast.error(t("auth.googleFailed"));
    }
    if (result.redirected) return;
    await afterAuth().catch((err) => toast.error(err instanceof Error ? err.message : "Pozvánku se nepodařilo přijmout."));
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex justify-end px-4 pt-4 md:px-8">
        <LanguageSwitcher />
      </div>
      {/* FORM */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 md:px-8">

        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center md:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Activity className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">PallBi</h2>
          </div>

          <div className="hidden md:mb-8 md:flex md:flex-col md:items-center md:text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Activity className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <h2 className="mb-2 text-3xl font-bold tracking-tight">PallBi</h2>
            <p className="text-sm text-muted-foreground">
              {t("auth.subtitle")}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 card-shadow">
            {recoveryMode ? (
              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{t("auth.newPasswordTitle")}</h2>
                  <p className="text-sm text-muted-foreground">{t("auth.newPasswordDesc")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np">{t("auth.newPassword")}</Label>
                  <Input id="np" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npc">{t("auth.newPasswordConfirm")}</Label>
                  <Input id="npc" type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {t("auth.saveNewPassword")}
                </Button>
              </form>
            ) : (
            <>
            <Tabs defaultValue={initialMode}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t("auth.signinTab")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signupTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">{t("auth.email")}</Label>
                    <Input id="si-email" type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">{t("auth.password")}</Label>
                    <Input id="si-password" type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {t("auth.signInBtn")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setResetEmail(siEmail); setResetOpen(true); }}
                    className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("auth.forgot")}
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">{t("auth.name")}</Label>
                    <Input id="su-name" value={suName} onChange={(e) => setSuName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">{t("auth.email")}</Label>
                    <Input id="su-email" type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">{t("auth.password")}</Label>
                    <Input id="su-password" type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {t("auth.signUpBtn")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("auth.or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              {t("auth.google")}
            </Button>
            </>
            )}
          </div>

          <Link
            to="/"
            className="mt-6 block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("auth.back")}
          </Link>
        </div>

      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.resetTitle")}</DialogTitle>
            <DialogDescription>
              {t("auth.resetDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t("auth.email")}</Label>
              <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetLoading}>
                {t("auth.cancel")}
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {t("auth.sendLink")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
