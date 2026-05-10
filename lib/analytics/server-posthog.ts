import { PostHog } from 'posthog-node';

let posthog: PostHog | null = null;

function getPosthog(): PostHog | null {
  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!key) return null;
  if (!posthog) {
    posthog = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  }
  return posthog;
}

/** Fire-and-forget for server routes; await flush for serverless completeness. */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const client = getPosthog();
  if (!client) return;
  try {
    client.capture({ distinctId, event, properties });
    await client.flush();
  } catch (e) {
    console.warn('[posthog]', event, e);
  }
}
