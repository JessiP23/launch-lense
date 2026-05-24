'use client';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingDashboardMock } from '@/components/landing/landing-dashboard-mock';
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
      {/* Noise texture overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.02,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
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
