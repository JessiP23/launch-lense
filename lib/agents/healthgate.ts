// ─────────────────────────────────────────────────────────────────────────────
// HealthgateAgent — Per-channel account health scoring
// 4 instances run in parallel: Meta · Google · LinkedIn · TikTok
// CRITICAL fail → score capped at 40, channel BLOCKED
// Score < 60 → BLOCKED, 60-79 → WARN, 80-100 → HEALTHY
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  HealthgateAgentOutput,
  HealthCheck,
  HealthStatus,
  CheckWeight,
} from './types';

// ── Point values per weight ────────────────────────────────────────────────
const WEIGHT_POINTS: Record<CheckWeight, number> = {
  CRITICAL: 0,  // 0 if fail (score capped at 40)
  HIGH:     15,
  MEDIUM:   8,
  LOW:      4,
};

// ── Per-channel check definitions ─────────────────────────────────────────

type CheckDef = {
  key: string;
  name: string;
  weight: CheckWeight;
  test: (data: Record<string, unknown>) => boolean;
  value: (data: Record<string, unknown>) => string;
  fix: string;
  estimated_fix_hours: number;
};

const META_CHECKS: CheckDef[] = [
  {
    key: 'account_status',
    name: 'Account Status',
    weight: 'CRITICAL',
    test: (d) => d.account_status === 1 || d.account_status === 'ACTIVE',
    value: (d) => d.account_status === 1 || d.account_status === 'ACTIVE' ? 'ACTIVE' : String(d.account_status ?? 'UNKNOWN'),
    fix: 'Reactivate your Meta ad account in Business Manager.',
    estimated_fix_hours: 48,
  },
  {
    key: 'billing_balance',
    name: 'Positive Billing Balance',
    weight: 'HIGH',
    test: (d) => Number(d.balance ?? 0) > 0,
    value: (d) => `$${(Number(d.balance ?? 0) / 100).toFixed(2)}`,
    fix: 'Add funds to your Meta ad account balance.',
    estimated_fix_hours: 1,
  },
  {
    key: 'disapproved_ads',
    name: 'No Disapproved Ads (90d)',
    weight: 'HIGH',
    test: (d) => Number(d.disapproved_90d ?? 0) === 0,
    value: (d) => `${d.disapproved_90d ?? 0} disapprovals`,
    fix: 'Resolve all disapproved ads in Ads Manager before launching.',
    estimated_fix_hours: 4,
  },
  {
    key: 'funding_source',
    name: 'Funding Source Verified',
    weight: 'HIGH',
    test: (d) => Boolean(d.funding_source),
    value: (d) => d.funding_source ? 'Connected' : 'Missing',
    fix: 'Add a valid payment method in Meta Business Settings > Payment.',
    estimated_fix_hours: 1,
  },
  {
    key: 'policy_violations',
    name: 'Zero Policy Violations',
    weight: 'HIGH',
    test: (d) => Number(d.policy_violations ?? 0) === 0,
    value: (d) => `${d.policy_violations ?? 0} violations`,
    fix: 'Resolve all policy violations in Account Quality.',
    estimated_fix_hours: 72,
  },
  {
    key: 'pixel_active',
    name: 'Facebook Pixel / Conversions API',
    weight: 'MEDIUM',
    test: (d) => Boolean(d.pixel_active),
    value: (d) => d.pixel_active ? 'Active (<7d)' : 'Not firing',
    fix: 'Install Meta Pixel or Conversions API on your landing page. Verify it fires on form submit.',
    estimated_fix_hours: 2,
  },
  {
    key: 'two_factor',
    name: 'Two-Factor Authentication',
    weight: 'MEDIUM',
    test: (d) => Boolean(d.two_factor_enabled),
    value: (d) => d.two_factor_enabled ? 'Enabled' : 'Disabled',
    fix: 'Enable 2FA on your Meta Business account under Security Center.',
    estimated_fix_hours: 0.5,
  },
  {
    key: 'domain_verified',
    name: 'Domain Verified in Business Manager',
    weight: 'MEDIUM',
    test: (d) => d.domain_verified === true || d.domain_verified === 'VERIFIED',
    value: (d) => d.domain_verified ? 'Verified' : 'Not verified',
    fix: 'Verify your domain in Meta Business Settings > Brand Safety > Domains.',
    estimated_fix_hours: 24,
  },
  {
    key: 'page_quality',
    name: 'Page Quality Score > 0.5',
    weight: 'LOW',
    test: (d) => Number(d.page_quality ?? 0) > 0.5,
    value: (d) => `${Number(d.page_quality ?? 0).toFixed(2)}/1.0`,
    fix: 'Improve Facebook Page quality by removing low-quality posts and responding to messages.',
    estimated_fix_hours: 48,
  },
];

const GOOGLE_CHECKS: CheckDef[] = [
  {
    key: 'account_status',
    name: 'Account Status',
    weight: 'CRITICAL',
    test: (d) => d.account_status === 'ENABLED' || d.account_status === 1,
    value: (d) => String(d.account_status ?? 'UNKNOWN'),
    fix: 'Enable your Google Ads account and resolve any suspensions.',
    estimated_fix_hours: 48,
  },
  {
    key: 'billing_balance',
    name: 'Positive Billing Balance',
    weight: 'HIGH',
    test: (d) => !d.past_due_invoices && Number(d.balance ?? 1) >= 0,
    value: (d) => d.past_due_invoices ? 'Past-due invoices' : 'OK',
    fix: 'Clear past-due invoices in Google Ads Billing Settings.',
    estimated_fix_hours: 1,
  },
  {
    key: 'disapproved_ads',
    name: 'No Disapproved Ads (90d)',
    weight: 'HIGH',
    test: (d) => Number(d.policy_violations ?? 0) === 0,
    value: (d) => `${d.policy_violations ?? 0} violations`,
    fix: 'Resolve all policy violations in Google Ads Policy Manager.',
    estimated_fix_hours: 4,
  },
  {
    key: 'payment_verified',
    name: 'Payment Method Verified',
    weight: 'HIGH',
    test: (d) => Boolean(d.payment_method),
    value: (d) => d.payment_method ? 'Valid' : 'Missing',
    fix: 'Add a valid credit card or bank account in Google Ads Billing.',
    estimated_fix_hours: 1,
  },
  {
    key: 'conversion_tracking',
    name: 'Google Tag / Conversion Tracking',
    weight: 'HIGH',
    test: (d) => Boolean(d.conversion_tracking_active),
    value: (d) => d.conversion_tracking_active ? 'Active' : 'Not firing',
    fix: 'Install Google Tag on your landing page and verify it tracks form submissions.',
    estimated_fix_hours: 2,
  },
  {
    key: 'search_network',
    name: 'Search Network Access',
    weight: 'MEDIUM',
    test: (d) => d.search_network !== false,
    value: (d) => d.search_network === false ? 'Restricted' : 'Enabled',
    fix: 'Ensure Search Network is enabled in Campaign Settings.',
    estimated_fix_hours: 1,
  },
  {
    key: 'account_age',
    name: 'Account Not in Probationary Period',
    weight: 'MEDIUM',
    test: (d) => Number(d.account_age_days ?? 30) >= 30 || Boolean(d.probation_waiver),
    value: (d) => `${d.account_age_days ?? '?'} days old`,
    fix: 'New accounts under 30 days may face daily spend limits. Contact Google support for a waiver.',
    estimated_fix_hours: 24,
  },
  {
    key: 'landing_page_policy',
    name: 'Landing Page Passes Google Policy',
    weight: 'MEDIUM',
    test: (d) => d.landing_page_policy !== false,
    value: (d) => d.landing_page_policy === false ? 'Policy issue detected' : 'Clear',
    fix: 'Review Google Ads landing page policies and remove any prohibited content.',
    estimated_fix_hours: 4,
  },
  {
    key: 'quality_score',
    name: 'Quality Score Baseline > 3',
    weight: 'LOW',
    test: (d) => Number(d.quality_score ?? 4) > 3 || d.quality_score == null,
    value: (d) => d.quality_score != null ? `${d.quality_score}/10` : 'New account',
    fix: 'Improve ad relevance and landing page experience to raise Quality Score.',
    estimated_fix_hours: 72,
  },
];

const LINKEDIN_CHECKS: CheckDef[] = [
  {
    key: 'account_status',
    name: 'Campaign Manager Active',
    weight: 'CRITICAL',
    test: (d) => d.account_status === 'ACTIVE',
    value: (d) => String(d.account_status ?? 'UNKNOWN'),
    fix: 'Activate your LinkedIn Campaign Manager account.',
    estimated_fix_hours: 48,
  },
  {
    key: 'billing_balance',
    name: 'Positive Billing Balance',
    weight: 'HIGH',
    test: (d) => !d.failed_payments,
    value: (d) => d.failed_payments ? 'Failed payment on file' : 'OK',
    fix: 'Update your payment method in Campaign Manager Billing.',
    estimated_fix_hours: 1,
  },
  {
    key: 'restricted_ads',
    name: 'No Restricted Ads (90d)',
    weight: 'HIGH',
    test: (d) => Number(d.restricted_ads_90d ?? 0) === 0,
    value: (d) => `${d.restricted_ads_90d ?? 0} restrictions`,
    fix: 'Resolve restricted ads in LinkedIn Campaign Manager.',
    estimated_fix_hours: 4,
  },
  {
    key: 'payment_method',
    name: 'Payment Method on File',
    weight: 'HIGH',
    test: (d) => Boolean(d.payment_method),
    value: (d) => d.payment_method ? 'Valid' : 'Missing',
    fix: 'Add a valid credit card in Campaign Manager > Billing.',
    estimated_fix_hours: 1,
  },
  {
    key: 'insight_tag',
    name: 'LinkedIn Insight Tag Installed',
    weight: 'HIGH',
    test: (d) => Boolean(d.insight_tag_active),
    value: (d) => d.insight_tag_active ? 'Firing' : 'Not detected',
    fix: 'Install LinkedIn Insight Tag on your landing page. Verify it fires on visit.',
    estimated_fix_hours: 2,
  },
  {
    key: 'company_page',
    name: 'Company Page Verified',
    weight: 'MEDIUM',
    test: (d) => d.company_page_status === 'VERIFIED' || Boolean(d.company_page_verified),
    value: (d) => d.company_page_verified ? 'Verified' : 'Not verified',
    fix: 'Complete LinkedIn Company Page verification.',
    estimated_fix_hours: 24,
  },
  {
    key: 'account_review',
    name: 'Account Not Under Review',
    weight: 'MEDIUM',
    test: (d) => d.review_status !== 'UNDER_REVIEW',
    value: (d) => d.review_status === 'UNDER_REVIEW' ? 'Under review' : 'Clear',
    fix: 'Contact LinkedIn support to expedite account review.',
    estimated_fix_hours: 48,
  },
  {
    key: 'sponsored_content',
    name: 'Sponsored Content Access',
    weight: 'MEDIUM',
    test: (d) => d.sponsored_content_access !== false,
    value: (d) => d.sponsored_content_access === false ? 'Disabled' : 'Enabled',
    fix: 'Enable Sponsored Content in Campaign Manager Permissions.',
    estimated_fix_hours: 1,
  },
  {
    key: 'audience_size',
    name: 'Projected Audience ≥ 300',
    weight: 'LOW',
    test: (d) => Number(d.projected_audience ?? 300) >= 300,
    value: (d) => `${(d.projected_audience ?? '?').toLocaleString()}`,
    fix: 'Broaden targeting criteria — LinkedIn requires ≥300 matched audience members.',
    estimated_fix_hours: 1,
  },
];

const TIKTOK_CHECKS: CheckDef[] = [
  {
    key: 'account_status',
    name: 'Ad Account Active and Approved',
    weight: 'CRITICAL',
    test: (d) => d.account_status === 'APPROVED' || d.account_status === 'ACTIVE',
    value: (d) => String(d.account_status ?? 'UNKNOWN'),
    fix: 'Complete TikTok Ads account approval process.',
    estimated_fix_hours: 72,
  },
  {
    key: 'billing_balance',
    name: 'Positive Balance / Billing Verified',
    weight: 'HIGH',
    test: (d) => !d.failed_charges && Number(d.balance ?? 1) >= 0,
    value: (d) => d.failed_charges ? 'Failed charge on file' : 'OK',
    fix: 'Resolve failed charges in TikTok Ads Manager Billing.',
    estimated_fix_hours: 1,
  },
  {
    key: 'rejected_creatives',
    name: 'No Rejected Creatives (90d)',
    weight: 'HIGH',
    test: (d) => Number(d.rejected_creatives_90d ?? 0) === 0,
    value: (d) => `${d.rejected_creatives_90d ?? 0} rejections`,
    fix: 'Review and resubmit rejected creatives in TikTok Ads Manager.',
    estimated_fix_hours: 4,
  },
  {
    key: 'pixel_installed',
    name: 'TikTok Pixel Installed on LP',
    weight: 'HIGH',
    test: (d) => Boolean(d.pixel_active),
    value: (d) => d.pixel_active ? 'Firing' : 'Not detected',
    fix: 'Install TikTok Pixel on your landing page.',
    estimated_fix_hours: 2,
  },
  {
    key: 'identity_verified',
    name: 'Identity Verification Complete',
    weight: 'HIGH',
    test: (d) => d.identity_verified === true || d.identity_status === 'VERIFIED',
    value: (d) => d.identity_verified ? 'Verified' : 'Pending',
    fix: 'Complete identity verification in TikTok Ads Manager Account Settings.',
    estimated_fix_hours: 48,
  },
  {
    key: 'business_center',
    name: 'Business Center Access',
    weight: 'MEDIUM',
    test: (d) => Boolean(d.business_center_access),
    value: (d) => d.business_center_access ? 'Enabled' : 'Disabled',
    fix: 'Request Business Center access in TikTok Ads Manager.',
    estimated_fix_hours: 24,
  },
  {
    key: 'region_eligibility',
    name: 'Country and Region Eligibility',
    weight: 'MEDIUM',
    test: (d) => d.region_eligible !== false,
    value: (d) => d.region_eligible === false ? 'Ineligible region' : 'Eligible',
    fix: 'Verify your targeting region is eligible for TikTok advertising.',
    estimated_fix_hours: 1,
  },
  {
    key: 'content_category',
    name: 'Content Category Approval',
    weight: 'MEDIUM',
    test: (d) => d.content_category_status === 'APPROVED' || d.content_category_status == null,
    value: (d) => String(d.content_category_status ?? 'N/A'),
    fix: 'Submit restricted content category for approval in TikTok Ads.',
    estimated_fix_hours: 48,
  },
  {
    key: 'creative_account_flag',
    name: 'Creative Account Not Flagged',
    weight: 'LOW',
    test: (d) => Number(d.flag_count ?? 0) === 0,
    value: (d) => `${d.flag_count ?? 0} flags`,
    fix: 'Review and resolve flagged content in your TikTok creative account.',
    estimated_fix_hours: 24,
  },
];

const CHECKS_BY_PLATFORM: Record<Platform, CheckDef[]> = {
  meta: META_CHECKS,
  google: GOOGLE_CHECKS,
  linkedin: LINKEDIN_CHECKS,
  tiktok: TIKTOK_CHECKS,
};

// ── Scorer ─────────────────────────────────────────────────────────────────

export function runHealthgateAgent(
  channel: Platform,
  accountData: Record<string, unknown>
): HealthgateAgentOutput {
  const defs = CHECKS_BY_PLATFORM[channel];
  let hasCriticalFail = false;
  let score = 100;
  const checks: HealthCheck[] = [];
  const blockingIssues: string[] = [];
  const fixSummary: string[] = [];

  for (const def of defs) {
    const passed = def.test(accountData);
    const points_max =
      def.weight === 'CRITICAL' ? 0 :  // CRITICAL checks gate the score via cap, not add points
      WEIGHT_POINTS[def.weight];
    const points_awarded = passed ? points_max : 0;

    if (!passed) {
      if (def.weight === 'CRITICAL') {
        hasCriticalFail = true;
        blockingIssues.unshift(`[CRITICAL] ${def.name}`);
        fixSummary.unshift(`${def.fix} (est. ${def.estimated_fix_hours}h)`);
      } else {
        score -= WEIGHT_POINTS[def.weight];
        if (def.weight === 'HIGH') blockingIssues.push(def.name);
        fixSummary.push(`${def.fix} (est. ${def.estimated_fix_hours}h)`);
      }
    }

    checks.push({
      key: def.key,
      name: def.name,
      weight: def.weight,
      passed,
      value: def.value(accountData),
      points_awarded: passed ? points_max : 0,
      points_max,
      fix: def.fix,
      estimated_fix_hours: def.estimated_fix_hours,
    });
  }

  // Cap at 40 if any CRITICAL check failed
  if (hasCriticalFail) score = Math.min(score, 40);
  score = Math.max(0, Math.min(100, score));

  const status: HealthStatus =
    score < 60 ? 'BLOCKED' : score < 80 ? 'WARN' : 'HEALTHY';

  const maxFixHours = checks
    .filter((c) => !c.passed)
    .reduce((max, c) => Math.max(max, c.estimated_fix_hours ?? 0), 0);

  return {
    channel,
    score,
    status,
    checks,
    blocking_issues: blockingIssues,
    fix_summary: fixSummary,
    estimated_unblock_hours: maxFixHours,
  };
}

// ── Parallel runner for all channels ──────────────────────────────────────
export async function runAllHealthgateAgents(
  channelData: Partial<Record<Platform, Record<string, unknown>>>
): Promise<Record<Platform, HealthgateAgentOutput>> {
  const platforms: Platform[] = ['meta', 'google', 'linkedin', 'tiktok'];

  const results = await Promise.all(
    platforms.map((p) =>
      Promise.resolve(runHealthgateAgent(p, channelData[p] ?? {}))
    )
  );

  return Object.fromEntries(
    results.map((r) => [r.channel, r])
  ) as Record<Platform, HealthgateAgentOutput>;
}
