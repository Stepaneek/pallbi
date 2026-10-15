import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Brush, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import StravaBadge from "@/components/StravaBadge";

interface Props {
  athleteId: string;
  activityId: string;
}

type ZoneRow = {
  hr_i1_max: number | null;
  hr_i2_max: number | null;
  hr_i3_max: number | null;
  hr_i4_max: number | null;
  hr_i5_max: number | null;
  max_hr_free: number | null;
};

const ZONE_COLORS: Record<string, string> = {
  VOL: "#94a3b8",
  I1: "#22c55e",
  I2: "#84cc16",
  I3: "#eab308",
  I4: "#f97316",
  I5: "#ef4444",
};

export default function StravaHrChart({ athleteId, activityId }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ t: number; hr: number }[] | null>(null);
  const [zones, setZones] = useState<ZoneRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selection (drag) state
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const selecting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setRange(null);
      setSelStart(null);
      setSelEnd(null);
      try {
        const [streamRes, profRes] = await Promise.all([
          supabase.functions.invoke("strava-activity-streams", {
            body: { athlete_id: athleteId, activity_id: activityId },
          }),
          supabase
            .from("profiles")
            .select("hr_i1_max,hr_i2_max,hr_i3_max,hr_i4_max,hr_i5_max,max_hr_free")
            .eq("id", athleteId)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const sd = streamRes.data as { heartrate?: number[]; time?: number[] } | null;
        if (streamRes.error || !sd?.heartrate || !sd?.time || sd.heartrate.length === 0) {
          setData(null);
        } else {
          const len = Math.min(sd.heartrate.length, sd.time.length);
          const arr: { t: number; hr: number }[] = [];
          // Downsample for perf
          const step = Math.max(1, Math.floor(len / 600));
          for (let i = 0; i < len; i += step) arr.push({ t: sd.time[i], hr: sd.heartrate[i] });
          setData(arr);
        }
        setZones((profRes.data as ZoneRow) ?? null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [athleteId, activityId]);

  const brushIdx = useMemo(() => {
    if (!data || data.length === 0) return { start: 0, end: 0 };
    if (!range) return { start: 0, end: data.length - 1 };
    let start = data.findIndex((d) => d.t >= range.from);
    if (start < 0) start = 0;
    let end = data.length - 1;
    while (end > start && data[end].t > range.to) end--;
    return { start, end };
  }, [data, range]);

  const visibleData = useMemo(() => {
    if (!data) return null;
    if (!range) return data;
    return data.slice(brushIdx.start, brushIdx.end + 1);
  }, [data, range, brushIdx]);

  const stats = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return null;
    let sum = 0;
    let max = -Infinity;
    for (const d of visibleData) {
      sum += d.hr;
      if (d.hr > max) max = d.hr;
    }
    const duration = Math.max(0, visibleData[visibleData.length - 1].t - visibleData[0].t);
    return { avg: Math.round(sum / visibleData.length), max, duration };
  }, [visibleData]);

  if (loading) {
    return (
      <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
        {t("diary.loadingHrStream")}
      </div>
    );
  }
  if (error || !data || data.length === 0) return null;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const refs: { label: string; value: number; color: string }[] = [];
  if (zones?.max_hr_free) refs.push({ label: "VOL", value: zones.max_hr_free, color: ZONE_COLORS.VOL });
  if (zones?.hr_i1_max) refs.push({ label: "I1", value: zones.hr_i1_max, color: ZONE_COLORS.I1 });
  if (zones?.hr_i2_max) refs.push({ label: "I2", value: zones.hr_i2_max, color: ZONE_COLORS.I2 });
  if (zones?.hr_i3_max) refs.push({ label: "I3", value: zones.hr_i3_max, color: ZONE_COLORS.I3 });
  if (zones?.hr_i4_max) refs.push({ label: "I4", value: zones.hr_i4_max, color: ZONE_COLORS.I4 });
  if (zones?.hr_i5_max) refs.push({ label: "I5", value: zones.hr_i5_max, color: ZONE_COLORS.I5 });

  const onMouseDown = (state: { activeLabel?: string | number }) => {
    if (state?.activeLabel == null) return;
    selecting.current = true;
    setSelStart(Number(state.activeLabel));
    setSelEnd(Number(state.activeLabel));
  };

  const onMouseMove = (state: { activeLabel?: string | number }) => {
    if (!selecting.current || state?.activeLabel == null) return;
    setSelEnd(Number(state.activeLabel));
  };

  const onMouseUp = () => {
    if (!selecting.current) return;
    selecting.current = false;
    if (selStart != null && selEnd != null) {
      const from = Math.min(selStart, selEnd);
      const to = Math.max(selStart, selEnd);
      // Ignore tiny selections (accidental clicks)
      if (to - from >= 5) setRange({ from, to });
    }
    setSelStart(null);
    setSelEnd(null);
  };

  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("diary.hrFromStrava")}</span>
        {range && (
          <button
            type="button"
            onClick={() => setRange(null)}
            className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {t("diary.hrZoomReset")}
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/70">{t("diary.hrZoomHint")}</p>
      <div className="h-80 w-full select-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              tickFormatter={fmtTime}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              minTickGap={40}
              domain={["dataMin", "dataMax"]}
              type="number"
            />
            <YAxis
              domain={["dataMin - 10", "dataMax + 10"]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
                color: "hsl(var(--popover-foreground))",
              }}
              labelFormatter={(v) => `${t("diary.time")} ${fmtTime(Number(v))}`}
              formatter={(v: number) => [`${v} bpm`, t("diary.hr")]}
            />
            {refs.map((r) => (
              <ReferenceLine
                key={r.label}
                y={r.value}
                stroke={r.color}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: r.label, fill: r.color, fontSize: 10, position: "right" }}
              />
            ))}
            <Line type="monotone" dataKey="hr" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Brush
              dataKey="t"
              height={28}
              travellerWidth={10}
              startIndex={brushIdx.start}
              endIndex={brushIdx.end}
              tickFormatter={fmtTime}
              stroke="hsl(var(--primary))"
              fill="hsl(var(--muted))"
              onChange={(r: { startIndex?: number; endIndex?: number }) => {
                if (r?.startIndex == null || r?.endIndex == null) return;
                if (r.startIndex === 0 && r.endIndex === data.length - 1) { setRange(null); return; }
                setRange({ from: data[r.startIndex].t, to: data[r.endIndex].t });
              }}
            >
              <LineChart data={data}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line type="monotone" dataKey="hr" stroke="hsl(var(--primary))" strokeWidth={1} dot={false} isAnimationActive={false} />
              </LineChart>
            </Brush>
            {selStart != null && selEnd != null && (
              <ReferenceArea
                x1={Math.min(selStart, selEnd)}
                x2={Math.max(selStart, selEnd)}
                stroke="hsl(var(--primary))"
                strokeOpacity={0.5}
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {range && stats && (
        <div className="grid grid-cols-3 gap-2 rounded-md border bg-foreground/5 p-2 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("diary.hrAvg")}</div>
            <div className="text-sm font-bold">{stats.avg} bpm</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("diary.hrMax")}</div>
            <div className="text-sm font-bold">{stats.max} bpm</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("diary.hrDuration")}</div>
            <div className="text-sm font-bold">{fmtTime(stats.duration)}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end border-t pt-1"><StravaBadge /></div>
    </div>
  );
}
