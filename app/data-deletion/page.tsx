import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';
import { DataDeletionForm } from '@/components/legal/data-deletion-form';

export const metadata: Metadata = {
  title: 'Data Deletion — LaunchLense',
  description:
    'Delete your LaunchLense account and all associated sprint data. Required Meta App Review data deletion instructions URL.',
  alternates: { canonical: '/data-deletion' },
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data deletion"
      lastUpdated="May 13, 2026"
      intro={
        <>
          You can permanently delete your LaunchLense account and every sprint
          attached to it. Once a deletion is confirmed it cannot be undone.
          Aggregate, fully-anonymized benchmarks (e.g. average SaaS CTR) may
          persist, because they no longer contain any data that identifies you.
        </>
      }
    >
      <h2>What gets deleted</h2>
      <ul>
        <li>Your account profile and authentication record.</li>
        <li>
          All sprints, including the original idea text, Genome/Healthgate
          outputs, generated angles, generated landing pages, and verdict
          reports.
        </li>
        <li>
          All campaign records we created on your behalf
          (<code>sprint_campaigns</code>, <code>sprint_ads</code>) plus the
          underlying Meta objects we control (campaigns, ad sets, ads,
          creatives).
        </li>
        <li>
          All collected landing-page events
          (<code>sprint_lp_events</code>) and metrics snapshots
          (<code>sprint_metrics</code>).
        </li>
        <li>
          Any emails captured by your sprint LPs (deleted alongside the
          sprint).
        </li>
        <li>PDF reports stored in Supabase Storage.</li>
      </ul>

      <h2>What we keep, and why</h2>
      <ul>
        <li>
          <strong>Payment records</strong> — kept 7 years to comply with tax
          and anti-money-laundering law. These records contain only the
          minimum data Stripe returns (last 4, billing email, amount, date).
        </li>
        <li>
          <strong>Aggregate, de-identified benchmarks</strong> — your sprint
          may have contributed one anonymous data point (e.g. an industry
          CTR). We cannot re-identify you from this.
        </li>
      </ul>

      <h2>Option 1 — Self-serve (recommended)</h2>
      <p>
        Sign into LaunchLense, open the menu, choose <strong>Settings → Danger
        zone → Delete my account</strong>, and confirm. Deletion runs
        immediately and finishes within a few seconds. You will receive a
        confirmation email once the cascade is complete.
      </p>

      <h2>Option 2 — Submit a request</h2>
      <p>
        If you can&rsquo;t access your account, submit the form below. We will
        verify the request out-of-band against the email on file and complete
        deletion within <strong>30 days</strong> (typically within 72 hours).
        Your confirmation code is the receipt you will reference if you need
        to follow up.
      </p>

      <DataDeletionForm />

      <h2>Option 3 — Meta-initiated deletion</h2>
      <p>
        If you stop using LaunchLense via Meta, Meta will send a signed
        deletion request to our callback URL:
        <br />
        <code>https://launchlense.com/api/meta/data-deletion</code>
      </p>
      <p>
        When we receive that request we cascade the same deletion described
        above and return a status URL Meta can poll. We honour Meta&rsquo;s
        Platform Terms requirement of completing erasure within 30 days.
      </p>

      <h2>What to expect after deletion</h2>
      <ul>
        <li>
          Any sprint LP currently live will be taken offline within 24 hours
          (we keep the URL responsive but return a 410 Gone response).
        </li>
        <li>
          Active Meta ad campaigns we ran on your behalf will be paused
          immediately and torn down within 24 hours.
        </li>
        <li>
          PostHog events keyed to your sprints are deleted via PostHog&rsquo;s
          GDPR delete API.
        </li>
      </ul>

      <h2>Help</h2>
      <p>
        If anything is unclear, email{' '}
        <a href="mailto:privacy@launchlense.app">privacy@launchlense.app</a>.
        You can also read how we collect and use data in our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
