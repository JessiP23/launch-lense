'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Loader2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { createTest } from './actions';

interface Angle {
  headline: string;
  primary_text: string;
  cta: string;
}

interface AIResult {
  icp: string;
  value_prop: string;
  angles: Angle[];
}

const steps = ['Input', 'Review Angles', 'Preview & Deploy'];

export default function NewTestPage() {
  const router = useRouter();
  const { canLaunch, healthSnapshot } = useAppStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [idea, setIdea] = useState('');
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');

  // Step 2 state
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [selectedAngle, setSelectedAngle] = useState(0);
  const [editedAngles, setEditedAngles] = useState<Angle[]>([]);
  const [policyResult, setPolicyResult] = useState<{
    risk_level: string;
    blocked: boolean;
    issues: string[];
  } | null>(null);

  // Step 3 state
  const [deploying, setDeploying] = useState(false);
  const [approved, setApproved] = useState(false);

  // Block if healthgate is red
  if (!canLaunch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Shield className="w-16 h-16 text-[#EF4444] opacity-50" />
        <h2 className="text-xl font-semibold text-[#EF4444]">Launch Blocked</h2>
        <p className="text-[#A1A1A1] text-sm max-w-md text-center">
          Your Healthgate™ score is {healthSnapshot?.score || 'N/A'}. You need a score of 60+ to create tests.
          Go to Accounts to fix issues.
        </p>
        <Button variant="outline" onClick={() => router.push('/accounts/connect')}>
          Fix Account Health
        </Button>
      </div>
    );
  }

  const handleExtract = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idea, audience, offer }),
      });
      const data = await res.json();
      setAiResult(data);
      setEditedAngles(data.angles || []);
      setStep(1);
    } catch (err) {
      console.error('Extract failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyScan = async () => {
    if (!editedAngles[selectedAngle]) return;
    const angle = editedAngles[selectedAngle];
    const res = await fetch('/api/policy/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: angle.headline,
        primary_text: angle.primary_text,
      }),
    });
    const data = await res.json();
    setPolicyResult(data);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const result = await createTest({
        idea,
        audience,
        offer,
        angle: editedAngles[selectedAngle],
        orgId: useAppStore.getState().orgId || undefined,
        adAccountId: useAppStore.getState().activeAccountId || undefined,
        budgetCents: 50000,
        vertical: 'saas',
      });

      if (result.success && result.testId) {
        router.push(`/tests/${result.testId}`);
      } else {
        console.error('Deploy failed:', result.error);
      }
    } catch (err) {
      console.error('Deploy failed:', err);
    } finally {
      setDeploying(false);
    }
  };

  const updateAngle = (index: number, field: keyof Angle, value: string) => {
    const updated = [...editedAngles];
    updated[index] = { ...updated[index], [field]: value };
    setEditedAngles(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Create New Test</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Validate your idea in 48 hours with real Meta traffic
          </p>
        </div>
        <Badge variant="success">Healthgate: {healthSnapshot?.score}</Badge>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                i <= step
                  ? 'bg-[#FAFAFA] text-[#0A0A0A]'
                  : 'bg-[#262626] text-[#A1A1A1]'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm ${
                i <= step ? 'text-[#FAFAFA]' : 'text-[#A1A1A1]'
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-[#262626] mx-1" />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Input */}
        {step === 0 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Describe Your Test
                </CardTitle>
                <CardDescription>
                  Tell us about your startup idea. Our AI will generate ad angles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">
                    Startup Idea *
                  </label>
                  <Textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="e.g., AI-powered scheduling for dentists"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">
                    Target Audience
                  </label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g., Dental practice owners, US, 30-55"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">
                    Offer
                  </label>
                  <Input
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
                    placeholder="e.g., Free 14-day trial, no credit card"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleExtract}
                    disabled={!idea || loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Generating...' : 'Generate Angles'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Review Angles */}
        {step === 1 && aiResult && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* ICP & Value Prop */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="text-xs text-[#A1A1A1]">Ideal Customer Profile</div>
                <div className="text-sm">{aiResult.icp}</div>
                <div className="text-xs text-[#A1A1A1] mt-2">Value Proposition</div>
                <div className="text-sm">{aiResult.value_prop}</div>
              </CardContent>
            </Card>

            {/* Angles */}
            <div className="grid gap-4 md:grid-cols-3">
              {editedAngles.map((angle, i) => (
                <Card
                  key={i}
                  className={`cursor-pointer transition-all ${
                    selectedAngle === i
                      ? 'ring-1 ring-[#FAFAFA]'
                      : 'opacity-60 hover:opacity-80'
                  }`}
                  onClick={() => setSelectedAngle(i)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Angle {i + 1}
                      {selectedAngle === i && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-[10px] text-[#A1A1A1] uppercase tracking-wider">
                        Headline
                      </label>
                      <Input
                        value={angle.headline}
                        onChange={(e) =>
                          updateAngle(i, 'headline', e.target.value)
                        }
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A1A1A1] uppercase tracking-wider">
                        Primary Text
                      </label>
                      <Textarea
                        value={angle.primary_text}
                        onChange={(e) =>
                          updateAngle(i, 'primary_text', e.target.value)
                        }
                        className="mt-1 text-sm"
                        rows={3}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      CTA: {angle.cta}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Policy Scan */}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handlePolicyScan}>
                <Shield className="w-4 h-4 mr-2" />
                Run Policy Scan
              </Button>
              {policyResult && (
                <div className="flex items-center gap-2">
                  {policyResult.blocked ? (
                    <Badge variant="danger">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Blocked
                    </Badge>
                  ) : policyResult.risk_level === 'medium' ? (
                    <Badge variant="warning">Review Needed</Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Clear
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {policyResult?.issues && policyResult.issues.length > 0 && (
              <Card className="border-[#EAB308]/20">
                <CardContent className="pt-4">
                  <ul className="space-y-1">
                    {policyResult.issues.map((issue, i) => (
                      <li key={i} className="text-sm text-[#EAB308] flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={policyResult?.blocked}
              >
                Preview & Deploy
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Preview & Deploy */}
        {step === 2 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Campaign Preview</CardTitle>
                <CardDescription>
                  Review your campaign settings before launching
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1] w-40">Idea</td>
                      <td className="py-2">{idea}</td>
                    </tr>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1]">Audience</td>
                      <td className="py-2">Broad US 25-65</td>
                    </tr>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1]">Placements</td>
                      <td className="py-2">Instagram Feed, Facebook Feed</td>
                    </tr>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1]">Budget</td>
                      <td className="py-2 font-mono tabular-nums">$500 (max)</td>
                    </tr>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1]">Duration</td>
                      <td className="py-2">48 hours</td>
                    </tr>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1]">Headline</td>
                      <td className="py-2 font-medium">{editedAngles[selectedAngle]?.headline}</td>
                    </tr>
                    <tr className="border-b border-[#262626]/50 h-10">
                      <td className="py-2 text-[#A1A1A1]">Primary Text</td>
                      <td className="py-2">{editedAngles[selectedAngle]?.primary_text}</td>
                    </tr>
                    <tr className="h-10">
                      <td className="py-2 text-[#A1A1A1]">Healthgate™</td>
                      <td className="py-2">
                        <Badge variant="success">{healthSnapshot?.score}/100</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Ad mockup */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ad Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-sm mx-auto bg-[#111111] rounded-lg overflow-hidden border border-[#262626]">
                  <div className="p-3 flex items-center gap-2 border-b border-[#262626]">
                    <div className="w-8 h-8 rounded-full bg-[#262626]" />
                    <div>
                      <div className="text-xs font-medium">Your Brand</div>
                      <div className="text-[10px] text-[#A1A1A1]">Sponsored</div>
                    </div>
                  </div>
                  <div className="p-3 text-sm">
                    {editedAngles[selectedAngle]?.primary_text}
                  </div>
                  <div className="aspect-square bg-[#262626] flex items-center justify-center">
                    <Upload className="w-8 h-8 text-[#A1A1A1]" />
                  </div>
                  <div className="p-3 border-t border-[#262626]">
                    <div className="text-xs text-[#A1A1A1]">yourbrand.com</div>
                    <div className="text-sm font-semibold mt-0.5">
                      {editedAngles[selectedAngle]?.headline}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approval checkbox */}
            <div className="flex items-center gap-3 p-4 rounded-lg border border-[#262626] bg-[#111111]">
              <input
                type="checkbox"
                id="approve"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                className="rounded border-[#262626]"
              />
              <label htmlFor="approve" className="text-sm">
                I approve this campaign configuration. I understand that up to $500 of real ad spend may occur.
              </label>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={!approved || deploying}
                variant="success"
              >
                {deploying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {deploying ? 'Deploying...' : 'Deploy Campaign'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
