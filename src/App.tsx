import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { RoleProvider } from "@/hooks/useRole";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import PendingCoachInviteRedeemer from "@/components/PendingCoachInviteRedeemer";
import { LOCALIZED_PATHS, type LanguageCode } from "@/i18n";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Week from "./pages/Week";

import Summary from "./pages/Summary";
import Races from "./pages/Races";
import Profile from "./pages/Profile";
import AcceptInvite from "./pages/AcceptInvite";
import StravaCallback from "./pages/StravaCallback";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

import Admin from "./pages/Admin";
import AdminUserWeek from "./pages/AdminUserWeek";
import Analytics from "./pages/Analytics";
import Team from "./pages/Team";
import NotFound from "./pages/NotFound.tsx";
import { ShootingZeroingView } from "@/components/biathlon/ShootingZeroingView";

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

const Root = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Landing />;
  return (
    <AppShell>
      <Week />
    </AppShell>
  );
};

/** Language-specific public landing routes (/sk, /en, /de, …) for SEO. */
const LocalizedLanding = ({ lang }: { lang: LanguageCode }) => {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (i18n.language?.slice(0, 2) !== lang) i18n.changeLanguage(lang);
  }, [lang, i18n]);
  return <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
            <PendingCoachInviteRedeemer />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              <Route path="/strava/callback" element={<Shell><StravaCallback /></Shell>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/" element={<Root />} />

              {LOCALIZED_PATHS.map((code) => (
                <Route key={code} path={`/${code}`} element={<LocalizedLanding lang={code} />} />
              ))}
              <Route path="/summary" element={<Shell><Summary /></Shell>} />
              <Route path="/analytics" element={<Shell><Analytics /></Shell>} />
              <Route path="/team" element={<Shell><Team /></Shell>} />
              <Route path="/races" element={<Shell><Races /></Shell>} />
              <Route path="/profile" element={<Shell><Profile /></Shell>} />
              <Route path="/zeroing" element={<Shell><ShootingZeroingView /></Shell>} />
              <Route path="/admin" element={<Shell><Admin /></Shell>} />
              <Route path="/admin/user/:userId" element={<Shell><AdminUserWeek /></Shell>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;