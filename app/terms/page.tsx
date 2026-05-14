import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — LaunchLense',
  description:
    'Terms governing your use of LaunchLense, a managed demand-validation service for startup founders.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="May 13, 2026"
      intro={
        <>
          These Terms govern your access to and use of LaunchLense. By
          creating an account or purchasing a sprint you agree to them. If
          you don&apos;t agree, don&apos;t use the Service.
        </>
      }
    >
      <h2>1. The Service</h2>
      <p>
        LaunchLense runs short, fixed-budget validation sprints on ad
        platforms we own and operate. You provide a startup idea and a
        budget; we generate angles, build landing pages, launch ads through
        our managed accounts, collect performance data, and return a
        deterministic verdict (GO / ITERATE / NO-GO).
      </p>
      <p>
        <strong>The Service is not a general-purpose ad-buying platform.</strong>{' '}
        You will never connect your own ad account.
      </p>

      <h2>2. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>You must have authority to enter into a contract.</li>
        <li>
          You must not be on a sanctions list or in a country subject to
          comprehensive US sanctions.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of the startup ideas you submit, the landing
        pages you edit, and the validation reports we deliver to you. You
        grant LaunchLense a non-exclusive licence to host, process, and
        display this content solely to operate the sprint.
      </p>
      <p>
        You represent that your idea content does not infringe IP, defame
        anyone, or solicit prohibited content (see Acceptable Use).
      </p>

      <h2>4. Acceptable use</h2>
      <p>You will not use the Service to advertise or validate:</p>
      <ul>
        <li>Adult content, gambling, weapons, illegal drugs, or tobacco.</li>
        <li>Cryptocurrency scams or unlicensed financial services.</li>
        <li>Multi-level marketing or pyramid schemes.</li>
        <li>Hate speech, harassment, or content that violates platform policies of Meta, Google, TikTok, or LinkedIn.</li>
        <li>Content that requires special advertiser certification we have not obtained.</li>
      </ul>
      <p>
        We reserve the right to refuse, pause, or refund any sprint we
        believe violates these rules, the Meta Advertising Standards, or any
        other downstream platform&apos;s policies.
      </p>

      <h2>5. Pricing and payment</h2>
      <ul>
        <li>
          Sprint prices are displayed in USD at checkout and are inclusive
          of the ad spend we will commit on your behalf.
        </li>
        <li>
          Payment is processed by Stripe. The campaign does not launch until
          Stripe confirms a successful charge.
        </li>
        <li>
          Sprints are billed up-front. There is no recurring subscription
          unless you explicitly choose one.
        </li>
      </ul>

      <h2>6. Refunds</h2>
      <ul>
        <li>
          <strong>Before launch:</strong> if you cancel before campaigns are
          activated on our ad accounts, we refund 100% (less Stripe&apos;s
          non-refundable processing fee).
        </li>
        <li>
          <strong>After launch:</strong> ad spend already committed cannot be
          refunded. The platform-fee portion remains refundable at our
          discretion if you experienced a failure on our side.
        </li>
        <li>
          <strong>Verdict guarantee:</strong> if we fail to deliver a verdict
          within 72 hours of a successful payment due to an issue on our
          side, the platform-fee portion is refunded in full.
        </li>
      </ul>

      <h2>7. Service performance, not investment advice</h2>
      <p>
        The verdict and accompanying memo are an analytical signal, not
        legal, financial, or investment advice. Many startups with GO
        verdicts still fail. Many with NO-GO verdicts have founders who
        pushed through and succeeded. You alone decide what to do with the
        information.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; basis. To the maximum extent allowed by law,
        LaunchLense disclaims all warranties, express or implied, including
        merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        Except for fraud, gross negligence, or wilful misconduct,
        LaunchLense&apos;s aggregate liability arising out of or related to
        the Service will not exceed the amount you paid us in the twelve
        (12) months preceding the event giving rise to the claim. In no
        event will we be liable for indirect, incidental, consequential, or
        punitive damages, including lost profits or lost goodwill.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You will indemnify LaunchLense, its affiliates, and its employees
        from any claim arising from (a) content you submitted, (b) your
        breach of these Terms, or (c) your violation of any law or
        third-party right.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may terminate your account at any time via{' '}
        <Link href="/data-deletion">launchlense.com/data-deletion</Link>. We
        may suspend or terminate your access if you breach these Terms or
        the Acceptable Use rules, or if continuing the Service would expose
        us to legal risk.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms. Material changes will be emailed at least
        14 days in advance. Continued use of the Service after the effective
        date is acceptance.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware,
        United States, without regard to its conflict-of-laws principles.
        Any dispute will be resolved exclusively in the state or federal
        courts located in New Castle County, Delaware. The UN Convention on
        Contracts for the International Sale of Goods does not apply.
      </p>

      <h2>14. Contact</h2>
      <p>
        Legal:{' '}
        <a href="mailto:legal@launchlense.app">legal@launchlense.app</a>
        <br />
        Support:{' '}
        <a href="mailto:support@launchlense.app">support@launchlense.app</a>
      </p>
    </LegalPage>
  );
}
