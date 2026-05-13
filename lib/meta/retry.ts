// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Meta API retry/backoff wrapper
//
// Exponential backoff with jitter for Meta Marketing/Conversions API calls.
// Used by every server-side Meta module — never wrap auth/handshake calls.
//
// Retryable codes (Meta Graph API):
//   1, 2          — temporary errors
//   4, 17, 32, 613 — rate limit
//   368           — temporary throttle
//   500, 502, 503, 504 — transient HTTP
//
// Non-retryable (permanent): 100 (param error), 190 (invalid token),
//   200 (permissions), 270 (policy), 803 (object missing).
// ─────────────────────────────────────────────────────────────────────────────

import { MetaAPIError } from '@/lib/meta-api';

const RETRYABLE_META_CODES = new Set([1, 2, 4, 17, 32, 368, 613]);

function isTransient(err: unknown): boolean {
  if (err instanceof MetaAPIError) return RETRYABLE_META_CODES.has(err.code);
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('etimedout') ||
      msg.includes('econnreset') ||
      msg.includes('enotfound') ||
      msg.includes('fetch failed') ||
      msg.includes('network')
    );
  }
  return false;
}

export interface RetryOptions {
  /** Maximum attempts including the first. Default 4. */
  attempts?: number;
  /** Base delay in ms (doubles each attempt). Default 500ms. */
  baseDelayMs?: number;
  /** Cap on the per-attempt delay. Default 8000ms. */
  maxDelayMs?: number;
  /** Optional tag for logging. */
  label?: string;
}

/**
 * Retry an async operation with exponential backoff and jitter.
 * Only retries Meta API errors flagged as transient.
 */
export async function withMetaRetry<T>(
  op: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseDelay = opts.baseDelayMs ?? 500;
  const maxDelay = opts.maxDelayMs ?? 8000;
  const label = opts.label ?? 'meta';

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isTransient(err)) throw err;

      const exp = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * (exp / 2));
      const delay = exp + jitter;
      console.warn(
        `[meta-retry:${label}] attempt ${attempt}/${attempts} failed: ${String(err)} — retry in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
