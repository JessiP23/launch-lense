// ─────────────────────────────────────────────────────────────────────────────
// Tests for the sprint_creatives data layer.
//
// We stub `@/lib/supabase` with a fluent in-memory mock that supports the
// subset of the supabase-js builder API the store uses. This keeps the
// tests fast and deterministic without needing a live Postgres instance.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── In-memory mock state ──────────────────────────────────────────────────

type Row = Record<string, unknown> & { id?: string };

const tables: Record<string, Row[]> = {
  sprint_creatives: [],
};

let nextId = 1;

function reset() {
  tables.sprint_creatives = [];
  nextId = 1;
}

interface Filter { key: string; value: unknown }

// Minimal QueryBuilder. Chains .select / .eq / .order / .maybeSingle /
// .single / .insert / .update / .upsert. Returns thenable so `await`
// resolves to { data, error } in the supabase shape.
class QueryBuilder {
  private table: string;
  private filters: Filter[] = [];
  private op: 'select' | 'update' | 'insert' | 'upsert' = 'select';
  private payload: Row | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private upsertOnConflict: string[] | null = null;

  constructor(table: string) { this.table = table; }

  select(_cols?: string) { return this; }
  order(_col: string, _opts?: unknown) { return this; }
  eq(key: string, value: unknown) { this.filters.push({ key, value }); return this; }
  single() { this.singleMode = 'single'; return this.execute(); }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this.execute(); }
  update(payload: Row) { this.op = 'update'; this.payload = payload; return this; }
  insert(payload: Row) { this.op = 'insert'; this.payload = payload; return this; }
  upsert(payload: Row, opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = payload;
    this.upsertOnConflict = opts?.onConflict ? opts.onConflict.split(',') : null;
    return this;
  }

  // Thenable: lets `await builder` work without explicit .then chain.
  then<T>(onFulfilled?: (v: { data: unknown; error: { message: string } | null }) => T) {
    const result = this.execute();
    return Promise.resolve(result).then(onFulfilled);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => row[f.key] === f.value);
  }

  private execute(): { data: unknown; error: { message: string } | null } {
    const t = tables[this.table] ?? [];

    if (this.op === 'upsert' && this.payload) {
      const keys = this.upsertOnConflict ?? [];
      const existing = t.find((row) =>
        keys.every((k) => row[k] === (this.payload as Row)[k])
      );
      if (existing) {
        Object.assign(existing, this.payload);
        return this.finalize([existing]);
      }
      const inserted: Row = { id: String(nextId++), ...this.payload };
      t.push(inserted);
      return this.finalize([inserted]);
    }

    if (this.op === 'insert' && this.payload) {
      const inserted: Row = { id: String(nextId++), ...this.payload };
      t.push(inserted);
      return this.finalize([inserted]);
    }

    if (this.op === 'update' && this.payload) {
      const matched = t.filter((row) => this.matches(row));
      for (const row of matched) Object.assign(row, this.payload);
      return this.finalize(matched);
    }

    // select
    const matched = t.filter((row) => this.matches(row));
    return this.finalize(matched);
  }

  private finalize(rows: Row[]) {
    if (this.singleMode === 'single') {
      if (rows.length === 0) return { data: null, error: { message: 'no row' } };
      return { data: rows[0], error: null };
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => new QueryBuilder(table),
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

import {
  canTransition,
  upsertCreative,
  getCreative,
  patchCreative,
  transitionStatus,
  recordPolicyScan,
  isSprintApprovalComplete,
  getDeployableCreatives,
} from './store';

const SPRINT = 'sprint-1';
const ANGLE = 'angle-A';

beforeEach(() => {
  reset();
});

// ── canTransition (pure state machine) ────────────────────────────────────

describe('canTransition', () => {
  it('allows the documented happy-path edges', () => {
    expect(canTransition('draft', 'reviewing')).toBe(true);
    expect(canTransition('reviewing', 'approved')).toBe(true);
    expect(canTransition('approved', 'deploying')).toBe(true);
    expect(canTransition('deploying', 'deployed')).toBe(true);
  });

  it('treats same-state as a no-op (allowed)', () => {
    expect(canTransition('approved', 'approved')).toBe(true);
  });

  it('rejects forbidden edges (deployed cannot rewind to draft)', () => {
    expect(canTransition('deployed', 'draft')).toBe(false);
    expect(canTransition('deployed', 'approved')).toBe(false);
    expect(canTransition('draft', 'deployed')).toBe(false);
    expect(canTransition('draft', 'deploying')).toBe(false);
  });

  it('allows failed deployments to be retried', () => {
    expect(canTransition('failed', 'approved')).toBe(true);
    expect(canTransition('failed', 'draft')).toBe(true);
  });

  it('allows deploying to roll back to approved (rollback path)', () => {
    expect(canTransition('deploying', 'approved')).toBe(true);
  });
});

// ── upsertCreative ────────────────────────────────────────────────────────

describe('upsertCreative', () => {
  it('inserts a new row with default status="draft"', async () => {
    const row = await upsertCreative({
      sprint_id: SPRINT,
      angle_id: ANGLE,
      platform: 'meta',
      headline: 'H1',
    });
    expect(row.status).toBe('draft');
    expect(row.headline).toBe('H1');
  });

  it('honors initial_status on first insert', async () => {
    const row = await upsertCreative({
      sprint_id: SPRINT,
      angle_id: ANGLE,
      platform: 'meta',
      initial_status: 'reviewing',
    });
    expect(row.status).toBe('reviewing');
  });

  it('does NOT overwrite existing status on subsequent upserts', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    // Force the row into 'approved'
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    await transitionStatus(SPRINT, ANGLE, 'meta', 'approved', { actor: 'u1' });

    const updated = await upsertCreative({
      sprint_id: SPRINT,
      angle_id: ANGLE,
      platform: 'meta',
      initial_status: 'draft', // should be ignored on update
      headline: 'New copy',
    });
    expect(updated.status).toBe('approved');
    expect(updated.headline).toBe('New copy');
  });

  it('merges meta jsonb on update', async () => {
    await upsertCreative({
      sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta',
      meta: { source: 'agent', version: 1 },
    });
    const after = await upsertCreative({
      sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta',
      meta: { version: 2, edited_by: 'user' },
    });
    expect(after.meta).toEqual({ source: 'agent', version: 2, edited_by: 'user' });
  });
});

// ── patchCreative: edit invalidates approval + scan ───────────────────────

describe('patchCreative', () => {
  it('demotes approved → reviewing on text edit and clears policy scan', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta', headline: 'A' });
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    await transitionStatus(SPRINT, ANGLE, 'meta', 'approved', { actor: 'u1' });
    await recordPolicyScan(SPRINT, ANGLE, 'meta', 'clean', []);

    const before = await getCreative(SPRINT, ANGLE, 'meta');
    expect(before?.status).toBe('approved');
    expect(before?.policy_severity).toBe('clean');
    expect(before?.approved_by).toBe('u1');

    const after = await patchCreative(SPRINT, ANGLE, 'meta', { headline: 'B' });
    expect(after.status).toBe('reviewing');
    expect(after.headline).toBe('B');
    expect(after.approved_at).toBeNull();
    expect(after.approved_by).toBeNull();
    // Policy scan must be invalidated when text changes.
    expect(after.policy_severity).toBeNull();
    expect(after.policy_issues).toBeNull();
    expect(after.policy_scanned_at).toBeNull();
  });

  it('does NOT clear policy scan when only non-text fields change', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta', headline: 'A' });
    await recordPolicyScan(SPRINT, ANGLE, 'meta', 'clean', []);

    const after = await patchCreative(SPRINT, ANGLE, 'meta', { image_url: 'https://x/y.jpg' });
    expect(after.policy_severity).toBe('clean');
    expect(after.image_url).toBe('https://x/y.jpg');
  });

  it('refuses to edit a creative in deploying/deployed status', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    await transitionStatus(SPRINT, ANGLE, 'meta', 'approved');
    await transitionStatus(SPRINT, ANGLE, 'meta', 'deploying');

    await expect(
      patchCreative(SPRINT, ANGLE, 'meta', { headline: 'nope' })
    ).rejects.toThrow(/cannot edit/);
  });
});

// ── transitionStatus ──────────────────────────────────────────────────────

describe('transitionStatus', () => {
  it('rejects illegal transitions', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    await expect(
      transitionStatus(SPRINT, ANGLE, 'meta', 'deployed')
    ).rejects.toThrow(/illegal transition/);
  });

  it('requires a reason when rejecting', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    await expect(
      transitionStatus(SPRINT, ANGLE, 'meta', 'rejected')
    ).rejects.toThrow(/reason required/);
  });

  it('stamps approver and approved_at on approval, clears them on rejection', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    const approved = await transitionStatus(SPRINT, ANGLE, 'meta', 'approved', { actor: 'u-jess' });
    expect(approved.approved_by).toBe('u-jess');
    expect(approved.approved_at).toBeTruthy();

    const rejected = await transitionStatus(SPRINT, ANGLE, 'meta', 'rejected', {
      reason: 'off-brand',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.approved_by).toBeNull();
    expect(rejected.approved_at).toBeNull();
    expect(rejected.rejected_reason).toBe('off-brand');
  });
});

// ── Approval gate helpers ─────────────────────────────────────────────────

describe('isSprintApprovalComplete', () => {
  it('returns missing=[meta] when no approved meta creative exists', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    const r = await isSprintApprovalComplete(SPRINT, ['meta']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['meta']);
  });

  it('returns ok=true once a meta creative is approved and policy-clean', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    await transitionStatus(SPRINT, ANGLE, 'meta', 'approved');
    await recordPolicyScan(SPRINT, ANGLE, 'meta', 'clean', []);
    const r = await isSprintApprovalComplete(SPRINT, ['meta']);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('treats policy_severity="block" as not approved', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: ANGLE, platform: 'meta' });
    await transitionStatus(SPRINT, ANGLE, 'meta', 'reviewing');
    await transitionStatus(SPRINT, ANGLE, 'meta', 'approved');
    await recordPolicyScan(SPRINT, ANGLE, 'meta', 'block', [
      { code: 'x', severity: 'block', message: 'banned' },
    ]);
    const r = await isSprintApprovalComplete(SPRINT, ['meta']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['meta']);
  });
});

describe('getDeployableCreatives', () => {
  it('only returns approved + non-block rows for the requested platform', async () => {
    await upsertCreative({ sprint_id: SPRINT, angle_id: 'A', platform: 'meta' });
    await upsertCreative({ sprint_id: SPRINT, angle_id: 'B', platform: 'meta' });
    await upsertCreative({ sprint_id: SPRINT, angle_id: 'C', platform: 'google' });

    // A: approved + clean → included
    await transitionStatus(SPRINT, 'A', 'meta', 'reviewing');
    await transitionStatus(SPRINT, 'A', 'meta', 'approved');
    // B: approved + block → excluded
    await transitionStatus(SPRINT, 'B', 'meta', 'reviewing');
    await transitionStatus(SPRINT, 'B', 'meta', 'approved');
    await recordPolicyScan(SPRINT, 'B', 'meta', 'block', [
      { code: 'x', severity: 'block', message: 'banned' },
    ]);
    // C: wrong platform → excluded
    await transitionStatus(SPRINT, 'C', 'google', 'reviewing');
    await transitionStatus(SPRINT, 'C', 'google', 'approved');

    const out = await getDeployableCreatives(SPRINT, 'meta');
    expect(out.map((r) => r.angle_id).sort()).toEqual(['A']);
  });
});
