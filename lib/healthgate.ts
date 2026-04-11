// Healthgate™ — The 12-check circuit breaker
// If health_score < 60, the entire app disables campaign creation.

import { statusFromScore } from './tokens';

export interface HealthCheck {
  name: string;
  key: string;
  maxPoints: number;
  passed: boolean;
  value: string;
  points: number;
  fix: string;
}

export interface HealthSnapshot {
  id: string;
  ad_account_id: string;
  score: number;
  status: 'red' | 'yellow' | 'green';
  checks: HealthCheck[];
  created_at: string;
}

// Calculate health score from Meta ad account data
export function calculateHealthChecks(accountData: Record<string, unknown>): {
  checks: HealthCheck[];
  score: number;
  status: 'red' | 'yellow' | 'green';
} {
  const checks: HealthCheck[] = [
    {
      name: 'Account Status',
      key: 'account_status',
      maxPoints: 20,
      passed: accountData.account_status === 1,
      value: accountData.account_status === 1 ? 'Active' : 'Inactive',
      points: accountData.account_status === 1 ? 20 : 0,
      fix: 'Ensure your Meta ad account is active and in good standing.',
    },
    {
      name: 'Account Balance',
      key: 'balance',
      maxPoints: 10,
      passed: Number(accountData.balance || 0) > 0,
      value: `$${(Number(accountData.balance || 0) / 100).toFixed(2)}`,
      points: Number(accountData.balance || 0) > 0 ? 10 : 0,
      fix: 'Add funds to your ad account balance.',
    },
    {
      name: 'Spend Cap',
      key: 'spend_cap',
      maxPoints: 5,
      passed: Number(accountData.spend_cap || 0) > 10000,
      value: accountData.spend_cap ? `$${(Number(accountData.spend_cap) / 100).toFixed(0)}` : 'None',
      points: Number(accountData.spend_cap || 0) > 10000 ? 5 : 0,
      fix: 'Set spend cap above $100 in Meta Business Settings.',
    },
    {
      name: 'Disapproved Ads (90d)',
      key: 'disapproved_90d',
      maxPoints: 15,
      passed: Number(accountData.disapproved_90d || 0) < 3,
      value: String(accountData.disapproved_90d || 0),
      points: Number(accountData.disapproved_90d || 0) < 3 ? 15 : 0,
      fix: 'Resolve disapproved ads. Fewer than 3 in 90 days required.',
    },
    {
      name: 'Page Quality',
      key: 'page_quality',
      maxPoints: 10,
      passed: Number(accountData.page_quality || 0) > 0.5,
      value: String(accountData.page_quality || 'N/A'),
      points: Number(accountData.page_quality || 0) > 0.5 ? 10 : 0,
      fix: 'Improve your Facebook Page quality score above 0.5.',
    },
    {
      name: 'Pixel Activity',
      key: 'pixel_active',
      maxPoints: 15,
      passed: Boolean(accountData.pixel_active),
      value: accountData.pixel_active ? 'Active (< 7d)' : 'Inactive',
      points: accountData.pixel_active ? 15 : 0,
      fix: 'Install and verify Meta Pixel fires within the last 7 days.',
    },
    {
      name: 'Funding Source',
      key: 'funding_source',
      maxPoints: 10,
      passed: Boolean(accountData.funding_source),
      value: accountData.funding_source ? 'Connected' : 'Missing',
      points: accountData.funding_source ? 10 : 0,
      fix: 'Add a valid payment method in Meta Business Settings.',
    },
    {
      name: 'Two-Factor Auth',
      key: '2fa',
      maxPoints: 5,
      passed: Boolean(accountData.two_factor_enabled),
      value: accountData.two_factor_enabled ? 'Enabled' : 'Disabled',
      points: accountData.two_factor_enabled ? 5 : 0,
      fix: 'Enable 2FA on the Meta Business account.',
    },
    {
      name: 'Domain Verified',
      key: 'domain_verified',
      maxPoints: 5,
      passed: Boolean(accountData.domain_verified),
      value: accountData.domain_verified ? 'Yes' : 'No',
      points: accountData.domain_verified ? 5 : 0,
      fix: 'Verify your domain in Meta Business Settings.',
    },
    {
      name: 'Admin Access',
      key: 'admin_access',
      maxPoints: 5,
      passed: Boolean(accountData.has_advertiser_access),
      value: accountData.has_advertiser_access ? 'Yes' : 'No',
      points: accountData.has_advertiser_access ? 5 : 0,
      fix: 'Ensure admin-level access to the ad account.',
    },
    {
      name: 'Spend (30d)',
      key: 'spend_30d',
      maxPoints: 5,
      passed: Number(accountData.spend_30d || 0) > 0,
      value: `$${(Number(accountData.spend_30d || 0) / 100).toFixed(0)}`,
      points: Number(accountData.spend_30d || 0) > 0 ? 5 : 0,
      fix: 'Account must have spent in the last 30 days.',
    },
    {
      name: 'Policy Issues',
      key: 'policy_issues',
      maxPoints: 10,
      passed: Number(accountData.policy_issues || 0) === 0,
      value: String(accountData.policy_issues || 0),
      points: Number(accountData.policy_issues || 0) === 0 ? 10 : 0,
      fix: 'Resolve all outstanding policy violations.',
    },
  ];

  const score = checks.reduce((sum, c) => sum + c.points, 0);
  const status = statusFromScore(score);

  return { checks, score, status };
}

// Demo mode: generate mock data for RED (bad account) or GREEN (good account)
export function getDemoAccountData(mode: 'red' | 'green'): Record<string, unknown> {
  if (mode === 'red') {
    return {
      account_status: 2, // inactive
      balance: 0,
      spend_cap: 500,
      disapproved_90d: 7,
      page_quality: 0.2,
      pixel_active: false,
      funding_source: false,
      two_factor_enabled: false,
      domain_verified: false,
      has_advertiser_access: true,
      spend_30d: 0,
      policy_issues: 3,
    };
  }
  return {
    account_status: 1,
    balance: 250000,
    spend_cap: 500000,
    disapproved_90d: 0,
    page_quality: 0.85,
    pixel_active: true,
    funding_source: true,
    two_factor_enabled: true,
    domain_verified: true,
    has_advertiser_access: true,
    spend_30d: 185000,
    policy_issues: 0,
  };
}

// Generate demo metrics that tick up over time
export function getDemoMetrics(testCreatedAt: string, currentTime: Date = new Date()) {
  const created = new Date(testCreatedAt);
  const elapsedMs = currentTime.getTime() - created.getTime();
  const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
  const progress = Math.min(1, elapsedHours / 48); // 48-hour test cycle

  // Simulate metrics growing over time
  const impressions = Math.floor(progress * 12500 + Math.random() * 200);
  const clicks = Math.floor(impressions * 0.012 + Math.random() * 5);
  const spend_cents = Math.floor(progress * 48700 + Math.random() * 100);
  const lp_views = Math.floor(clicks * 0.85);
  const leads = Math.floor(lp_views * 0.022);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpa_cents = leads > 0 ? Math.floor(spend_cents / leads) : 0;

  return {
    impressions,
    clicks,
    spend_cents,
    lp_views,
    leads,
    ctr,
    cpa_cents,
  };
}
