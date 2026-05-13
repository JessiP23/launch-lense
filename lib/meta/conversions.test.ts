import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { buildFbcFromClickId, lpEventToCapi, sendConversions } from './conversions';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

describe('buildFbcFromClickId', () => {
  it('builds Meta-compliant _fbc cookie value', () => {
    const out = buildFbcFromClickId('abc123', 1700000000000);
    expect(out).toBe('fb.1.1700000000000.abc123');
  });
});

describe('lpEventToCapi', () => {
  it('maps internal LP events to Meta standard events', () => {
    expect(lpEventToCapi('page_view')).toBe('PageView');
    expect(lpEventToCapi('cta_click')).toBe('CTAButtonClick');
    expect(lpEventToCapi('form_submit')).toBe('Lead');
    expect(lpEventToCapi('email_capture')).toBe('CompleteRegistration');
    expect(lpEventToCapi('scroll_depth')).toBe('ViewContent');
    expect(lpEventToCapi('totally_unknown')).toBeNull();
  });
});

describe('sendConversions', () => {
  beforeEach(() => {
    process.env.SYSTEM_META_ACCESS_TOKEN = 'test_token';
    process.env.SYSTEM_META_PIXEL_ID = '999';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SHA256-hashes email and phone before sending', async () => {
    const captured: URLSearchParams[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured.push(new URLSearchParams(init.body as string));
        return new Response(
          JSON.stringify({ events_received: 1, messages: [], fbtrace_id: 'abc' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );

    await sendConversions([
      {
        event_name: 'Lead',
        event_id: 'evt-1',
        user_data: { email: 'Jane@Example.com', phone: '+1 (555) 010-1234' },
      },
    ]);

    expect(captured).toHaveLength(1);
    const data = JSON.parse(captured[0].get('data')!);
    expect(data[0].event_id).toBe('evt-1');
    expect(data[0].event_name).toBe('Lead');
    expect(data[0].user_data.em).toEqual([sha('jane@example.com')]);
    expect(data[0].user_data.ph).toEqual([sha('15550101234')]);
  });

  it('passes through fbc/fbp and builds fbc from fbclid when fbc absent', async () => {
    const captured: URLSearchParams[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured.push(new URLSearchParams(init.body as string));
        return new Response(
          JSON.stringify({ events_received: 1, messages: [], fbtrace_id: 'abc' }),
          { status: 200 }
        );
      })
    );
    await sendConversions([
      {
        event_name: 'PageView',
        user_data: { fbclid: 'CL_abc', fbp: 'fb.1.123.456' },
      },
    ]);
    const data = JSON.parse(captured[0].get('data')!);
    expect(data[0].user_data.fbc).toMatch(/^fb\.1\.\d+\.CL_abc$/);
    expect(data[0].user_data.fbp).toBe('fb.1.123.456');
  });

  it('returns empty ack for empty event list', async () => {
    const out = await sendConversions([]);
    expect(out.events_received).toBe(0);
  });
});
