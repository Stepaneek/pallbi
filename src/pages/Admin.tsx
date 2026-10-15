import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const ADMIN_ID = "feee4b11-b3c3-4c77-bd8f-81a399633bf4";

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  club: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  strava_connected?: boolean;
};

function StravaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.102 12.323h4.172" />
    </svg>
  );
}

function StravaBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium " +
        (connected
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground")
      }
    >
      <StravaLogo className="h-3 w-3" />
      {connected ? "Strava propojena" : "Strava nepropojena"}
    </span>
  );
}

export default function Admin() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("admin-list-users", { body: {} });
    if (error) {
      setError(error.message);
      return;
    }
    const payload = data as { error?: string; users?: Row[] } | null;
    if (payload?.error) {
      setError(payload.error);
      return;
    }
    setRows(payload?.users ?? []);
  };

  useEffect(() => {
    if (!user || user.id !== ADMIN_ID) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) return null;
  if (!user || user.id !== ADMIN_ID) return <Navigate to="/" replace />;

  const fmt = (d: string | null) => (d ? format(new Date(d), "d.M.yyyy HH:mm") : "—");

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: target.id },
    });
    setDeleting(false);
    const payload = data as { error?: string; ok?: boolean } | null;
    if (error || payload?.error) {
      toast.error(payload?.error ?? error?.message ?? t("misc.admin.deleteFailed"));
      return;
    }
    toast.success(t("misc.admin.deleted", { email: target.email ?? target.id }));
    setTarget(null);
    setRows((prev) => (prev ? prev.filter((r) => r.id !== target.id) : prev));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold">{t("misc.admin.title")}</h1>
      {rows !== null && (
        <div className="text-lg font-semibold">
          {t("misc.admin.totalUsers")} <span className="text-primary">{rows.length}</span>
        </div>
      )}
      <Card className="overflow-hidden">
        {error ? (
          <div className="p-4 text-sm text-destructive">{error}</div>
        ) : rows === null ? (
          <div className="p-4 text-sm text-muted-foreground">{t("misc.admin.loading")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("misc.admin.email")}</TableHead>
                <TableHead>{t("misc.admin.name")}</TableHead>
                <TableHead>{t("misc.admin.club")}</TableHead>
                <TableHead>{t("misc.admin.userId")}</TableHead>
                <TableHead>{t("misc.admin.registeredAt")}</TableHead>
                <TableHead>{t("misc.admin.lastSignIn")}</TableHead>
                <TableHead>Strava</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email ?? "—"}</TableCell>
                  <TableCell>{r.name ?? "—"}</TableCell>
                  <TableCell>{r.club ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmt(r.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmt(r.last_sign_in_at)}</TableCell>
                  <TableCell><StravaBadge connected={!!r.strava_connected} /></TableCell>
                  <TableCell className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/user/${r.id}`}>{t("misc.admin.viewJournal")}</Link>
                    </Button>
                    {r.id !== ADMIN_ID && (
                      <Button size="sm" variant="destructive" onClick={() => setTarget(r)}>
                        {t("misc.admin.deleteAccount")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    {t("misc.admin.noUsers")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("misc.admin.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("misc.admin.deleteDescription", { target: target?.email ?? target?.id })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("misc.admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("misc.admin.deleting") : t("misc.admin.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
