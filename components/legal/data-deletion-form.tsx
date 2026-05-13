'use client';

import { useState } from 'react';

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; confirmationId: string }
  | { kind: 'error'; message: string };

/**
 * Self-serve data deletion request form. Submits to /api/data-deletion which
 * verifies the email out-of-band and queues the cascade. Never deletes
 * synchronously from a public endpoint — that would let anyone delete any
 * account by guessing emails.
 */
export function DataDeletionForm() {
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm || !email) return;
    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason }),
      });
      const json = (await res.json()) as { confirmation_id?: string; error?: string };
      if (!res.ok || !json.confirmation_id) {
        setState({ kind: 'error', message: json.error ?? 'Request failed' });
        return;
      }
      setState({ kind: 'success', confirmationId: json.confirmation_id });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      });
    }
  }

  if (state.kind === 'success') {
    return (
      <div className="not-prose my-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-go,#16a34a)]">
          Request received
        </div>
        <h3 className="mt-2 font-display text-[18px] font-bold">
          Check your inbox for verification
        </h3>
        <p className="mt-2 text-[14px] leading-[1.65] text-[var(--color-muted)]">
          We&apos;ve sent a confirmation email to <strong>{email}</strong>.
          Click the link inside to start the deletion cascade. The link
          expires in 24 hours.
        </p>
        <p className="mt-4 text-[12px] text-[var(--color-muted)]">
          Reference this confirmation code if you need to follow up:
          <br />
          <code className="mt-1 inline-block">{state.confirmationId}</code>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="not-prose my-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
    >
      <div className="grid gap-4">
        <label className="block">
          <span className="block text-[12px] font-semibold text-[var(--color-ink)]">
            Email on your LaunchLense account
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--color-ink)]"
            placeholder="you@company.com"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="block text-[12px] font-semibold text-[var(--color-ink)]">
            Reason (optional, helps us improve)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--color-ink)]"
            placeholder="No longer building this idea, switching tools, etc."
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)]"
            required
          />
          <span>
            I understand this will permanently delete my account, all sprints,
            and any active campaigns. This cannot be undone.
          </span>
        </label>

        {state.kind === 'error' ? (
          <div className="rounded-lg border border-[var(--color-stop,#ef4444)]/40 bg-[var(--color-stop,#ef4444)]/5 px-3 py-2 text-[13px] text-[var(--color-stop,#ef4444)]">
            {state.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={state.kind === 'submitting' || !confirm || !email}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-ink)] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#2a2a28] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.kind === 'submitting' ? 'Submitting…' : 'Request deletion'}
        </button>
      </div>
    </form>
  );
}
