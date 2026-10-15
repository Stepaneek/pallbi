import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { publicDb } from "@/lib/db";

export interface AthleteGroup {
  id: string;
  name: string;
}

export interface GroupMember {
  group_id: string;
  athlete_id: string;
}

/** Coach-owned athlete groups (categories) with membership. */
export function useAthleteGroups(coachId: string | null | undefined, enabled = true) {
  const [groups, setGroups] = useState<AthleteGroup[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!coachId || !enabled) return;
    setLoading(true);
    const { data: gs, error } = await publicDb
      .from("athlete_groups")
      .select("id, name")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setGroups(gs ?? []);
    const ids = (gs ?? []).map((g) => g.id);
    if (ids.length) {
      const { data: ms } = await publicDb
        .from("athlete_group_members")
        .select("group_id, athlete_id")
        .in("group_id", ids);
      setMembers(ms ?? []);
    } else {
      setMembers([]);
    }
    setLoading(false);
  }, [coachId, enabled]);

  useEffect(() => { load(); }, [load]);

  const createGroup = async (name: string) => {
    if (!coachId || !name.trim()) return;
    const { data, error } = await publicDb
      .from("athlete_groups")
      .insert({ coach_id: coachId, name: name.trim() })
      .select("id, name")
      .single();
    if (error) return toast.error(error.message);
    if (data) setGroups((prev) => [...prev, data]);
  };

  const renameGroup = async (id: string, name: string) => {
    if (!name.trim()) return;
    const { error } = await publicDb.from("athlete_groups").update({ name: name.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)));
  };

  const deleteGroup = async (id: string) => {
    const { error } = await publicDb.from("athlete_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setMembers((prev) => prev.filter((m) => m.group_id !== id));
  };

  const toggleMember = async (groupId: string, athleteId: string) => {
    const exists = members.some((m) => m.group_id === groupId && m.athlete_id === athleteId);
    if (exists) {
      const { error } = await publicDb
        .from("athlete_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("athlete_id", athleteId);
      if (error) return toast.error(error.message);
      setMembers((prev) => prev.filter((m) => !(m.group_id === groupId && m.athlete_id === athleteId)));
    } else {
      const { error } = await publicDb
        .from("athlete_group_members")
        .insert({ group_id: groupId, athlete_id: athleteId });
      if (error) return toast.error(error.message);
      setMembers((prev) => [...prev, { group_id: groupId, athlete_id: athleteId }]);
    }
  };

  const athleteIdsInGroup = (groupId: string) =>
    members.filter((m) => m.group_id === groupId).map((m) => m.athlete_id);

  return { groups, members, loading, reload: load, createGroup, renameGroup, deleteGroup, toggleMember, athleteIdsInGroup };
}
