import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, Calendar, BarChart3, Trophy, User as UserIcon, LogOut, Moon, Sun, LineChart, MessageCircle, Users, Target } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useTheme } from "@/hooks/useTheme";
import { useStravaSync } from "@/hooks/useStravaSync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import OnboardingModal from "@/components/OnboardingModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";
import StravaBadge from "@/components/StravaBadge";

const baseLinks = [
  { to: "/", labelKey: "nav.week", icon: Calendar },
  { to: "/zeroing", labelKey: "nav.zeroing", icon: Target },
  { to: "/summary", labelKey: "nav.summary", icon: BarChart3 },
  { to: "/analytics", labelKey: "nav.analytics", icon: LineChart },
  { to: "/races", labelKey: "nav.races", icon: Trophy },
  { to: "/profile", labelKey: "nav.profile", icon: UserIcon },
];
const coachLink = { to: "/team", labelKey: "nav.team", icon: Users };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isCoach, isAthlete } = useRole();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [club, setClub] = useState<string | null>(null);
  const links = isCoach ? [baseLinks[0], coachLink, ...baseLinks.slice(1)] : baseLinks;

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setClub(null);
      return;
    }
    (async () => {
      const { data } = await supabase.functions.invoke("profile-manage", { body: { action: "get" } });
      if (cancelled) return;
      const c = (data as { profile?: { club?: string | null } } | null)?.profile?.club ?? null;
      setClub(c);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const { sync } = useStravaSync(user?.id);
  const syncingRef = useRef(false);
  useEffect(() => {
    if (!user?.id) return;
    const KEY = "strava_last_sync_v4";
    const INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 h
    const TICK_MS = 5 * 60 * 1000; // check every 5 min

    const maybeSync = async () => {
      if (syncingRef.current) return;
      const last = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - last < INTERVAL_MS) return;
      syncingRef.current = true;
      const toastId = toast.loading(t("strava.syncing"));
      try {
        const result = await sync(true);
        if (result === "ok") {
          localStorage.setItem(KEY, String(Date.now()));
          toast.success(t("strava.synced"), { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } finally {
        syncingRef.current = false;
      }
    };

    maybeSync();
    const intervalId = window.setInterval(() => { maybeSync(); }, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") { maybeSync(); }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, sync, t]);

  const roleLabel = isCoach && isAthlete ? t("roles.athleteCoach") : isCoach ? t("roles.coach") : t("roles.athlete");

  return (
    <div className="min-h-screen bg-canvas">
      <OnboardingModal />
      <header className="sticky top-0 z-40 border-b bg-card/95 shadow-sm backdrop-blur dark:shadow-none">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight">PallBi</h1>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground max-w-[130px] sm:max-w-[260px]">
                {club ?? roleLabel}
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 xl:flex">
            {links.map(({ to, labelKey, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "btn-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" /> {labelKey.startsWith("nav.") ? t(labelKey) : labelKey}
              </NavLink>
            ))}
            <a
              href="https://tally.so/r/gDzjYK"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" /> {t("nav.feedback")}
            </a>
          </nav>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("nav.signOut")}
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 pb-24 xl:pb-6">
        <div key={location.pathname} className="page-enter">{children}</div>
        <div className="mt-6 flex justify-center border-t pt-3 md:hidden"><StravaBadge /></div>
      </main>

      <footer className="hidden border-t bg-card py-6 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground">Ochrana osobních údajů</a>
            <a href="/terms" className="hover:text-foreground">Podmínky užívání</a>
          </div>
          <div className="flex items-center gap-6"><StravaBadge /><span>© {new Date().getFullYear()} PallBi</span></div>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-40 overflow-x-auto border-t bg-card/95 backdrop-blur xl:hidden">
        <div className="mx-auto grid min-w-max max-w-7xl" style={{ gridTemplateColumns: `repeat(${links.length + 1}, minmax(64px, 1fr))` }}>
          {links.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                   "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                   isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {labelKey.startsWith("nav.") ? t(labelKey) : labelKey}
            </NavLink>
          ))}
          <a
            href="https://tally.so/r/gDzjYK"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
          >
            <MessageCircle className="h-5 w-5" />
            {t("nav.feedback")}
          </a>
        </div>
      </nav>
    </div>
  );
}