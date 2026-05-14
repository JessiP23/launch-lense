'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useCreatives(sprintId)
//
// Single source of truth for the editable creative workflow on the client:
//   - Loads sprint_creatives rows (GET /api/sprint/[id]/creatives).
//   - Field-level autosave with per-(angle,platform) debouncing.
//   - Approve / reject / regenerate / scan helpers.
//   - Derived: isApprovalComplete, missing channels, busy/saving flags.
//
// Optimistic updates: edits are applied to the local cache immediately;
// the server response replaces the row when it lands so the UI never
// flickers. We coalesce rapid edits per (angle,platform) tuple into a
// single PATCH using a 350 ms debounce window.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreativeStatus,
  Platform,
  PolicyIssue,
  SprintCreative,
  SprintCreativeEditable,
} from '@/lib/agents/types';

const DEBOUNCE_MS = 350;

type EditableField = keyof SprintCreativeEditable;

type Key = `${string}::${Platform}`;
const k = (angleId: string, platform: Platform): Key => `${angleId}::${platform}` as Key;

// ── Patch queue ───────────────────────────────────────────────────────────
//
// We keep one pending patch per (angle,platform) so successive edits
// merge into the same PATCH. Each entry has a single timer that fires
// after DEBOUNCE_MS of inactivity for that key.

interface PendingPatch {
  patch: Partial<SprintCreativeEditable>;
  timer: ReturnType<typeof setTimeout> | null;
}

interface UseCreativesOpts {
  /** active channels from the sprint; used for deploy-gate completeness. */
  activeChannels?: Platform[];
}

export interface ScanResult {
  severity: 'clean' | 'warn' | 'block';
  issues: PolicyIssue[];
  blocked: boolean;
}

export function useCreatives(sprintId: string | null | undefined, opts: UseCreativesOpts = {}) {
  const [creatives, setCreatives] = useState<SprintCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<Key>>(new Set());
  const [busyKeys, setBusyKeys] = useState<Set<Key>>(new Set()); // approve/reject/regen
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef<Map<Key, PendingPatch>>(new Map());

  // Index for fast lookup by (angle,platform).
  const byKey = useMemo(() => {
    const m = new Map<Key, SprintCreative>();
    for (const row of creatives) m.set(k(row.angle_id, row.platform), row);
    return m;
  }, [creatives]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!sprintId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sprint/${sprintId}/creatives`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load creatives (${res.status})`);
      const data = (await res.json()) as { creatives: SprintCreative[] };
      setCreatives(data.creatives ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load creatives');
    } finally {
      setLoading(false);
    }
  }, [sprintId]);

  useEffect(() => { void refetch(); }, [refetch]);

  // Cancel any pending timers on unmount so we don't fire after teardown.
  useEffect(() => () => {
    for (const entry of pendingRef.current.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    pendingRef.current.clear();
  }, []);

  // ── Internal: apply optimistic update ────────────────────────────────────
  //
  // Rows are eagerly materialised server-side (see lib/creatives/seed.ts)
  // the moment angles are generated, so the local cache should always
  // contain a matching row by the time the user is able to edit anything.
  // If for some reason it doesn't, we silently no-op the optimistic step
  // and rely on the server response to populate the cache — better than
  // inserting a stub that diverges from the canonical row.
  const applyLocal = useCallback(
    (angleId: string, platform: Platform, fields: Partial<SprintCreative>) => {
      setCreatives((prev) => {
        const idx = prev.findIndex((r) => r.angle_id === angleId && r.platform === platform);
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], ...fields };
        return next;
      });
    },
    []
  );

  const setSaving = (key: Key, on: boolean) => {
    setSavingKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };
  const setBusy = (key: Key, on: boolean) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };

  // ── Flush a queued patch for one key ────────────────────────────────────
  const flush = useCallback(async (angleId: string, platform: Platform) => {
    if (!sprintId) return;
    const key = k(angleId, platform);
    const entry = pendingRef.current.get(key);
    if (!entry) return;
    pendingRef.current.delete(key);

    setSaving(key, true);
    try {
      // Rows are eagerly seeded server-side at angle-generation time, so
      // the canonical PATCH endpoint is always available. No upsert dance.
      const res = await fetch(
        `/api/sprint/${sprintId}/creatives/${encodeURIComponent(angleId)}/${platform}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.patch),
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Save failed: ${res.status} ${errText}`);
      }
      const data = (await res.json()) as { creative: SprintCreative };
      // Replace the local row with the canonical server copy.
      setCreatives((prev) => {
        const idx = prev.findIndex((r) => r.angle_id === angleId && r.platform === platform);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = data.creative;
          return next;
        }
        return [...prev, data.creative];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(key, false);
    }
  }, [byKey, sprintId]);

  // ── Public: edit a field ────────────────────────────────────────────────
  const editField = useCallback(<F extends EditableField>(
    angleId: string,
    platform: Platform,
    field: F,
    value: SprintCreativeEditable[F]
  ) => {
    const key = k(angleId, platform);
    // Optimistic local update.
    applyLocal(angleId, platform, { [field]: value } as Partial<SprintCreative>);

    // Coalesce into the pending patch.
    const existing = pendingRef.current.get(key) ?? { patch: {}, timer: null };
    if (existing.timer) clearTimeout(existing.timer);
    existing.patch = { ...existing.patch, [field]: value };
    existing.timer = setTimeout(() => { void flush(angleId, platform); }, DEBOUNCE_MS);
    pendingRef.current.set(key, existing);
  }, [applyLocal, flush]);

  // ── Public: imperative save (immediate flush) ───────────────────────────
  const saveNow = useCallback(async (angleId: string, platform: Platform) => {
    const key = k(angleId, platform);
    const entry = pendingRef.current.get(key);
    if (entry?.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    await flush(angleId, platform);
  }, [flush]);

  // ── Public: status transitions ──────────────────────────────────────────
  const transition = useCallback(async (
    angleId: string,
    platform: Platform,
    to: CreativeStatus,
    extras: { reason?: string; actor?: string } = {}
  ) => {
    if (!sprintId) return;
    const key = k(angleId, platform);
    // Flush any pending edits before transitioning to avoid losing copy.
    await saveNow(angleId, platform);
    setBusy(key, true);
    try {
      const res = await fetch(
        `/api/sprint/${sprintId}/creatives/${encodeURIComponent(angleId)}/${platform}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, ...extras }),
        }
      );
      const data = await res.json().catch(() => null) as
        | { creative?: SprintCreative; error?: string; severity?: ScanResult['severity']; issues?: PolicyIssue[] }
        | null;
      if (!res.ok) {
        // 409 with policy block — surface scan details to the caller.
        if (res.status === 409 && data?.issues) {
          throw new Error(data.error ?? 'Approval blocked by policy');
        }
        throw new Error(data?.error ?? `Transition failed (${res.status})`);
      }
      if (data?.creative) {
        setCreatives((prev) => {
          const idx = prev.findIndex((r) => r.id === data.creative!.id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = data.creative!;
            return next;
          }
          return [...prev, data.creative!];
        });
      }
      return data?.creative ?? null;
    } finally {
      setBusy(key, false);
    }
  }, [saveNow, sprintId]);

  const approve = useCallback(
    (angleId: string, platform: Platform, actor?: string) =>
      transition(angleId, platform, 'approved', { actor }),
    [transition]
  );
  const reject = useCallback(
    (angleId: string, platform: Platform, reason: string, actor?: string) =>
      transition(angleId, platform, 'rejected', { reason, actor }),
    [transition]
  );
  const reopen = useCallback(
    (angleId: string, platform: Platform) =>
      transition(angleId, platform, 'reviewing'),
    [transition]
  );

  // ── Public: regenerate ──────────────────────────────────────────────────
  const regenerate = useCallback(async (
    angleId: string,
    platform: Platform,
    direction?: string
  ) => {
    if (!sprintId) return null;
    const key = k(angleId, platform);
    setBusy(key, true);
    try {
      const res = await fetch(
        `/api/sprint/${sprintId}/creatives/${encodeURIComponent(angleId)}/${platform}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction }),
        }
      );
      const data = await res.json().catch(() => null) as { creative?: SprintCreative; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? `Regenerate failed (${res.status})`);
      if (data?.creative) {
        setCreatives((prev) => {
          const idx = prev.findIndex((r) => r.id === data.creative!.id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = data.creative!;
            return next;
          }
          return [...prev, data.creative!];
        });
      }
      return data?.creative ?? null;
    } finally {
      setBusy(key, false);
    }
  }, [sprintId]);

  // ── Public: persisted policy scan ───────────────────────────────────────
  const scan = useCallback(async (angleId: string, platform: Platform) => {
    if (!sprintId) return null;
    const key = k(angleId, platform);
    setBusy(key, true);
    try {
      const res = await fetch(
        `/api/sprint/${sprintId}/creatives/${encodeURIComponent(angleId)}/${platform}/scan`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => null) as
        | { creative?: SprintCreative; severity: ScanResult['severity']; issues: PolicyIssue[]; blocked: boolean }
        | null;
      if (!res.ok || !data) throw new Error(`Scan failed (${res.status})`);
      if (data.creative) {
        setCreatives((prev) => {
          const idx = prev.findIndex((r) => r.id === data.creative!.id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = data.creative!;
            return next;
          }
          return [...prev, data.creative!];
        });
      }
      return { severity: data.severity, issues: data.issues, blocked: data.blocked };
    } finally {
      setBusy(key, false);
    }
  }, [sprintId]);

  // ── Public: campaign activation gate ────────────────────────────────────
  const activateCampaign = useCallback(async () => {
    if (!sprintId) return null;
    const res = await fetch(`/api/sprint/${sprintId}/campaign/activate`, { method: 'POST' });
    const data = await res.json().catch(() => null) as
      | { campaign_id?: string; status?: string; error?: string }
      | null;
    if (!res.ok) throw new Error(data?.error ?? `Activation failed (${res.status})`);
    return data;
  }, [sprintId]);

  // ── Derived: deploy-gate completeness ───────────────────────────────────
  const approvalState = useMemo(() => {
    const channels = opts.activeChannels?.length ? opts.activeChannels : (['meta'] as Platform[]);
    const missing: Platform[] = [];
    for (const ch of channels) {
      const rows = creatives.filter((c) => c.platform === ch);
      const hasApproved = rows.some(
        (r) => r.status === 'approved' && r.policy_severity !== 'block'
      );
      if (!hasApproved) missing.push(ch);
    }
    return { ok: missing.length === 0 && creatives.length > 0, missing, channels };
  }, [creatives, opts.activeChannels]);

  return {
    creatives,
    byKey,
    loading,
    error,
    isSaving: (angleId: string, platform: Platform) => savingKeys.has(k(angleId, platform)),
    isBusy: (angleId: string, platform: Platform) => busyKeys.has(k(angleId, platform)),
    approvalState,
    refetch,
    editField,
    saveNow,
    approve,
    reject,
    reopen,
    regenerate,
    scan,
    activateCampaign,
  };
}
