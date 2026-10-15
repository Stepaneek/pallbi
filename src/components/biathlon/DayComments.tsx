import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { publicDb } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";

export type DayComment = {
  id: string;
  athlete_id: string;
  author_id: string;
  comment_date: string;
  body: string;
  status: string | null;
  created_at: string;
};

/** Quick status icons a coach (or athlete) can attach to a day. */
const STATUSES: { key: string; icon: string }[] = [
  { key: "good", icon: "👍" },
  { key: "warn", icon: "⚠️" },
  { key: "great", icon: "🔥" },
  { key: "rest", icon: "😴" },
];

export default function DayComments({
  athleteId,
  dateIso,
  authorNames,
  canComment = false,
}: {
  athleteId: string;
  dateIso: string;
  authorNames: Record<string, string | null>;
  /** Only a coach viewing this athlete's diary may write comments. */
  canComment?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<DayComment[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await publicDb
        .from("day_comments")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("comment_date", dateIso)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setLoading(false);
      if (error) return;
      setItems((data ?? []) as DayComment[]);
    })();
    return () => { cancelled = true; };
  }, [athleteId, dateIso]);

  const submit = async () => {
    if (!user || !canComment) return;
    if (!body.trim() && !status) return;
    setSaving(true);
    const { data, error } = await publicDb
      .from("day_comments")
      .insert({
        athlete_id: athleteId,
        author_id: user.id,
        comment_date: dateIso,
        body: body.trim(),
        status,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((cur) => [...cur, data as DayComment]);
    setBody("");
    setStatus(null);
    toast.success(t("comments.saved"));
  };

  const remove = async (id: string) => {
    const { error } = await publicDb.from("day_comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setItems((cur) => cur.filter((c) => c.id !== id));
  };

  const nameOf = (id: string) =>
    id === user?.id ? t("comments.you") : authorNames[id] ?? t("comments.coach");

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("comments.title")}
        </span>
      </div>

      <div className="divide-y">
        {loading && <p className="px-3 py-3 text-xs text-muted-foreground">{t("common.loading")}</p>}
        {!loading && items.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">{t("comments.empty")}</p>
        )}
        {items.map((c) => (
          <div key={c.id} className="flex items-start gap-2 px-3 py-2">
            {c.status && <span className="text-base leading-none">{STATUSES.find((s) => s.key === c.status)?.icon ?? ""}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-muted-foreground">{nameOf(c.author_id)}</p>
              {c.body && <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>}
            </div>
            {c.author_id === user?.id && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("comments.delete")}
                onClick={() => remove(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canComment && (
        <div className="space-y-2 border-t p-3">
          <div className="flex items-center gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatus(status === s.key ? null : s.key)}
                aria-label={t(`comments.status.${s.key}`)}
                title={t(`comments.status.${s.key}`)}
                className={`rounded-md border px-2 py-1 text-base leading-none transition-colors ${
                  status === s.key ? "border-primary bg-primary/10" : "hover:bg-accent"
                }`}
              >
                {s.icon}
              </button>
            ))}
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={t("comments.placeholder")}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={saving || (!body.trim() && !status)}>
              {t("comments.send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
