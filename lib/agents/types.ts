// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Agent Type Definitions
// Full orchestration: Genome → Healthgate → Angle → Landing →
//   Campaign → Verdict → Report → (optional) Spreadsheet → Outreach → Slack
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = 'meta' | 'google' | 'linkedin' | 'tiktok';
export type SprintSignal = 'GO' | 'ITERATE' | 'STOP';
export type ChannelVerdict = 'GO' | 'ITERATE' | 'NO-GO';
export type HealthStatus = 'HEALTHY' | 'WARN' | 'BLOCKED';
export type AngleArchetype = 'PAIN' | 'ASPIRATION' | 'SOCIAL_PROOF' | 'CURIOSITY' | 'AUTHORITY';
export type AngleEmotionalLever = 'fear' | 'ambition' | 'relief' | 'intrigue' | 'trust';

// ── Sprint State Machine ───────────────────────────────────────────────────

export type SprintState =
  | 'IDLE'
  | 'GENOME_RUNNING'
  | 'GENOME_DONE'
  | 'HEALTHGATE_RUNNING'
  | 'HEALTHGATE_DONE'
  | 'PAYMENT_PENDING'
  | 'ANGLES_RUNNING'
  | 'ANGLES_DONE'
  // v10 approval gate: sprint pauses on USER_REVIEW_REQUIRED until the user
  // approves at least one creative per active channel; CREATIVE_APPROVED
  // unlocks the deploy step but still requires an explicit launch click.
  | 'USER_REVIEW_REQUIRED'
  | 'CREATIVE_APPROVED'
  | 'LANDING_RUNNING'
  | 'LANDING_DONE'
  | 'CAMPAIGN_CREATING'
  | 'CAMPAIGN_RUNNING'
  | 'CAMPAIGN_MONITORING'
  | 'VERDICT_GENERATING'
  | 'COMPLETE'
  | 'BLOCKED';

/** Audit rows returned with GET /api/sprint/[id] for integration agent runs */
export interface SprintEventLogEntry {
  agent: string;
  event_type: string;
  channel?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface SprintRecord {
  sprint_id: string;
  idea: string;
  org_id: string | null;
  state: SprintState;
  active_channels: Platform[];
  budget_cents: number; // total across all channels
  blocked_reason?: string;
  created_at: string;
  updated_at: string;
  /** Connection flags + references for Google Sheet, Gmail, Slack (no secrets). */
  integrations?: SprintIntegrations;
  /** Post-report orchestration — Spreadsheet → Outreach → Slack. */
  post_sprint?: PostSprintLayer;
  /** Present on GET /api/sprint/[id] — newest-first query server-side; UI may re-sort */
  events?: SprintEventLogEntry[];
  // Agent outputs (written as they complete)
  genome?: GenomeAgentOutput;
  healthgate?: Record<Platform, HealthgateAgentOutput>;
  angles?: AngleAgentOutput;
  landing?: LandingAgentOutput;
  campaign?: Record<Platform, CampaignAgentOutput>;
  verdict?: VerdictAgentOutput;
  report?: ReportAgentOutput;
}

// ── Integrations (workspace / sprint level) ─────────────────────────────────

export interface SprintIntegrations {
  google_sheet_id?: string | null;
  google_sheet_url?: string | null;
  google_sheet_name?: string | null;
  /** OAuth callback writes resolved Gmail address — never refresh tokens */
  google_connected_email?: string | null;
  sheets_connected?: boolean;
  gmail_connected?: boolean;
  slack_connected?: boolean;
  slack_channel?: string | null;
  /** When true, show post-sprint nodes on the sprint canvas (default off — opt in per sprint). */
  canvas_sheet?: boolean;
  canvas_outreach?: boolean;
  canvas_slack?: boolean;
}

export type PostSprintPhase =
  | 'idle'
  | 'spreadsheet_running'
  | 'spreadsheet_done'
  | 'outreach_confirm'
  | 'outreach_running'
  | 'outreach_done'
  | 'outreach_failed'
  | 'slack_running'
  | 'slack_done'
  | 'complete';

export interface PostSprintLayer {
  phase: PostSprintPhase;
  /** Server stores aggregate stats only — not raw rows. Client resends contacts to confirm send. */
  spreadsheet?: SpreadsheetAgentOutput | null;
  outreach?: OutreachAgentOutput | null;
  slack?: SlackAgentOutput | null;
  warnings?: string[];
  updated_at?: string;
}

// ── Agent 1: GenomeAgent ──────────────────────────────────────────────────

export interface GenomeScores {
  demand: number;       // 0-100 — evidence of active search/complaint
  competition: number;  // 0-100 — inverse of crowding (100 = blue ocean)
  icp: number;          // 0-100 — can you name the exact buyer
  timing: number;       // 0-100 — macro tailwinds present now
  moat: number;         // 0-100 — defensible mechanism exists
}

export interface GenomeAgentOutput {
  signal: SprintSignal;
  composite: number;    // weighted: demand*0.3 + icp*0.25 + competition*0.2 + timing*0.15 + moat*0.10
  scores: GenomeScores;
  icp: string;          // named buyer + reason they buy today
  problem_statement: string;
  solution_wedge: string;
  market_category: string;
  unique_mechanism: string;
  risks: string[];      // each MUST cite a specific signal — no generics
  pivot_brief: string | null;   // if STOP — specific pivot direction
  proceed_note: string | null;  // if GO/ITERATE — seeds AngleAgent brief
  research_sources: string[];
  // Raw research data
  source_google?: {
    organic_result_count: number;
    google_ads_count: number;
    related_searches: string[];
    top_titles: string[];
    top_snippet?: string;
  } | null;
  source_meta?: {
    active_ads_count: number;
    advertiser_names: string[];
    error?: string;
  } | null;
  data_source: 'real' | 'llm_estimate';
  elapsed_ms: number;
}

// ── Agent 2: HealthgateAgent (per channel) ────────────────────────────────

export type CheckWeight = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface HealthCheck {
  key: string;
  name: string;
  weight: CheckWeight;
  passed: boolean;
  value: string;
  points_awarded: number;
  points_max: number;
  fix: string;
  estimated_fix_hours?: number;
}

export interface HealthgateAgentOutput {
  channel: Platform;
  score: number;         // 0-100, capped at 40 if any CRITICAL fails
  status: HealthStatus;  // BLOCKED <60, WARN 60-79, HEALTHY 80-100
  checks: HealthCheck[];
  blocking_issues: string[];   // check names that are blocking
  fix_summary: string[];       // ordered by urgency
  estimated_unblock_hours: number;
}

// ── Agent 3: AngleAgent ───────────────────────────────────────────────────

export interface ChannelCopy {
  meta: {
    headline: string;    // ≤40 chars
    body: string;        // ≤125 chars
  };
  google: {
    headline1: string;   // ≤30 chars
    headline2: string;   // ≤30 chars
    description: string; // ≤90 chars
  };
  linkedin: {
    intro: string;       // ≤70 chars
    headline: string;    // ≤25 chars
    body: string;        // ≤150 chars
  };
  tiktok: {
    hook: string;        // ≤100 chars — first 3 seconds
    overlay: string;     // ≤80 chars
  };
}

export interface Angle {
  id: 'angle_A' | 'angle_B' | 'angle_C';
  archetype: AngleArchetype;
  emotional_lever: AngleEmotionalLever;
  copy: ChannelCopy;
  cta: string;         // verb-first, outcome-focused, ≤5 words
  utm_tags: Record<Platform, string>;
}

export interface AngleAgentOutput {
  angles: [Angle, Angle, Angle];
  icp: string;
  value_prop: string;
}

// ── Agent 4: LandingPageAgent ─────────────────────────────────────────────

export interface LandingSection {
  type: 'hero' | 'proof' | 'form' | 'trust';
  headline?: string;
  subheadline?: string;
  cta_label?: string;
  bullets?: string[];
  quote?: string;
  quote_attribution?: string;
}

export interface LandingPage {
  angle_id: 'angle_A' | 'angle_B' | 'angle_C';
  sections: LandingSection[];
  html: string;         // single-file HTML with inline CSS using PROOF tokens
  utm_base: string;
}

export interface LandingAgentOutput {
  pages: LandingPage[];
}

// ── Agent 5: CampaignAgent (per channel) ─────────────────────────────────

export type AngleStatus = 'PASS' | 'FAIL' | 'PAUSED';

export interface AngleMetrics {
  id: 'angle_A' | 'angle_B' | 'angle_C';
  impressions: number;
  clicks: number;
  ctr: number;
  cpc_cents: number;
  spend_cents: number;
  status: AngleStatus;
}

export interface CampaignAgentOutput {
  channel: Platform;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETE' | 'FAILED';
  campaign_id: string | null;
  campaign_start_time: string | null;
  budget_cents: number;
  spent_cents: number;
  angle_metrics: AngleMetrics[];
  last_polled_at: string | null;
  error?: string;
}

// ── Agent 6: VerdictAgent ─────────────────────────────────────────────────

export interface ChannelVerdictOutput {
  channel: Platform;
  verdict: ChannelVerdict;
  confidence: number;
  blended_ctr: number;
  total_spend_cents: number;
  impressions: number;
  clicks: number;
  avg_cpc_cents: number;
  winning_angle: 'angle_A' | 'angle_B' | 'angle_C' | null;
  angle_breakdown: {
    id: 'angle_A' | 'angle_B' | 'angle_C';
    ctr: number;
    cpc_cents: number;
    spend_cents: number;
    status: AngleStatus;
  }[];
  reasoning: string;   // 2 sentences citing specific numbers
  next_action: string; // specific, not generic
}

export interface AggregateMetrics {
  total_spend_cents: number;
  total_impressions: number;
  total_clicks: number;
  weighted_blended_ctr: number;
  avg_cpc_cents: number;
}

export interface DemandValidationMemo {
  report_metadata: {
    analysis_type: 'Startup Demand Validation';
    methodology: 'Multi-channel paid acquisition test';
    duration_hours: number;
    total_spend: number;
  };
  verdict: {
    decision: ChannelVerdict;
    confidence_score: number;
    market_signal_strength: 'WEAK' | 'MODERATE' | 'STRONG';
    time_to_signal_spend: number;
    primary_reason: string;
  };
  executive_summary: {
    key_findings: [string, string, string];
    primary_constraint: string;
    highest_performing_channel: string;
    lowest_performing_channel: string;
    recommended_next_step: string;
  };
  aggregate_metrics: {
    average_ctr: number;
    average_cpc: number;
    average_conversion_rate: number;
    best_ctr: number;
    worst_ctr: number;
  };
  channel_analysis: Array<{
    channel: string;
    spend: number;
    ctr: number;
    cpc: number;
    conversion_rate: number;
    cpa: number;
    interpretation: string;
  }>;
  creative_analysis: {
    winning_angle: {
      headline: string;
      ctr: number;
      conversion_rate: number;
      reason: string;
    };
    underperforming_angle: {
      headline: string;
      ctr: number;
      conversion_rate: number;
      reason: string;
    };
    pattern_summary: string;
  };
  audience_insights: {
    observations: string[];
    anomalies: string[];
  };
  landing_page_analysis: {
    conversion_rate: number;
    diagnosis: string;
    friction_points: string[];
    recommended_adjustment: string;
  };
  genome_comparison: {
    initial_prediction: ChannelVerdict;
    observed_outcome: ChannelVerdict;
    alignment: boolean;
    analysis: string;
  };
  decision_framework: {
    rules_applied: string[];
    reasoning_steps: string[];
  };
  recommendation: {
    action: 'SCALE' | 'ITERATE' | 'TERMINATE';
    justification: string;
    next_test_budget: number;
    focus_area: string;
  };
  benchmark_comparison: {
    ctr_position: 'BELOW' | 'WITHIN' | 'ABOVE';
    conversion_position: 'BELOW' | 'WITHIN' | 'ABOVE';
    cpc_position: 'HIGH' | 'NORMAL' | 'LOW';
    interpretation: string;
  };
  counterfactual_analysis: {
    condition_for_positive_verdict: string;
    gap_to_threshold: string;
  };
  signal_timing: {
    spend_at_signal: number;
    interpretation: string;
  };
  data_tables: {
    channels: Record<string, unknown>[];
    angles: Record<string, unknown>[];
  };
}

export interface DemandValidationScoreBreakdown {
  ctr_score: number;
  conversion_score: number;
  consistency_score: number;
  efficiency_score: number;
  total_score: number;
  market_signal_strength: 'WEAK' | 'MODERATE' | 'STRONG';
  conversion_strong: boolean;
}

/** Optional sprint facts threaded into VerdictAgent for deterministic scoring + memo JSON. */
export interface VerdictAgentRunContext {
  genome?: GenomeAgentOutput | null;
  angles?: AngleAgentOutput | null;
  sprint_budget_cents?: number;
  sprint_created_at?: string;
  /** Landing-page conversion rate (0–1). Omit when not measured. */
  landing_conversion_rate?: number | null;
  benchmark_avg_ctr?: number | null;
  benchmark_avg_cvr?: number | null;
  benchmark_avg_cpc_cents?: number | null;
}

export interface VerdictAgentOutput {
  verdict: ChannelVerdict;
  confidence: number;
  channel_verdicts: Record<Platform, ChannelVerdict>;
  per_channel: ChannelVerdictOutput[];
  aggregate_metrics: AggregateMetrics;
  cross_channel_winning_angle: 'angle_A' | 'angle_B' | 'angle_C' | null;
  reasoning: string;   // 3 sentences
  recommended_channel: Platform | null;
  demand_validation?: {
    scores: DemandValidationScoreBreakdown;
    data_completeness_factor: number;
    memo: DemandValidationMemo;
  };
}

// ── Agent 7: ReportAgent ──────────────────────────────────────────────────

export interface ReportAgentOutput {
  sprint_id: string;
  pdf_url: string | null;     // hosted PDF URL (null if generation failed)
  html: string;               // full report HTML
  generated_at: string;
}

// ── Agent 8: SpreadsheetAgent ─────────────────────────────────────────────

export interface SpreadsheetContactRow {
  email: string;
  firstName: string | null;
  company: string | null;
  role: string | null;
}

export interface SpreadsheetAgentOutput {
  source: string;
  totalRows: number;
  validContacts: number;
  skippedInvalidEmail: number;
  skippedNoEmail: number;
  icpFilterApplied: boolean;
  filteredCount: number;
  contacts: SpreadsheetContactRow[];
  /** Present when SpreadsheetAgent surfaces threshold notices (<5 rows, large lists). */
  warnings?: string[];
}

// ── Agent 9: OutreachAgent ─────────────────────────────────────────────────

export interface OutreachSendLogEntry {
  email: string;
  status: 'sent' | 'failed' | 'bounced';
  timestamp: string;
  error?: string;
}

export interface OutreachAgentOutput {
  totalSent: number;
  failed: number;
  bounced: number;
  subjectLine: string;
  angleUsed: 'angle_A' | 'angle_B' | 'angle_C';
  sendLog: OutreachSendLogEntry[];
  sprintId: string;
  /** Plain-text preview only — never HTML */
  bodyPreview?: string;
}

// ── sprint_creatives (v10 approval gate) ──────────────────────────────────
//
// One row per (sprint, angle, platform). Mirrors the SQL schema in
// 010_sprint_creatives.sql. Used by lib/creatives/store.ts and consumed by
// lib/meta/create-campaign.ts when deploying approved creatives.

export type CreativeStatus =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'deploying'
  | 'deployed'
  | 'failed';

export type PolicySeverity = 'clean' | 'warn' | 'block';

export interface PolicyIssue {
  code: string;
  severity: PolicySeverity;
  message: string;
  field?: 'headline' | 'primary_text' | 'description' | 'cta' | 'image_url' | 'video_url';
  match?: string;
}

export interface SprintCreative {
  id: string;
  sprint_id: string;
  angle_id: string;
  platform: Platform;
  status: CreativeStatus;

  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
  display_link: string | null;
  hook: string | null;
  overlay_text: string | null;
  callout: string | null;
  audience_label: string | null;

  image_url: string | null;
  video_url: string | null;
  image_hash: string | null;
  video_id: string | null;

  creative_id: string | null;
  ad_id: string | null;
  adset_id: string | null;

  meta: Record<string, unknown>;

  policy_severity: PolicySeverity | null;
  policy_issues: PolicyIssue[] | null;
  policy_scanned_at: string | null;

  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;

  created_at: string;
  updated_at: string;
}

export type SprintCreativeEditable = Pick<
  SprintCreative,
  | 'headline'
  | 'primary_text'
  | 'description'
  | 'cta'
  | 'display_link'
  | 'hook'
  | 'overlay_text'
  | 'callout'
  | 'audience_label'
  | 'image_url'
  | 'video_url'
>;

// ── Agent 10: SlackAgent ───────────────────────────────────────────────────

export interface SlackAgentOutput {
  posted: boolean;
  skippedReason?: string;
  channel?: string | null;
  messagePreview: string;
  postedAt?: string | null;
}
