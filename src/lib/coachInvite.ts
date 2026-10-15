import { publicDb } from "@/lib/db";
import i18n from "@/i18n";

export const PENDING_COACH_INVITE_KEY = "pending_coach_invite";
export const LEGACY_PENDING_COACH_INVITE_KEY = "biathlon.pendingInvite";
export const COACH_VIEWING_ATHLETE_KEY = "pallbi.coachAthleteId";

type RedeemResponse = {
  ok: boolean;
  error?: string;
  athlete_id?: string;
};

const inviteErrorMessage = (code?: string) => {
  switch (code) {
    case "not_authenticated":
      return i18n.t("misc.coachInvite.notAuthenticated");
    case "missing_token":
    case "not_found":
      return i18n.t("misc.coachInvite.notFound");
    case "already_used":
      return i18n.t("misc.coachInvite.alreadyUsed");
    case "expired":
      return i18n.t("misc.coachInvite.expired");
    case "self_invite":
      return i18n.t("misc.coachInvite.selfInvite");
    case "subscription_required":
      return i18n.t("misc.coachInvite.subscriptionRequired");
    default:
      return i18n.t("misc.coachInvite.genericFail");
  }
};

export function savePendingCoachInvite(token: string) {
  localStorage.setItem(PENDING_COACH_INVITE_KEY, token);
  localStorage.removeItem(LEGACY_PENDING_COACH_INVITE_KEY);
}

export function getPendingCoachInvite() {
  return localStorage.getItem(PENDING_COACH_INVITE_KEY) ?? localStorage.getItem(LEGACY_PENDING_COACH_INVITE_KEY);
}

export function clearPendingCoachInvite() {
  localStorage.removeItem(PENDING_COACH_INVITE_KEY);
  localStorage.removeItem(LEGACY_PENDING_COACH_INVITE_KEY);
}

export async function redeemPendingCoachInvite() {
  const token = getPendingCoachInvite()?.trim();
  if (!token) return { redeemed: false, athleteId: null as string | null };

  const { data, error } = await publicDb.rpc("redeem_coach_invite", { _token: token });
  if (error) throw new Error(error.message || inviteErrorMessage());

  const result = data as RedeemResponse | null;
  if (!result?.ok) {
    clearPendingCoachInvite();
    throw new Error(inviteErrorMessage(result?.error));
  }

  clearPendingCoachInvite();
  const athleteId = result.athlete_id ?? null;
  if (athleteId) localStorage.setItem(COACH_VIEWING_ATHLETE_KEY, athleteId);
  return { redeemed: true, athleteId };
}