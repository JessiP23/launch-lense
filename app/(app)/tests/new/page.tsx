'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SprintRecord, Platform, GenomeAgentOutput, HealthgateAgentOutput } from '@/lib/agents/types';

// ── PROOF design tokens ────────────────────────────────────────────────────
const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#059669', warn: '#D97706', stop: '#DC2626',
};

// ── Sprint state labels ────────────────────────────────────────────────────
const STATE_LABELS: Record<string, string> = {
  IDLE: 'Waiting', GENOME_RUNNING: 'Genome Running', GENOME_DONE: 'Genome Complete',
  HEALTHGATE_RUNNING: 'Healthgate Running', HEALTHGATE_DONE: 'Healthgate Complete',
  ANGLES_RUNNING: 'Angle Agent Running', ANGLES_DONE: 'Angles Generated',
  CAMPAIGN_RUNNING: 'Campaigns Launching', CAMPAIGN_MONITORING: 'Monitoring Campaigns',
  VERDICT_GENERATING: 'Generating Verdict', COMPLETE: 'Sprint Complete', BLOCKED: 'Blocked',
};

type PipelineStepId = 'genome' | 'healthgate' | 'angles' | 'campaign' | 'verdict';
type StepStatus = 'waiting' | 'running' | 'done' | 'blocked' | 'skipped';
type StepStatuses = Record<PipelineStepId, StepStatus>;

const PIPELINE: { id: PipelineStepId; label: string; sublabel: string; parallel?: boolean }[] = [
  { id: 'genome',     label: 'GenomeAgent',        sublabel: 'Research · 5-axis score · Signal' },
  { id: 'healthgate', label: 'HealthgateAgent ×4', sublabel: 'Meta · Google · LinkedIn · TikTok', parallel: true },
  { id: 'angles',     label: 'AngleAgent',          sublabel: '3 archetypes · 4 channels' },
  { id: 'campaign',   label: 'CampaignAgent ×n',   sublabel: 'Launch · Monitor · Auto-pause', parallel: true },
  { id: 'verdict',    label: 'VerdictAgent',        sublabel: 'Per-channel + Aggregate' },
];

const ALL_CHANNELS: Platform[] = ['meta', 'google', 'linkedin', 'tiktok'];
const CHANNEL_LABELS: Record<Platform, string> = { meta: 'Meta', google: 'Google', linkedin: 'LinkedIn', tiktok: 'TikTok' };

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done')    return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.go }} />;
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.ink }} />;
  if (status === 'blocked') return <XCircle className="w-3.5 h-3.5" style={{ color: C.stop }} />;
  return <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.border }} />;
}

function CompositeBar({ scores }: { scores: GenomeAgentOutput['scores'] }) {
  const axes = [
    { key: 'demand' as const,      label: 'Demand',      w: '30%' },
    { key: 'icp' as const,         label: 'ICP',         w: '25%' },
    { key: 'competition' as const, label: 'Competition', w: '20%' },
    { key: 'timing' as const,      label: 'Timing',      w: '15%' },
    { key: 'moat' as const,        label: 'Moat',        w: '10%' },
  ];
  return (
    <div className="space-y-2">
      {axes.map(({ key, label, w }) => {
        const val = scores[key];
        const color = val >= 70 ? C.go : val >= 40 ? C.warn : C.stop;
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-20 text-right">
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.06em]" style={{ color: C.muted }}>{label}</span>
            </div>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: C.faint }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full" style={{ background: color }}
              />
            </div>
            <span className="w-8 text-right font-mono text-[0.75rem] font-bold" style={{ color }}>{val}</span>
            <span className="w-6 text-[0.625rem]" style={{ color: C.muted }}>{w}</span>
          </div>
        );
      })}
    </div>
  );
}

function HealthgateGrid({ healthgate }: { healthgate: Record<Platform, HealthgateAgentOutput> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ALL_CHANNELS.map((ch) => {
        const h = healthgate[ch];
        if (!h) return null;
        const sc = h.status === 'HEALTHY' ? C.go : h.status === 'WARN' ? C.warn : C.stop;
        return (
          <div key={ch} className="rounded-lg border p-3 space-y-2" style={{ borderColor: C.border, background: C.surface }}>
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-medium" style={{ color: C.ink }}>{CHANNEL_LABELS[ch]}</span>
              <span className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ color: sc, background: `${sc}15` }}>{h.status}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="font-mono font-bold text-[1.5rem] leading-none" style={{ color: sc }}>{h.score}</span>
              <span className="text-[0.625rem] mb-1" style={{ color: C.muted }}>/100</span>
            </div>
            <div className="flex gap-0.5">
              {h.checks.map((c) => (
                <div key={c.key} title={`${c.name}: ${c.passed ? 'Pass' : 'Fail'}`} className="flex-1 h-1 rounded-full"
                  style={{ background: c.passed ? C.go : c.weight === 'CRITICAL' ? C.stop : c.weight === 'HIGH' ? C.warn : `${C.muted}50` }} />
              ))}
            </div>
            {h.blocking_issues.length > 0 && (
              <p className="text-[0.625rem] leading-tight" style={{ color: C.stop }}>{h.blocking_issues[0]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AngleCard({ angle, idx }: { angle: NonNullable<SprintRecord['angles']>['angles'][number]; idx: number }) {
  const archetypeColors: Record<string, string> = {
    PAIN: C.stop, ASPIRATION: C.go, SOCIAL_PROOF: C.warn, CURIOSITY: C.ink, AUTHORITY: C.muted,
  };
  const ac = archetypeColors[angle.archetype] ?? C.ink;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
      className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.surface }}>
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ color: ac, background: `${ac}15` }}>{angle.archetype}</span>
            <span className="text-[0.625rem] uppercase tracking-[0.06em]" style={{ color: C.muted }}>{angle.emotional_lever}</span>
          </div>
          <p className="font-display font-bold text-[0.9375rem]" style={{ color: C.ink }}>{angle.id.replace('_', ' ').toUpperCase()}</p>
        </div>
        <span className="text-[0.6875rem] font-semibold px-2 py-1 rounded border" style={{ color: C.ink, borderColor: C.border, background: C.faint }}>{angle.cta}</span>
      </div>
      <div className="grid grid-cols-2 gap-px border-t" style={{ borderColor: C.border, background: C.border }}>
        {([
          { ch: 'Meta',     text: angle.copy.meta.headline,     sub: angle.copy.meta.body },
          { ch: 'Google',   text: angle.copy.google.headline1,  sub: angle.copy.google.description },
          { ch: 'LinkedIn', text: angle.copy.linkedin.headline, sub: angle.copy.linkedin.intro },
          { ch: 'TikTok',   text: angle.copy.tiktok.hook,       sub: angle.copy.tiktok.overlay },
        ] as const).map(({ ch, text, sub }) => (
          <div key={ch} className="p-3 space-y-1" style={{ background: C.surface }}>
            <p className="text-[0.625rem] font-medium uppercase tracking-[0.06em]" style={{ color: C.muted }}>{ch}</p>
            <p className="text-[0.8125rem] font-semibold leading-snug" style={{ color: C.ink }}>{text}</p>
            <p className="text-[0.6875rem] leading-relaxed" style={{ color: C.muted }}>{sub}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function NewTestPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [channels, setChannels] = useState<Platform[]>(['meta', 'google', 'linkedin', 'tiktok']);
  const [sprint, setSprint] = useState<SprintRecord | null>(null);
  const [stepStatuses, setStepStatuses] = useState<StepStatuses>({
    genome: 'waiting', healthgate: 'waiting', angles: 'waiting', campaign: 'waiting', verdict: 'waiting',
  });
  const [runningPhase, setRunningPhase] = useState<PipelineStepId | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const setStep = useCallback((id: PipelineStepId, status: StepStatus) =>
    setStepStatuses((prev) => ({ ...prev, [id]: status })), []);

  const resetSprint = () => {
    setSprint(null); setBlockReason(null);
    setStepStatuses({ genome: 'waiting', healthgate: 'waiting', angles: 'waiting', campaign: 'waiting', verdict: 'waiting' });
    setRunningPhase(null); setIsStarting(false);
  };

  const runSprint = async () => {
    if (!idea.trim() || channels.length === 0) return;
    setIsStarting(true);
    setBlockReason(null);
    setStepStatuses({ genome: 'waiting', healthgate: 'waiting', angles: 'waiting', campaign: 'waiting', verdict: 'waiting' });

    try {
      // 1. Create sprint
      const createRes = await fetch('/api/sprint', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim(), channels }),
      });
      const createData = await createRes.json() as { sprint_id?: string; error?: string };
      if (!createData.sprint_id) throw new Error(createData.error ?? 'Failed to create sprint');

      const sprint_id = createData.sprint_id;
      setSprint({ ...(createData as unknown as SprintRecord), idea: idea.trim(), state: 'IDLE' as const });
      setIsStarting(false);

      // 2. Genome
      setStep('genome', 'running'); setRunningPhase('genome');
      const genomeRes = await fetch(`/api/sprint/${sprint_id}/genome`, { method: 'POST' });
      const genomeData = await genomeRes.json() as { state: string; genome?: GenomeAgentOutput; blocked_reason?: string };
      setSprint((prev) => prev ? { ...prev, state: genomeData.state as SprintRecord['state'], genome: genomeData.genome } : prev);

      if (genomeData.state === 'BLOCKED') {
        setStep('genome', 'blocked');
        setBlockReason(genomeData.blocked_reason ?? 'Genome returned STOP signal.');
        setRunningPhase(null); return;
      }
      setStep('genome', 'done');

      // 3. Healthgate (parallel)
      setStep('healthgate', 'running'); setRunningPhase('healthgate');
      const hgRes = await fetch(`/api/sprint/${sprint_id}/healthgate`, { method: 'POST' });
      const hgData = await hgRes.json() as { state: string; healthgate?: Record<Platform, HealthgateAgentOutput>; active_channels?: Platform[]; blocked_reason?: string };
      setSprint((prev) => prev ? { ...prev, state: hgData.state as SprintRecord['state'], healthgate: hgData.healthgate, active_channels: hgData.active_channels ?? prev.active_channels } : prev);

      if (hgData.state === 'BLOCKED') {
        setStep('healthgate', 'blocked');
        setBlockReason(hgData.blocked_reason ?? 'All channels blocked.');
        setRunningPhase(null); return;
      }
      setStep('healthgate', 'done');

      // 4. Angles
      setStep('angles', 'running'); setRunningPhase('angles');
      const anglesRes = await fetch(`/api/sprint/${sprint_id}/angles`, { method: 'POST' });
      const anglesData = await anglesRes.json() as { state: string; angles?: SprintRecord['angles']; blocked_reason?: string; sprint_id?: string };
      setSprint((prev) => prev ? { ...prev, state: anglesData.state as SprintRecord['state'], angles: anglesData.angles } : prev);

      if (anglesData.state === 'BLOCKED') {
        setStep('angles', 'blocked');
        setBlockReason(anglesData.blocked_reason ?? 'AngleAgent failed.');
        setRunningPhase(null); return;
      }
      setStep('angles', 'done');
      setStep('campaign', 'skipped');
      setRunningPhase(null);

      // Persist for setup page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`sprint:${sprint_id}`, JSON.stringify(anglesData));
      }

      router.push(`/tests/${sprint_id}/setup`);

    } catch (err) {
      console.error('[newSprint]', err);
      setBlockReason(`Error: ${String(err)}`);
      setRunningPhase(null); setIsStarting(false);
    }
  };

  const toggleChannel = (ch: Platform) =>
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);

  const isRunning = isStarting || runningPhase !== null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 text-black">

      {/* Header */}
      <div>
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em]" style={{ color: C.muted }}>Sprint Orchestrator</p>
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] mt-0.5" style={{ color: C.ink }}>New Validation Sprint</h1>
        <p className="text-[0.875rem] mt-1" style={{ color: C.muted }}>
          7 agents · 4 channels · 48 h · $500 → GO / ITERATE / NO-GO
        </p>
      </div>

      {/* Idea input */}
      {!sprint && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border p-5 space-y-4" style={{ borderColor: C.border, background: C.surface }}>
          <div>
            <p className="font-display font-bold text-[1.0625rem] tracking-[-0.01em]" style={{ color: C.ink }}>Describe your idea</p>
            <p className="text-[0.8125rem] mt-0.5" style={{ color: C.muted }}>One sentence to three paragraphs. Specificity improves Genome signal.</p>
          </div>
          <Textarea value={idea} onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g., AI-powered SOC automation for Series A startups that can't afford a full security team"
            rows={3} disabled={isRunning}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runSprint(); }}
            className="resize-none text-black" style={{ borderColor: C.border, background: C.canvas }} />
          <div className="space-y-2">
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em]" style={{ color: C.muted }}>Active Channels</p>
            <div className="flex gap-2 flex-wrap">
              {ALL_CHANNELS.map((ch) => {
                const active = channels.includes(ch);
                return (
                  <button key={ch} onClick={() => toggleChannel(ch)} disabled={isRunning}
                    className="px-3 py-1.5 rounded-full text-[0.8125rem] font-medium border transition-colors"
                    style={{ borderColor: active ? C.ink : C.border, background: active ? C.ink : C.surface, color: active ? '#fff' : C.muted }}>
                    {CHANNEL_LABELS[ch]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-[0.75rem]" style={{ color: C.muted }}>
              {channels.length === 0
                ? <span style={{ color: C.stop }}>Select at least one channel</span>
                : `${channels.length} channel${channels.length > 1 ? 's' : ''} · $${(500 / channels.length).toFixed(0)}/ch`}
            </p>
            <Button onClick={runSprint} disabled={!idea.trim() || channels.length === 0 || isRunning}
              className="h-9 px-5 rounded-full border-0 text-[0.875rem] font-semibold" style={{ background: C.ink, color: '#fff' }}>
              {isStarting ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Starting…</> : 'Launch Sprint →'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pipeline status */}
      <AnimatePresence>
        {(sprint || isStarting) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.surface }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.border, background: C.faint }}>
              <div>
                <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em]" style={{ color: C.muted }}>Sprint</p>
                <p className="font-mono text-[0.8125rem] font-bold mt-0.5" style={{ color: C.ink }}>{(sprint as SprintRecord & { sprint_id?: string })?.sprint_id ?? '…'}</p>
              </div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] px-2 py-1 rounded"
                style={{
                  color: sprint?.state === 'BLOCKED' ? C.stop : sprint?.state === 'COMPLETE' ? C.go : C.warn,
                  background: sprint?.state === 'BLOCKED' ? `${C.stop}12` : sprint?.state === 'COMPLETE' ? `${C.go}12` : `${C.warn}12`,
                }}>
                {STATE_LABELS[sprint?.state ?? 'IDLE'] ?? sprint?.state ?? 'Starting…'}
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: C.border }}>
              {PIPELINE.map((step) => {
                const status = stepStatuses[step.id];
                return (
                  <div key={step.id} className="flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{ background: status === 'running' ? C.faint : 'transparent' }}>
                    <StepIcon status={status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.875rem] font-medium" style={{ color: status === 'waiting' ? C.muted : C.ink }}>{step.label}</span>
                        {step.parallel && <span className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded" style={{ color: C.muted, background: C.faint, border: `1px solid ${C.border}` }}>parallel</span>}
                        {status === 'running' && <span className="text-[0.6875rem] animate-pulse" style={{ color: C.muted }}>running…</span>}
                        {status === 'skipped' && <span className="text-[0.6875rem]" style={{ color: C.muted }}>awaiting platform launch</span>}
                      </div>
                      <p className="text-[0.75rem]" style={{ color: C.muted }}>{step.sublabel}</p>
                    </div>
                    <span className="text-[0.6875rem] font-mono uppercase"
                      style={{ color: status === 'done' ? C.go : status === 'blocked' ? C.stop : status === 'running' ? C.ink : C.muted }}>
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BLOCKED banner */}
      <AnimatePresence>
        {blockReason && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-4 flex gap-3" style={{ borderColor: `${C.stop}40`, background: `${C.stop}08` }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.stop }} />
            <div className="space-y-1 flex-1">
              <p className="text-[0.8125rem] font-semibold" style={{ color: C.stop }}>Sprint Blocked</p>
              <p className="text-[0.8125rem]" style={{ color: C.ink }}>{blockReason}</p>
              <button onClick={resetSprint} className="text-[0.8125rem] underline underline-offset-2 mt-1" style={{ color: C.muted }}>
                Start over
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Genome result */}
      <AnimatePresence>
        {sprint?.genome && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Signal banner */}
            <div className="rounded-xl border p-5" style={{
              borderColor: sprint.genome.signal === 'GO' ? `${C.go}30` : sprint.genome.signal === 'ITERATE' ? `${C.warn}30` : `${C.stop}30`,
              background: sprint.genome.signal === 'GO' ? `${C.go}08` : sprint.genome.signal === 'ITERATE' ? `${C.warn}08` : `${C.stop}08`,
            }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display font-bold text-[1.5rem] tracking-[-0.03em]"
                    style={{ color: sprint.genome.signal === 'GO' ? C.go : sprint.genome.signal === 'ITERATE' ? C.warn : C.stop }}>
                    {sprint.genome.signal === 'GO' ? 'GO — Proceed to Healthgate' :
                     sprint.genome.signal === 'ITERATE' ? 'ITERATE — Proceed with caution' : 'STOP — Do not spend'}
                  </p>
                  <p className="text-[0.875rem] mt-1.5 max-w-lg" style={{ color: C.muted }}>
                    {sprint.genome.proceed_note ?? sprint.genome.pivot_brief ?? ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-[2.25rem] leading-none"
                    style={{ color: sprint.genome.signal === 'GO' ? C.go : sprint.genome.signal === 'ITERATE' ? C.warn : C.stop }}>
                    {sprint.genome.composite}
                  </p>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] mt-1" style={{ color: C.muted }}>composite</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: `${C.border}80` }}>
                <CompositeBar scores={sprint.genome.scores} />
              </div>
            </div>

            {/* ICP + signals */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'ICP', value: sprint.genome.icp },
                { label: 'Market Category', value: sprint.genome.market_category },
                { label: 'Unique Mechanism', value: sprint.genome.unique_mechanism },
                { label: 'Data Source', value: sprint.genome.data_source === 'real' ? '⬤ Live — Google + Meta' : '◯ LLM estimate' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border p-3" style={{ borderColor: C.border, background: C.surface }}>
                  <p className="text-[0.625rem] font-medium uppercase tracking-[0.06em] mb-1" style={{ color: C.muted }}>{label}</p>
                  <p className="text-[0.8125rem] leading-snug" style={{ color: C.ink }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Risks */}
            {sprint.genome.risks.length > 0 && (
              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: C.border, background: C.surface }}>
                <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em]" style={{ color: C.muted }}>Cited Risks</p>
                {sprint.genome.risks.map((r, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[0.5rem] font-bold shrink-0 mt-0.5" style={{ borderColor: C.warn, color: C.warn }}>{i + 1}</span>
                    <p className="text-[0.8125rem] leading-snug" style={{ color: C.ink }}>{r}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Healthgate */}
      <AnimatePresence>
        {sprint?.healthgate && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] px-1" style={{ color: C.muted }}>
              Healthgate — Per-Channel Account Health
            </p>
            <HealthgateGrid healthgate={sprint.healthgate as Record<Platform, HealthgateAgentOutput>} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Angles */}
      <AnimatePresence>
        {sprint?.angles && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] px-1" style={{ color: C.muted }}>AngleAgent — 3 Archetypes · 4 Channels</p>
            <p className="text-[0.8125rem] px-1" style={{ color: C.ink }}><strong>ICP:</strong> {(sprint.angles as NonNullable<SprintRecord['angles']>).icp}</p>
            <div className="space-y-3">
              {(sprint.angles as NonNullable<SprintRecord['angles']>).angles.map((a, i) => (
                <AngleCard key={a.id} angle={a} idx={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
