import { useEffect, useState } from "react";
import { toast } from "sonner";
import { publicDb, withSchemaRetry } from "@/lib/db";
import { Json } from "@/integrations/supabase/types";
import { isoYearWeek } from "@/lib/week";

export type MetaData = {
  DZ?: number[]; JZ?: number[]; NEMOC?: number[]; ZO?: number[];
  "KT.START"?: number[]; "BIA.START"?: number[];
  "REG.aktivni"?: number[]; "REG.pasivni"?: number[];
  /** Single merged recovery row (replaces the active/passive split). */
  REG?: number[];
  "OSI.postura"?: number[]; "OSI.sila"?: number[];
  "SSI.I1"?: number[]; "SSI.I2"?: number[]; "SSI.I3"?: number[]; "SSI.I4"?: number[]; "SSI.I5"?: number[];
  "VN.klid"?: number[]; "VN.I12"?: number[]; "VN.I3"?: number[]; "VN.I45"?: number[]; "VN.suchy"?: number[];
  NT?: number[];
  MORNING_HR?: number[];
  SLEEP?: number[]; FATIGUE?: number[]; SORENESS?: number[];
};

const ZEROS = () => [0, 0, 0, 0, 0, 0, 0];

export const ensureArr = (v: unknown): number[] => {
  if (Array.isArray(v) && v.length === 7) return v.map((x) => Number(x) || 0);
  return ZEROS();
};

/**
 * Recovery row value: the merged REG key once it exists, otherwise the sum of
 * the legacy active + passive rows so older weeks keep showing their numbers.
 */
export const regeneraceValue = (meta: MetaData): number[] => {
  if (Array.isArray(meta.REG)) return ensureArr(meta.REG);
  const active = ensureArr(meta["REG.aktivni"]);
  const passive = ensureArr(meta["REG.pasivni"]);
  return active.map((v, i) => v + (passive[i] || 0));
};

export function useWeeklyMeta(athleteId: string | null, weekStart: Date, planOrReal: "plan" | "real", canEdit: boolean) {
  const { iso_year, iso_week } = isoYearWeek(weekStart);
  const [meta, setMeta] = useState<MetaData>({});
  const [metaId, setMetaId] = useState<string | null>(null);

  useEffect(() => {
    if (!athleteId) return;
    let cancelled = false;
    (async () => {
      const { data } = await withSchemaRetry(() => publicDb
        .from("weekly_meta")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("iso_year", iso_year)
        .eq("iso_week", iso_week)
        .eq("plan_or_real", planOrReal)
        .maybeSingle());
      if (cancelled) return;
      if (data) {
        setMeta((data.data as MetaData) || {});
        setMetaId(data.id);
      } else {
        setMeta({});
        setMetaId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [athleteId, iso_year, iso_week, planOrReal]);

  const saveMeta = async (next: MetaData) => {
    setMeta(next);
    if (!canEdit || !athleteId) return;
    if (metaId) {
      const { error } = await publicDb.from("weekly_meta").update({ data: next as unknown as Json }).eq("id", metaId);
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await publicDb
        .from("weekly_meta")
        .insert({ athlete_id: athleteId, iso_year, iso_week, plan_or_real: planOrReal, data: next as unknown as Json })
        .select()
        .single();
      if (error) toast.error(error.message);
      else if (data) setMetaId(data.id);
    }
  };

  const setMetaCell = (key: keyof MetaData, day: number, val: string) => {
    const arr = ensureArr(meta[key]);
    arr[day] = parseFloat(val) || 0;
    saveMeta({ ...meta, [key]: arr });
  };

  return { meta, setMetaCell, saveMeta };
}
