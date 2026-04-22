/**
 * lib/redis.ts
 *
 * Thin Redis client wrapper using ioredis.
 * Falls back to a no-op in-memory mock when REDIS_URL is not configured,
 * so the app works locally without Redis running.
 *
 * Usage:
 *   import { redis } from '@/lib/redis';
 *   await redis.set('key', JSON.stringify(value), 'EX', 3600);
 *   const raw = await redis.get('key');
 */

import Redis from 'ioredis';

// ── Singleton ──────────────────────────────────────────────────────────────

let _redis: Redis | MockRedis | null = null;

function getRedis(): Redis | MockRedis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (url) {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    _redis.on('error', (err: Error) => {
      // Don't crash on connection errors — app degrades gracefully
      console.warn('[redis] connection error:', err.message);
    });
  } else {
    console.warn('[redis] REDIS_URL not set — using in-memory mock (no persistence)');
    _redis = new MockRedis();
  }

  return _redis;
}

export const redis = new Proxy({} as Redis | MockRedis, {
  get(_target, prop: string) {
    const client = getRedis();
    const value = (client as unknown as Record<string, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// ── Cache helpers ──────────────────────────────────────────────────────────

/** Get a cached JSON value, or compute + cache it on miss. */
export async function cachedJSON<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  try {
    const raw = await (redis as unknown as Redis).get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // Cache miss or parse error — proceed to compute
  }

  const value = await compute();

  try {
    await (redis as unknown as Redis).set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Non-fatal — just skip caching
  }

  return value;
}

// ── In-memory mock (no Redis installed) ───────────────────────────────────

class MockRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, exFlag?: string, ttl?: number): Promise<'OK'> {
    const expiresAt =
      exFlag === 'EX' && ttl ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  on(_event: string, _handler: unknown) {
    return this;
  }
}
