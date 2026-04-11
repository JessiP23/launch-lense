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
