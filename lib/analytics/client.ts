'use client';

import posthog from 'posthog-js';

let initDone = false;

export function initPosthog(): void {
  if (initDone || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,
    persistence: 'localStorage+cookie',
  });
  initDone = true;
}

export function captureEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initDone || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* ignore */
  }
}

export function maybeStartSessionRecording(pathname: string): void {
  if (!initDone) return;
  const canvas = pathname.startsWith('/canvas/');
  const budgetPath = pathname.includes('/budget');
  if (canvas || budgetPath) {
    try {
      if (typeof (posthog as unknown as { startSessionRecording?: () => void }).startSessionRecording === 'function') {
        (posthog as unknown as { startSessionRecording: () => void }).startSessionRecording();
      }
    } catch {
      /* ignore */
    }
  }
}

export { posthog };
