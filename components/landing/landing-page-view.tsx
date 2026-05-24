'use client';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingDashboardMock } from './landing-dashboard-mock';
import { LandingChannelLogos } from '@/components/landing/landing-channel-logos';
import { LandingGenome } from '@/components/landing/landing-genome';
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works';
import { LandingVerdictEngine } from '@/components/landing/landing-verdict-engine';
import { LandingHealthgate } from '@/components/landing/landing-healthgate';
import { LandingTestimonials } from '@/components/landing/landing-testimonials';
import { LandingFinalCta } from '@/components/landing/landing-final-cta';
import { LandingFooter } from '@/components/landing/landing-footer';

export function LandingPageView() {
  return (
    <div className="min-h-screen bg-[#ffffff] text-[#1a1a1a]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingDashboardMock />
        <LandingChannelLogos />
        <LandingGenome />
        <LandingHowItWorks />
        <LandingVerdictEngine />
        <LandingHealthgate />
        <LandingTestimonials />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
