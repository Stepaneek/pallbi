/**
 * Workout templates — recurring training sessions saved locally per athlete
 * so coaches/athletes can re-apply a session with one click.
 */
export type TemplateSegment = { zone: string; duration: string };

export type WorkoutTemplate = {
  id: string;
  name: string;
  sport: string;
  segments: TemplateSegment[];
  distance?: string;
  notes?: string;
};

const key = (athleteId: string) => `workout_templates:${athleteId}`;

export function listTemplates(athleteId: string): WorkoutTemplate[] {
  try {
    const raw = localStorage.getItem(key(athleteId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as WorkoutTemplate[]) : [];
  } catch {
    return [];
  }
}

function write(athleteId: string, list: WorkoutTemplate[]) {
  try {
    localStorage.setItem(key(athleteId), JSON.stringify(list.slice(0, 50)));
  } catch {
    /* quota — ignore */
  }
}

export function saveTemplate(athleteId: string, tpl: Omit<WorkoutTemplate, "id">): WorkoutTemplate {
  const entry: WorkoutTemplate = { ...tpl, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  const list = listTemplates(athleteId).filter((t) => t.name !== entry.name);
  const next = [entry, ...list];
  write(athleteId, next);
  return entry;
}

export function deleteTemplate(athleteId: string, id: string): WorkoutTemplate[] {
  const next = listTemplates(athleteId).filter((t) => t.id !== id);
  write(athleteId, next);
  return next;
}
