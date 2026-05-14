import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — LaunchLense',
  description:
    'How LaunchLense collects, uses, and protects data when running managed validation sprints for founders. Includes Meta Platform data handling, GDPR, and CCPA rights.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="May 13, 2026"
      intro={
        <>
          <strong>Plain-English summary.</strong> LaunchLense runs paid
          validation tests for your startup idea on <em>our own</em> ad
          accounts — you never connect your Meta, Google, TikTok, or LinkedIn
          account. We collect the minimum data we need to run those tests
          (your idea, your email, your payment, and anonymized landing-page
          analytics), we never sell it, and you can delete it any time at{' '}
          <Link href="/data-deletion">launchlense.com/data-deletion</Link>.
        </>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        LaunchLense (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;the
        Service&rdquo;) is operated by LaunchLense, Inc. We provide a managed
        demand-validation service that runs short ad campaigns on platforms we
        own and control, and returns a GO / ITERATE / NO-GO verdict to the
        founder who purchased the sprint.
      </p>
      <p>
        <strong>Data controller:</strong> LaunchLense, Inc.
        <br />
        <strong>Contact:</strong>{' '}
        <a href="mailto:privacy@launchlense.app">privacy@launchlense.app</a>
      </p>

      <h2>2. What we collect</h2>

      <h3>2.1 Information you give us</h3>
      <ul>
        <li>
          <strong>Account data:</strong> name, email, organization name, and
          authentication identifiers from Clerk (our auth provider).
        </li>
        <li>
          <strong>Sprint inputs:</strong> the startup idea text, optional
          targeting preferences, budget tier, and any landing-page copy you
          author or edit inside the editor.
        </li>
        <li>
          <strong>Payment data:</strong> billing email and the last four digits
          of your card. <strong>We never store full card numbers</strong> —
          payment is handled by Stripe under their PCI-compliant
          infrastructure.
        </li>
      </ul>

      <h3>2.2 Information we generate</h3>
      <ul>
        <li>
          <strong>Validation outputs:</strong> Genome scores, Healthgate
          results, generated angles, generated landing pages, and the final
          verdict report.
        </li>
        <li>
          <strong>Campaign telemetry:</strong> aggregated impressions, clicks,
          CTR, CPC, spend, frequency, and conversion counts pulled from the
          Meta Marketing API for the ads <em>we</em> ran on your behalf.
        </li>
        <li>
          <strong>Landing-page analytics:</strong> anonymized events
          (PageView, ScrollDepth, CTA click, Lead) collected from the LPs we
          host for your sprint, with UTM and per-angle attribution.
        </li>
      </ul>

      <h3>2.3 Information we receive from third parties</h3>
      <ul>
        <li>
          <strong>Meta Platform Data:</strong> when we run an ad on our own
          ad account for your sprint, Meta returns campaign-level performance
          metrics to us. We do <strong>not</strong> receive any data about
          individuals who saw or clicked your ad beyond aggregate counts and
          standard pixel events (deduplicated server-side via the Conversions
          API). If a visitor submits the LP form, we record the contact
          details they voluntarily entered.
        </li>
        <li>
          <strong>Stripe:</strong> payment confirmations and refund events via
          webhook.
        </li>
      </ul>

      <h2>3. What we do not do</h2>
      <ul>
        <li>
          We do <strong>not</strong> ask you to connect your own Meta, Google,
          TikTok, or LinkedIn account. The managed architecture means there
          are no customer OAuth tokens to store.
        </li>
        <li>
          We do <strong>not</strong> sell your data, your idea, or your
          campaign results to any third party.
        </li>
        <li>
          We do <strong>not</strong> use your idea content to train
          general-purpose ML models.
        </li>
        <li>
          We do <strong>not</strong> share your unreleased idea with other
          customers.
        </li>
      </ul>

      <h2>4. How we use the data</h2>
      <ul>
        <li>To create and run validation sprints you purchased.</li>
        <li>
          To generate angles, landing pages, and the final report you receive.
        </li>
        <li>
          To monitor campaign performance and auto-pause underperformers so
          your budget is not wasted.
        </li>
        <li>To process payments, refunds, and chargebacks through Stripe.</li>
        <li>
          To detect abuse, fraud, and policy violations on the Service.
        </li>
        <li>
          To send transactional emails (sprint status, verdict ready,
          payment receipts).
        </li>
      </ul>

      <h2>5. Legal bases (GDPR/UK GDPR)</h2>
      <ul>
        <li>
          <strong>Contract</strong> — running the sprint you paid for.
        </li>
        <li>
          <strong>Legitimate interest</strong> — fraud prevention, securing
          our infrastructure, product analytics in aggregate form.
        </li>
        <li>
          <strong>Consent</strong> — optional marketing emails. You can
          withdraw at any time via the unsubscribe link in any email.
        </li>
        <li>
          <strong>Legal obligation</strong> — tax records, anti-money
          laundering requirements, lawful requests from regulators.
        </li>
      </ul>

      <h2>6. Where we store data</h2>
      <ul>
        <li>
          <strong>Application database:</strong> Supabase (Postgres), hosted
          in US-East. Secrets and OAuth artifacts are kept in Supabase Vault.
        </li>
        <li>
          <strong>File storage:</strong> Supabase Storage for generated PDF
          reports and landing-page HTML.
        </li>
        <li>
          <strong>Authentication:</strong> Clerk.
        </li>
        <li>
          <strong>Payments:</strong> Stripe.
        </li>
        <li>
          <strong>Hosting:</strong> Vercel.
        </li>
        <li>
          <strong>Analytics:</strong> PostHog (self-hosted EU region for
          EU-attributed events when available).
        </li>
      </ul>
      <p>
        All sub-processors are bound by data-processing agreements compliant
        with GDPR and CCPA. A current list is available on request.
      </p>

      <h2>7. How long we keep data</h2>
      <ul>
        <li>
          <strong>Sprint inputs and verdict reports:</strong> 24 months from
          the end of the sprint, then anonymized.
        </li>
        <li>
          <strong>Aggregate ad metrics:</strong> kept indefinitely in
          de-identified form to improve future benchmarks.
        </li>
        <li>
          <strong>Account profile:</strong> until you delete your account.
        </li>
        <li>
          <strong>Payment records:</strong> 7 years (tax compliance).
        </li>
        <li>
          <strong>Landing-page leads</strong> (emails that visitors entered
          into your sprint LPs): purged 90 days after the sprint completes,
          or earlier on request.
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>
        You can exercise the following rights at any time by emailing{' '}
        <a href="mailto:privacy@launchlense.app">privacy@launchlense.app</a>{' '}
        or using the form at{' '}
        <Link href="/data-deletion">launchlense.com/data-deletion</Link>:
      </p>
      <ul>
        <li>Access — a copy of the personal data we hold about you.</li>
        <li>Rectification — correct anything that is wrong.</li>
        <li>Erasure — delete your data (see Data Deletion page).</li>
        <li>Restriction — pause processing while a dispute is resolved.</li>
        <li>Portability — export your sprints in JSON.</li>
        <li>Objection — opt out of analytics or marketing.</li>
      </ul>
      <p>
        EU/UK residents may also lodge a complaint with their local data
        protection authority. California residents have additional rights
        under the CCPA/CPRA, including the right to know, the right to
        delete, the right to correct, and the right to opt out of any sale
        or sharing of personal information (we do neither).
      </p>

      <h2>9. Cookies and tracking</h2>
      <p>
        On <code>launchlense.com</code> we use first-party cookies to keep
        you signed in and to remember your sidebar preferences. We do{' '}
        <strong>not</strong> deploy third-party advertising cookies on this
        marketing site. PostHog product analytics are first-party and
        configured to ignore IP addresses by default.
      </p>
      <p>
        On the <em>sprint landing pages</em> we host for your tests we run
        the Meta Pixel and the Meta Conversions API for performance
        attribution. These events are deduplicated with a shared{' '}
        <code>event_id</code> and contain no PII unless a visitor voluntarily
        submitted their email in the form.
      </p>

      <h2>10. Security</h2>
      <ul>
        <li>Encryption in transit (TLS 1.2+) and at rest (AES-256).</li>
        <li>Row-level security on every Supabase table.</li>
        <li>
          Service-role secrets and the Meta system-user token live in
          Supabase Vault and are never shipped to the browser.
        </li>
        <li>SHA-256 hashing of email and phone before any CAPI send.</li>
        <li>HMAC-SHA256 signature verification on all inbound webhooks.</li>
      </ul>

      <h2>11. Children</h2>
      <p>
        LaunchLense is not directed at people under 16. We do not knowingly
        collect data from children. If you believe we have, email{' '}
        <a href="mailto:privacy@launchlense.app">privacy@launchlense.app</a>{' '}
        and we will delete it.
      </p>

      <h2>12. International transfers</h2>
      <p>
        Where data is transferred out of the EEA/UK we rely on Standard
        Contractual Clauses with our sub-processors and additional
        safeguards required by Schrems II.
      </p>

      <h2>13. Changes</h2>
      <p>
        We will post any material change on this page and bump the &ldquo;Last
        updated&rdquo; date. Substantial changes will additionally be emailed
        to registered users at least 14 days before they take effect.
      </p>

      <h2>14. Contact</h2>
      <p>
        Privacy questions:{' '}
        <a href="mailto:privacy@launchlense.app">privacy@launchlense.app</a>
        <br />
        Security disclosures:{' '}
        <a href="mailto:security@launchlense.app">security@launchlense.app</a>
        <br />
        General support:{' '}
        <a href="mailto:support@launchlense.app">support@launchlense.app</a>
      </p>
    </LegalPage>
  );
}
