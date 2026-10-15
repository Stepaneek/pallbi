import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { getPendingCoachInvite, redeemPendingCoachInvite } from "@/lib/coachInvite";

export default function PendingCoachInviteRedeemer() {
  const { user, loading } = useAuth();
  const { refresh, setViewingAthleteId } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const redeemingRef = useRef(false);

  useEffect(() => {
    if (loading || !user || redeemingRef.current || !getPendingCoachInvite()) return;

    redeemingRef.current = true;
    (async () => {
      try {
        const result = await redeemPendingCoachInvite();
        if (result.athleteId) setViewingAthleteId(result.athleteId);
        await refresh();
        if (result.redeemed) toast.success(i18n.t("misc.invite.accepted"));
        navigate("/", { replace: location.pathname.startsWith("/invite/") });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : i18n.t("misc.invite.failed"));
      } finally {
        redeemingRef.current = false;
      }
    })();
  }, [loading, user?.id, location.pathname, navigate, refresh, setViewingAthleteId]);

  return null;
}