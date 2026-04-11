'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Zap, ArrowRight, CheckCircle2, XCircle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthgateRing } from '@/components/healthgate-ring';
import { calculateHealthChecks, getDemoAccountData } from '@/lib/healthgate';

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Demo: show a RED healthgate + NO-GO
  const redData = getDemoAccountData('red');
  const redHealth = calculateHealthChecks(redData);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Nav */}
      <nav className="flex items-center justify-between max-w-[1280px] mx-auto px-6 h-16">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#FAFAFA] flex items-center justify-center">
            <span className="text-[#0A0A0A] text-xs font-bold">LL</span>
          </div>
          <span className="font-semibold">LaunchLense</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/accounts/connect?demo=1')}
        >
          Try Demo
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </nav>

      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="mb-4">
            Ad Account Insurance for Venture Studios
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
            Kill Bad Startup Ideas
            <br />
            <span className="text-[#EF4444]">in 48 Hours</span>
          </h1>
          <p className="text-lg text-[#A1A1A1] max-w-xl mx-auto mt-6">
            We compress 8-week ad validation to 48 hours. Real Meta traffic. Real data.
            Lawsuit-proof Go/No-Go verdict. All for under $500.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              size="lg"
              onClick={() => router.push('/accounts/connect?demo=1')}
            >
              <Zap className="w-4 h-4 mr-2" />
              Start Demo
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowDemo(!showDemo)}
            >
              See it work
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Interactive demo */}
      {showDemo && (
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[1280px] mx-auto px-6 pb-20"
        >
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <div className="text-xs text-[#A1A1A1] uppercase tracking-wider">Step 1: Healthgate™ blocks bad accounts</div>
                <HealthgateRing
                  score={redHealth.score}
                  status={redHealth.status}
                  checks={redHealth.checks}
                  size={96}
                />
                <div className="text-2xl font-mono font-bold tabular-nums text-[#EF4444]">
                  {redHealth.score}/100
                </div>
                <Badge variant="danger">Launch Blocked</Badge>
                <p className="text-sm text-[#A1A1A1]">
                  Score below 60 = no money wasted. Fix issues first.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <div className="text-xs text-[#A1A1A1] uppercase tracking-wider">Step 2: Data-driven verdict</div>
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-xl font-bold" style={{ border: '3px solid #EF4444', color: '#EF4444' }}>
                  NO-GO
                </div>
                <div className="text-sm text-[#A1A1A1] space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                    CPA $243 vs benchmark $45
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                    CVR 1.59% vs required 2%
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                    Only 2 leads (need 5+)
                  </div>
                </div>
                <div className="text-lg font-mono font-bold tabular-nums">
                  $487 spent to avoid{' '}
                  <span className="text-[#22C55E]">$35k</span> build
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      )}

      {/* Value props */}
      <section className="border-t border-[#262626] py-20">
        <div className="max-w-[1280px] mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Shield,
              title: 'Healthgate™ Circuit Breaker',
              desc: 'We say NO before $1 is spent. 12-point ad account inspection blocks bad tests.',
            },
            {
              icon: Zap,
              title: '48h Validation',
              desc: 'Real Meta traffic to a generated LP. Not surveys. Not focus groups. Real market signal.',
            },
            {
              icon: TrendingDown,
              title: 'Go/No-Go Verdict',
              desc: 'Data-driven decision at $500 spend. Compare to $35k MVP builds that fail.',
            },
          ].map((item) => (
            <div key={item.title} className="space-y-3">
              <item.icon className="w-8 h-8 text-[#FAFAFA]" />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-[#A1A1A1] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Email gate */}
      <section className="border-t border-[#262626] py-20">
        <div className="max-w-md mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold mb-3">Get Early Access</h2>
          <p className="text-sm text-[#A1A1A1] mb-6">
            Join the waitlist for launch. Venture studios only.
          </p>
          {!submitted ? (
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@venturestudio.com"
                required
                className="flex-1"
              />
              <Button type="submit">Join</Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[#22C55E]">
              <CheckCircle2 className="w-5 h-5" />
              <span>You&apos;re on the list!</span>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#262626] py-8">
        <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between">
          <div className="text-xs text-[#A1A1A1]">
            © {new Date().getFullYear()} LaunchLense. Ad account insurance.
          </div>
          <div className="text-xs text-[#A1A1A1]">v0.1</div>
        </div>
      </footer>
    </div>
  );
}
