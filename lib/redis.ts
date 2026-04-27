import Redis from 'ioredis';

let _redis: Redis;

function getRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (url) {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    _redis.on('error', (err: Error) => {
      console.warn('[redis] connection error:', err.message);
    });
  }

  return _redis;
}

export const redis = new Proxy({} as Redis, {
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