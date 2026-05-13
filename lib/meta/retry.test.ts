import { describe, expect, it, vi } from 'vitest';
import { withMetaRetry } from './retry';
import { MetaAPIError } from '@/lib/meta-api';

describe('withMetaRetry', () => {
  it('returns the result on first success', async () => {
    const op = vi.fn().mockResolvedValue({ ok: true });
    const out = await withMetaRetry(op, { attempts: 3, baseDelayMs: 1 });
    expect(out).toEqual({ ok: true });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries transient Meta errors and eventually succeeds', async () => {
    const transient = new MetaAPIError('rate limited', 4, 'OAuthException');
    const op = vi
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValue('done');
    const out = await withMetaRetry(op, { attempts: 4, baseDelayMs: 1, maxDelayMs: 5 });
    expect(out).toBe('done');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent Meta errors', async () => {
    const permanent = new MetaAPIError('invalid token', 190, 'OAuthException');
    const op = vi.fn().mockRejectedValue(permanent);
    await expect(withMetaRetry(op, { attempts: 4, baseDelayMs: 1 })).rejects.toBe(permanent);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting attempts on transient errors', async () => {
    const transient = new MetaAPIError('throttle', 17, 'OAuthException');
    const op = vi.fn().mockRejectedValue(transient);
    await expect(withMetaRetry(op, { attempts: 3, baseDelayMs: 1, maxDelayMs: 5 })).rejects.toBe(
      transient
    );
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('retries network errors (ETIMEDOUT, fetch failed)', async () => {
    const netErr = new Error('fetch failed: ETIMEDOUT');
    const op = vi.fn().mockRejectedValueOnce(netErr).mockResolvedValue('ok');
    const out = await withMetaRetry(op, { attempts: 3, baseDelayMs: 1 });
    expect(out).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });
});
