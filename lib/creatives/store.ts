// ─────────────────────────────────────────────────────────────────────────────
// sprint_creatives — typed data access layer
//
// One row per (sprint, angle, platform). This module is the only place that
// touches the table; everything else goes through these helpers so we keep:
//   - Status state-machine integrity (no client can flip 'deployed' → 'draft').
//   - Idempotent upserts keyed by (sprint_id, angle_id, platform).
//   - Snake-case ↔ camel-case shape kept consistent.
//
// All functions take the service-role client and assume the caller has
// already authorised the request at the API layer.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import type {
  CreativeStatus,
  Platform,
  PolicyIssue,
  PolicySeverity,
  SprintCreative,
  SprintCreativeEditable,
} from '@/lib/agents/types';

// ── Status state machine ───────────────────────────────────────────────────
//
// Allowed transitions. The deploy pipeline holds the only path to 'deployed'
// or 'failed', so user-facing endpoints can only step within the user lane.

const TRANSITIONS: Record<CreativeStatus, CreativeStatus[]> = {
  draft:     ['reviewing', 'approved', 'rejected'],
  reviewing: ['draft', 'approved', 'rejected'],
  approved:  ['reviewing', 'rejected', 'deploying'],
  rejected:  ['draft', 'reviewing'],
  deploying: ['deployed', 'failed', 'approved'],   // back to approved on rollback
  deployed:  ['failed'],                            // post-deploy can only fail
  failed:    ['approved', 'reviewing', 'draft'],   // retryable
};

export function canTransition(from: CreativeStatus, to: CreativeStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Row shape returned by Supabase ─────────────────────────────────────────
// We keep the public type SprintCreative (snake_case) identical to the DB.

type Row = SprintCreative;

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listCreatives(sprintId: string): Promise<Row[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('sprint_creatives')
    .select('*')
    .eq('sprint_id', sprintId)
    .order('platform')
    .order('angle_id');
  if (error) throw new Error(`listCreatives failed: ${error.message}`);
  return (data ?? []) as Row[];
}

export async function getCreative(
  sprintId: string,
  angleId: string,
  platform: Platform
): Promise<Row | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('sprint_creatives')
    .select('*')
    .eq('sprint_id', sprintId)
    .eq('angle_id', angleId)
    .eq('platform', platform)
    .maybeSingle();
  if (error) throw new Error(`getCreative failed: ${error.message}`);
  return (data as Row | null) ?? null;
}

// ── Upsert (idempotent) ────────────────────────────────────────────────────

export interface UpsertInput extends Partial<SprintCreativeEditable> {
  sprint_id: string;
  angle_id: string;
  platform: Platform;
  /** Initial status; only used on insert. Existing rows keep their status. */
  initial_status?: CreativeStatus;
  /** Free-form extension data. Merged with whatever is already there. */
  meta?: Record<string, unknown>;
}

export async function upsertCreative(input: UpsertInput): Promise<Row> {
  const db = createServiceClient();
  const existing = await getCreative(input.sprint_id, input.angle_id, input.platform);

  const payload = {
    sprint_id: input.sprint_id,
    angle_id: input.angle_id,
    platform: input.platform,
    headline: input.headline ?? null,
    primary_text: input.primary_text ?? null,
    description: input.description ?? null,
    cta: input.cta ?? null,
    display_link: input.display_link ?? null,
    hook: input.hook ?? null,
    overlay_text: input.overlay_text ?? null,
    callout: input.callout ?? null,
    audience_label: input.audience_label ?? null,
    image_url: input.image_url ?? null,
    video_url: input.video_url ?? null,
    meta: { ...(existing?.meta ?? {}), ...(input.meta ?? {}) },
    // Insert path only — never overwrite an existing status here.
    ...(existing ? {} : { status: input.initial_status ?? 'draft' }),
  };

  const { data, error } = await db
    .from('sprint_creatives')
    .upsert(payload, { onConflict: 'sprint_id,angle_id,platform' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertCreative failed: ${error.message}`);
  return data as Row;
}

// ── Edit (user fields only) ────────────────────────────────────────────────
//
// Patches the editable copy fields and, if the creative was 'approved',
// drops it back to 'reviewing' so the user must re-approve after edits.
// This is the safety invariant: an approved creative is exactly what the
// user signed off on at the moment they pressed Approve — any change
// invalidates that approval.

export async function patchCreative(
  sprintId: string,
  angleId: string,
  platform: Platform,
  patch: Partial<SprintCreativeEditable>
): Promise<Row> {
  const db = createServiceClient();
  const existing = await getCreative(sprintId, angleId, platform);
  if (!existing) {
    throw new Error(`patchCreative: creative not found for ${sprintId}/${angleId}/${platform}`);
  }

  // Block edits on terminal/in-flight states.
  if (existing.status === 'deploying' || existing.status === 'deployed') {
    throw new Error(`patchCreative: cannot edit creative in status "${existing.status}"`);
  }

  const next: Record<string, unknown> = { ...patch };

  // If the user edits an approved creative, re-open it for review.
  if (existing.status === 'approved') {
    next.status = 'reviewing';
    next.approved_at = null;
    next.approved_by = null;
  }

  // Any text change invalidates a previous policy scan; force a re-scan.
  if (
    'headline' in patch || 'primary_text' in patch || 'description' in patch ||
    'cta' in patch || 'hook' in patch || 'overlay_text' in patch
  ) {
    next.policy_severity = null;
    next.policy_issues = null;
    next.policy_scanned_at = null;
  }

  const { data, error } = await db
    .from('sprint_creatives')
    .update(next)
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(`patchCreative failed: ${error.message}`);
  return data as Row;
}

// ── Status transitions ─────────────────────────────────────────────────────

export interface TransitionOpts {
  /** Approver identifier (Clerk user id, system, etc). */
  actor?: string;
  /** Required when transitioning to 'rejected'. */
  reason?: string;
  /** Optional metadata to merge into `meta`. */
  meta?: Record<string, unknown>;
}

export async function transitionStatus(
  sprintId: string,
  angleId: string,
  platform: Platform,
  to: CreativeStatus,
  opts: TransitionOpts = {}
): Promise<Row> {
  const db = createServiceClient();
  const existing = await getCreative(sprintId, angleId, platform);
  if (!existing) {
    throw new Error(`transitionStatus: not found for ${sprintId}/${angleId}/${platform}`);
  }
  if (!canTransition(existing.status, to)) {
    throw new Error(
      `transitionStatus: illegal transition "${existing.status}" → "${to}" for ${sprintId}/${angleId}/${platform}`
    );
  }

  // 'rejected' must carry a reason so the UI can show why.
  if (to === 'rejected' && !opts.reason) {
    throw new Error('transitionStatus: rejection reason required');
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === 'approved') {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = opts.actor ?? null;
    patch.rejected_reason = null;
  } else if (to === 'rejected') {
    patch.rejected_reason = opts.reason ?? null;
    patch.approved_at = null;
    patch.approved_by = null;
  } else if (to === 'deployed') {
    patch.approved_at = patch.approved_at ?? existing.approved_at;
  }
  if (opts.meta) patch.meta = { ...(existing.meta ?? {}), ...opts.meta };

  const { data, error } = await db
    .from('sprint_creatives')
    .update(patch)
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(`transitionStatus update failed: ${error.message}`);
  return data as Row;
}

// ── Policy scan persistence ────────────────────────────────────────────────

export async function recordPolicyScan(
  sprintId: string,
  angleId: string,
  platform: Platform,
  severity: PolicySeverity,
  issues: PolicyIssue[]
): Promise<Row> {
  const db = createServiceClient();
  const existing = await getCreative(sprintId, angleId, platform);
  if (!existing) {
    throw new Error(`recordPolicyScan: not found for ${sprintId}/${angleId}/${platform}`);
  }

  const { data, error } = await db
    .from('sprint_creatives')
    .update({
      policy_severity: severity,
      policy_issues: issues,
      policy_scanned_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(`recordPolicyScan failed: ${error.message}`);
  return data as Row;
}

// ── Asset references (post-Meta-upload) ────────────────────────────────────

export async function setMetaAssetRefs(
  sprintId: string,
  angleId: string,
  platform: Platform,
  refs: { image_hash?: string | null; video_id?: string | null }
): Promise<Row> {
  const db = createServiceClient();
  const existing = await getCreative(sprintId, angleId, platform);
  if (!existing) {
    throw new Error(`setMetaAssetRefs: not found for ${sprintId}/${angleId}/${platform}`);
  }
  const { data, error } = await db
    .from('sprint_creatives')
    .update({
      image_hash: refs.image_hash ?? existing.image_hash,
      video_id: refs.video_id ?? existing.video_id,
    })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(`setMetaAssetRefs failed: ${error.message}`);
  return data as Row;
}

export async function setMetaCreativeRefs(
  sprintId: string,
  angleId: string,
  platform: Platform,
  refs: { creative_id?: string | null; ad_id?: string | null; adset_id?: string | null }
): Promise<Row> {
  const db = createServiceClient();
  const existing = await getCreative(sprintId, angleId, platform);
  if (!existing) {
    throw new Error(`setMetaCreativeRefs: not found for ${sprintId}/${angleId}/${platform}`);
  }
  const { data, error } = await db
    .from('sprint_creatives')
    .update({
      creative_id: refs.creative_id ?? existing.creative_id,
      ad_id: refs.ad_id ?? existing.ad_id,
      adset_id: refs.adset_id ?? existing.adset_id,
    })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(`setMetaCreativeRefs failed: ${error.message}`);
  return data as Row;
}

// ── Approval gate helpers used by the orchestrator ────────────────────────

/**
 * Returns true iff every active channel has at least one creative approved
 * AND policy-clean. Used by the campaign launcher to decide whether the
 * sprint can move from USER_REVIEW_REQUIRED → CREATIVE_APPROVED.
 */
export async function isSprintApprovalComplete(
  sprintId: string,
  activeChannels: Platform[]
): Promise<{ ok: boolean; missing: Platform[] }> {
  if (!activeChannels.length) return { ok: false, missing: [] };
  const rows = await listCreatives(sprintId);
  const missing: Platform[] = [];
  for (const ch of activeChannels) {
    const channelRows = rows.filter((r) => r.platform === ch);
    const hasApproved = channelRows.some(
      (r) => r.status === 'approved' && r.policy_severity !== 'block'
    );
    if (!hasApproved) missing.push(ch);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Returns the set of approved creatives the deployment pipeline should push
 * to Meta. Strictly: status === 'approved' AND policy_severity !== 'block'.
 */
export async function getDeployableCreatives(
  sprintId: string,
  platform: Platform
): Promise<Row[]> {
  const rows = await listCreatives(sprintId);
  return rows.filter(
    (r) =>
      r.platform === platform &&
      r.status === 'approved' &&
      r.policy_severity !== 'block'
  );
}
