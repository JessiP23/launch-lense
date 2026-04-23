import type { Metadata } from 'next';
import { LandingPageView } from '@/components/landing/landing-page-view';

export const metadata: Metadata = {
  title: 'LaunchLense',
  description:
    'Genome: free go/no-go preview. Run $500 tests on Google, Meta, LinkedIn, or TikTok. GO / NO-GO / ITERATE in 48 hours. Healthgate™ protects your budget.',
  icons: {
    icon: '/logo.png',
  }
};

export default function Home() {
  return <LandingPageView />;
}
