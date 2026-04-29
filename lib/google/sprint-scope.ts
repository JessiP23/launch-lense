import type { SprintRecord } from '@/lib/agents/types';

/** Single OAuth credential bucket per org; falls back to sprint id when org is unset */
export function oauthScopeKeyFromSprint(row: {
  id?: string;
  sprint_id?: string;
  org_id?: string | null;
}): string {
  if (row.org_id) return row.org_id;
  const sid = row.id ?? row.sprint_id;
  if (!sid) throw new Error('Cannot derive OAuth scope without sprint id');
  return sid;
}

export function oauthScopeKeyFromRecord(sprint: SprintRecord): string {
  return oauthScopeKeyFromSprint({
    id: sprint.sprint_id,
    sprint_id: sprint.sprint_id,
    org_id: sprint.org_id,
  });
}
