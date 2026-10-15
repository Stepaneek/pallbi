import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { publicDb } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  body: string | null;
  link_date: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string | null;
};

const POLL_MS = 5 * 60 * 1000;

export default function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    const { data } = await publicDb
      .from("notifications")
      .select("id,kind,body,link_date,read_at,created_at,actor_id")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notification[]);
  }, [user?.id]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => { load(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (!user) return null;

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    await publicDb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  };

  const open = async (n: Notification) => {
    if (!n.read_at) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await publicDb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    if (n.link_date) navigate(`/?d=${n.link_date}`);
  };

  const titleOf = (n: Notification) =>
    n.kind === "plan" ? t("notifications.planUpdated") : t("notifications.newComment");

  return (
    <DropdownMenu onOpenChange={(o) => { if (o) load(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("notifications.title")} className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("notifications.title")}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {items.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">{t("notifications.empty")}</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className={cn(
                "block w-full px-3 py-2 text-left hover:bg-accent",
                !n.read_at && "bg-primary/5",
              )}
            >
              <p className="flex items-center gap-2 text-xs font-semibold">
                {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                {titleOf(n)}
              </p>
              {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
                {n.link_date ? ` · ${n.link_date}` : ""}
              </p>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
