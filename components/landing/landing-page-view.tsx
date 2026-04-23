'use client';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingStatsBar } from '@/components/landing/landing-stats-bar';
import { LandingGenome } from '@/components/landing/landing-genome';
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works';
import { LandingVerdictEngine } from '@/components/landing/landing-verdict-engine';
import { LandingHealthgateBlock } from '@/components/landing/landing-healthgate-block';
import { LandingTestimonials } from '@/components/landing/landing-testimonials';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { LandingFaq } from '@/components/landing/landing-faq';
import { LandingFinalCta } from '@/components/landing/landing-final-cta';
import { LandingFooter } from '@/components/landing/landing-footer';

export function LandingPageView() {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingStatsBar />
        <LandingGenome />
        <LandingHowItWorks />
        <LandingVerdictEngine />
        <LandingHealthgateBlock />
        <LandingTestimonials />
        <LandingPricing />
        <LandingFaq />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
