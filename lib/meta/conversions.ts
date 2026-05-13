// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Meta Conversions API (CAPI)
//
// Sends server-side conversion events to Meta's pixel, deduplicating against
// browser pixel events using a shared `event_id`. All PII is SHA256-hashed
// per Meta's requirements. Uses the LaunchLense-owned system token + pixel.
//
// Reference: https://developers.facebook.com/docs/marketing-api/conversions-api
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomUUID } from 'node:crypto';
import { getSystemToken, getSystemPixelId, MetaAPIError } from '@/lib/meta-api';
import { withMetaRetry } from '@/lib/meta/retry';

const META_API_VERSION = 'v20.0';
const META_GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

// ── Standard event names (LaunchLense uses a curated subset) ──────────────

export type CapiEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'CompleteRegistration'
  | 'CTAButtonClick'           // custom
  | 'ScrollDepth';             // custom

// ── User-data shape (raw PII; we hash before sending) ──────────────────────

export interface CapiUserData {
  email?: string | null;
  phone?: string | null;
  /** Click ID from Meta-attributed traffic. Pass through `fbclid` query param. */
  fbclid?: string | null;
  /** _fbc cookie value (preferred when present). */
  fbc?: string | null;
  /** _fbp cookie value. */
  fbp?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  /** Hashed external ID (we hash). */
  external_id?: string | null;
  country?: string | null;     // ISO 2-letter, lowercased pre-hash
}

export interface CapiEventInput {
  event_name: CapiEventName;
  /** Unix seconds. Defaults to now. */
  event_time?: number;
  /** Page URL the event originated from. */
  event_source_url?: string;
  /**
   * Shared with the browser pixel to deduplicate. Pass the same UUID to both
   * `fbq('track', name, {}, { eventID })` and this server event.
   */
  event_id?: string;
  /** `website` for LP traffic. */
  action_source?: 'website' | 'app' | 'phone_call' | 'chat' | 'email' | 'physical_store' | 'system_generated' | 'other';
  user_data: CapiUserData;
  /** Custom data: value, currency, content_ids, content_name, lp_angle_id, etc. */
  custom_data?: Record<string, unknown>;
}

// ── PII hashing per Meta spec ──────────────────────────────────────────────

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

function normalizePhone(v: string): string {
  // Strip everything except digits; Meta wants country code prefix without `+`.
  return v.replace(/\D+/g, '');
}

/** Build a Meta-compliant `_fbc` cookie value from a raw `fbclid`. */
export function buildFbcFromClickId(fbclid: string, eventTimeMs = Date.now()): string {
  return `fb.1.${eventTimeMs}.${fbclid}`;
}

function hashUserData(user: CapiUserData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (user.email) out.em = [sha256(normalizeEmail(user.email))];
  if (user.phone) out.ph = [sha256(normalizePhone(user.phone))];
  if (user.external_id) out.external_id = [sha256(user.external_id.trim().toLowerCase())];
  if (user.country) out.country = [sha256(user.country.trim().toLowerCase())];
  if (user.fbc) out.fbc = user.fbc;
  else if (user.fbclid) out.fbc = buildFbcFromClickId(user.fbclid);
  if (user.fbp) out.fbp = user.fbp;
  if (user.ip) out.client_ip_address = user.ip;
  if (user.user_agent) out.client_user_agent = user.user_agent;
  return out;
}

// ── Core send ──────────────────────────────────────────────────────────────

export interface SendConversionsOptions {
  /** Override the system pixel (rare — only for cross-tenant tests). */
  pixelId?: string;
  /** Override the system token. */
  accessToken?: string;
  /** Meta test event code from Events Manager → Test Events. */
  testEventCode?: string;
}

export interface CapiResponse {
  events_received: number;
  messages: string[];
  fbtrace_id: string;
}

/**
 * Send one or more conversion events to Meta. Returns Meta's ack envelope.
 * All events share the same pixel (the LaunchLense system pixel).
 */
export async function sendConversions(
  events: CapiEventInput[],
  opts: SendConversionsOptions = {}
): Promise<CapiResponse> {
  if (events.length === 0) {
    return { events_received: 0, messages: ['no events'], fbtrace_id: '' };
  }
  const pixelId = opts.pixelId ?? getSystemPixelId();
  if (!pixelId) throw new Error('SYSTEM_META_PIXEL_ID not configured');
  const token = opts.accessToken ?? getSystemToken();

  const payload = {
    data: events.map((e) => ({
      event_name: e.event_name,
      event_time: e.event_time ?? Math.floor(Date.now() / 1000),
      event_id: e.event_id ?? randomUUID(),
      action_source: e.action_source ?? 'website',
      event_source_url: e.event_source_url,
      user_data: hashUserData(e.user_data),
      custom_data: e.custom_data ?? {},
    })),
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  };

  return withMetaRetry(
    async () => {
      const url = `${META_GRAPH}/${pixelId}/events`;
      const body = new URLSearchParams();
      body.set('access_token', token);
      body.set('data', JSON.stringify(payload.data));
      if (opts.testEventCode) body.set('test_event_code', opts.testEventCode);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const json = (await res.json()) as
        | { events_received: number; messages: string[]; fbtrace_id: string }
        | { error: { message: string; type: string; code: number } };

      if ('error' in json) {
        throw new MetaAPIError(json.error.message, json.error.code, json.error.type);
      }
      return json;
    },
    { label: 'capi' }
  );
}

// ── High-level helpers used by LP track route ──────────────────────────────

export interface LpCapiContext {
  sprint_id?: string;
  test_id?: string;
  angle_id?: string;
  channel?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  source_url?: string;
  ip?: string | null;
  user_agent?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  email?: string | null;
  /** Browser-generated UUID used to dedupe with the in-page pixel. */
  event_id?: string;
}

/** Map an internal LP event to a Meta standard event name. */
export function lpEventToCapi(event: string): CapiEventName | null {
  switch (event) {
    case 'page_view':
      return 'PageView';
    case 'view_content':
    case 'scroll_depth':
      return 'ViewContent';
    case 'cta_click':
      return 'CTAButtonClick';
    case 'form_submit':
      return 'Lead';
    case 'email_capture':
      return 'CompleteRegistration';
    default:
      return null;
  }
}

/**
 * Emit a single LP event through CAPI. Safe to call from the public /api/lp/track
 * route — failures never throw (this MUST be fire-and-forget for LP UX).
 */
export async function emitLpCapiEvent(event: string, ctx: LpCapiContext): Promise<void> {
  const eventName = lpEventToCapi(event);
  if (!eventName) return;
  if (!process.env.SYSTEM_META_PIXEL_ID && !process.env.META_PIXEL_ID) return;

  try {
    await sendConversions([
      {
        event_name: eventName,
        event_id: ctx.event_id,
        event_source_url: ctx.source_url,
        user_data: {
          email: ctx.email,
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          fbclid: ctx.fbclid,
          fbc: ctx.fbc,
          fbp: ctx.fbp,
          external_id: ctx.sprint_id ?? ctx.test_id ?? null,
        },
        custom_data: {
          sprint_id: ctx.sprint_id,
          test_id: ctx.test_id,
          angle_id: ctx.angle_id,
          channel: ctx.channel,
          utm_source: ctx.utm_source,
          utm_medium: ctx.utm_medium,
          utm_campaign: ctx.utm_campaign,
          utm_content: ctx.utm_content,
        },
      },
    ]);
  } catch (err) {
    console.warn('[capi] emitLpCapiEvent failed:', String(err));
  }
}
