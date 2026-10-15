import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";

type DbResult<T = unknown> = {
  data: T | null;
  error: { code?: string; message?: string; status?: number; details?: string; hint?: string } | null;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const publicDb = supabase.schema("public");

export async function waitForAuthSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export const isSchemaCacheError = (error: DbResult["error"]) =>
  !!error &&
  (error.code === "PGRST002" ||
    error.code === "PGRST001" ||
    error.status === 503 ||
    /schema cache|Retrying/i.test(error.message ?? ""));

export async function reloadPublicSchemaCache() {
  await publicDb.rpc("reload_public_schema_cache");
}

export async function initializePublicSchema() {
  try {
    await reloadPublicSchemaCache();
    await publicDb.from("profiles").select("id").limit(1);
    await publicDb.from("training_blocks").select("id").limit(1);
  } catch {
    // Calls that need the database use retry logic and visible recovery UI.
  }
}

export const FRIENDLY_BACKEND_UNAVAILABLE_KEY = "misc.dbErrors.backendUnavailable";
export const FRIENDLY_BACKEND_UNAVAILABLE = () => i18n.t(FRIENDLY_BACKEND_UNAVAILABLE_KEY);

export function friendlyDbError(error: DbResult["error"]): string {
  if (!error) return "";
  if (isSchemaCacheError(error)) return i18n.t("misc.dbErrors.backendUnavailable");
  return error.message ?? i18n.t("misc.dbErrors.unknown");
}

export async function withSchemaRetry<T>(operation: () => PromiseLike<DbResult<T>>, attempts = 5): Promise<DbResult<T>> {
  let result: DbResult<T> = { data: null, error: null };

  for (let i = 0; i < attempts; i += 1) {
    await waitForAuthSession();
    result = await operation();
    if (!isSchemaCacheError(result.error) || i === attempts - 1) return result;

    console.log("Supabase schema cache retry", {
      attempt: i + 1,
      code: result.error?.code,
      message: result.error?.message,
      details: result.error?.details,
      hint: result.error?.hint,
      status: result.error?.status,
    });
    await reloadPublicSchemaCache().catch(() => undefined);
    // Longer backoff: 500ms, 1s, 2s, 4s — gives PostgREST time to recover.
    await sleep(500 * 2 ** i);
  }

  return result;
}
