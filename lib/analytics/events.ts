// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Standardized PostHog event taxonomy
//
// Rules:
//  - All event names are snake_case constants in SprintEventName
//  - Every event has a strongly-typed properties interface
//  - Emission is always fire-and-forget; never block the user path
//  - All events use sprint_id as distinctId so funnels are sprint-scoped
// ─────────────────────────────────────────────────────────────────────────────

import { captureServerEvent } from './server-posthog';

// ── Event name registry ───────────────────────────────────────────────────

export const SprintEventName = {
  // Sprint lifecycle
  SprintCreated: 'sprint_created',
  SprintBlocked: 'sprint_blocked',
  SprintCompleted: 'sprint_completed',

  // Agent completions
  GenomeCompleted: 'genome_completed',
  HealthgateCompleted: 'healthgate_completed',
  AnglesGenerated: 'angles_generated',
  LandingDeployed: 'landing_deployed',
  CampaignLaunched: 'campaign_launched',
  CampaignCreated: 'campaign_created',
  CampaignPaused: 'campaign_paused',
  CampaignPolled: 'campaign_polled',
  AngleWon: 'angle_won',
  LeadGenerated: 'lead_generated',
  VerdictIssued: 'verdict_issued',

  // Editable creative workflow (v10)
  CreativeEdited: 'creative_edited',
  CreativeApproved: 'creative_approved',
  CreativeRejected: 'creative_rejected',
  CreativeRegenerated: 'creative_regenerated',
  CreativePolicyScanned: 'creative_policy_scanned',
  CreativeDeployed: 'creative_deployed',
  CampaignActivated: 'campaign_activated',

  // Payment
  CheckoutStarted: 'checkout_started',
  PaymentCompleted: 'payment_completed',

  // LP conversion funnel
  LpViewed: 'lp_viewed',
  LpCtaClicked: 'lp_cta_clicked',
  LpScrollDepth: 'lp_scroll_depth',
  LpFormSubmitted: 'lp_form_submitted',
  LpEmailCaptured: 'lp_email_captured',

  // Post-sprint
  SpreadsheetPrepared: 'spreadsheet_prepared',
  OutreachSent: 'outreach_sent',
  SlackPosted: 'slack_posted',

  // Report
  ReportDownloaded: 'report_downloaded',
  ReportShared: 'report_shared',
} as const;

export type SprintEventNameValue = (typeof SprintEventName)[keyof typeof SprintEventName];

// ── Event property interfaces ─────────────────────────────────────────────

export interface SprintCreatedProps {
  idea_length_chars: number;
  channels_selected: string[];
  budget_cents: number;
  org_id?: string | null;
}

export interface GenomeCompletedProps {
  composite_score: number;
  signal: 'GO' | 'ITERATE' | 'STOP';
  data_source: 'real' | 'llm_estimate';
  elapsed_ms: number;
}

export interface HealthgateCompletedProps {
  channels_checked: string[];
  channels_passed: string[];
  channels_blocked: string[];
}

export interface AnglesGeneratedProps {
  angle_count: number;
  archetypes: string[];
}

export interface LandingDeployedProps {
  sprint_id: string;
  angle_id: string;
  url: string;
}

export interface CampaignLaunchedProps {
  channels: string[];
  total_budget_cents: number;
  campaign_ids: Record<string, string>;
}

export interface VerdictIssuedProps {
  verdict: 'GO' | 'ITERATE' | 'NO-GO';
  confidence: number;
  market_signal_strength: 'WEAK' | 'MODERATE' | 'STRONG';
  total_spend_cents: number;
  weighted_blended_ctr: number;
  winning_angle: string | null;
  recommended_channel: string | null;
}

export interface LpConversionProps {
  sprint_id?: string;
  test_id?: string;
  angle_id?: string;
  channel?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface OutreachSentProps {
  total_sent: number;
  failed: number;
  angle_used: string;
}

export interface PaymentCompletedProps {
  stripe_session_id: string;
  total_amount_cents: number;
  ad_spend_cents: number;
  platform_fee_cents: number;
}

// ── Typed emitter ─────────────────────────────────────────────────────────

type EventPropsMap = {
  [SprintEventName.SprintCreated]: SprintCreatedProps;
  [SprintEventName.GenomeCompleted]: GenomeCompletedProps;
  [SprintEventName.HealthgateCompleted]: HealthgateCompletedProps;
  [SprintEventName.AnglesGenerated]: AnglesGeneratedProps;
  [SprintEventName.LandingDeployed]: LandingDeployedProps;
  [SprintEventName.CampaignLaunched]: CampaignLaunchedProps;
  [SprintEventName.CampaignCreated]: {
    channel: string;
    campaign_id: string;
    angle_count: number;
    daily_budget_cents: number;
    total_budget_cents: number;
  };
  [SprintEventName.CampaignPaused]: {
    channel: string;
    campaign_id?: string;
    adset_id?: string;
    angle_id?: string;
    reason: string;
  };
  [SprintEventName.AngleWon]: {
    channel: string;
    angle_id: string;
    ctr: number;
    cpc_cents: number;
    lp_conversion_rate: number;
  };
  [SprintEventName.LeadGenerated]: LpConversionProps & {
    event_name: string;
    page_url?: string | null;
  };
  [SprintEventName.VerdictIssued]: VerdictIssuedProps;
  [SprintEventName.LpViewed]: LpConversionProps;
  [SprintEventName.LpCtaClicked]: LpConversionProps;
  [SprintEventName.LpScrollDepth]: LpConversionProps & { depth_pct: number };
  [SprintEventName.LpFormSubmitted]: LpConversionProps;
  [SprintEventName.LpEmailCaptured]: LpConversionProps;
  [SprintEventName.OutreachSent]: OutreachSentProps;
  [SprintEventName.PaymentCompleted]: PaymentCompletedProps;
  [SprintEventName.ReportDownloaded]: { sprint_id: string; format: 'pdf' | 'json' };
  [SprintEventName.ReportShared]: { sprint_id: string; share_token: string };
  [SprintEventName.SprintBlocked]: { reason: string; state: string };
  [SprintEventName.SprintCompleted]: { verdict: string; confidence: number };
  [SprintEventName.CheckoutStarted]: { sprint_id: string; amount_cents: number };
  [SprintEventName.SpreadsheetPrepared]: { valid_contacts: number; icp_filter_applied: boolean };
  [SprintEventName.SlackPosted]: { channel: string | null };
  [SprintEventName.CampaignPolled]: { channels: string[]; all_halted: boolean };
};

/**
 * Emit a typed sprint lifecycle event to PostHog.
 * Always fire-and-forget — errors are swallowed and logged.
 */
export async function emitSprintEvent<E extends SprintEventNameValue>(
  sprintId: string,
  event: E,
  properties: E extends keyof EventPropsMap ? EventPropsMap[E] : Record<string, unknown>
): Promise<void> {
  try {
    await captureServerEvent(sprintId, event, {
      sprint_id: sprintId,
      ...(properties as Record<string, unknown>),
    });
  } catch {
    // Non-fatal — analytics must never break the main path
  }
}

/**
 * Emit a typed LP conversion event using test_id or sprint_id as distinct ID.
 */
export async function emitLpEvent<E extends keyof Pick<EventPropsMap,
  | 'lp_viewed'
  | 'lp_cta_clicked'
  | 'lp_scroll_depth'
  | 'lp_form_submitted'
  | 'lp_email_captured'
>>(
  recordId: string,
  event: E,
  properties: EventPropsMap[E]
): Promise<void> {
  try {
    await captureServerEvent(recordId, event, {
      record_id: recordId,
      ...(properties as Record<string, unknown>),
    });
  } catch {
    // Non-fatal
  }
}
