// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — real sprint launcher (tsx CLI)
//
// Calls the production launchManagedMetaCampaign() against a real sprint row
// in your Supabase DB. Use this to validate the full managed-Meta path end-
// to-end without going through the HTTP route (which requires Clerk auth).
//
// Usage:
//   npx tsx --env-file=.env scripts/launch-sprint.ts --sprint=<uuid>
//   npx tsx --env-file=.env scripts/launch-sprint.ts --sprint=<uuid> --dry-run
//
// Flags:
//   --sprint=<uuid>     Required. The sprint to launch.
//   --dry-run           Print the plan; do not call Meta.
//   --budget=<cents>    Override sprint.budget_cents (default: from row).
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { launchManagedMetaCampaign, perAngleDailyBudgetCents } from '@/lib/meta/create-campaign';
import type { AngleAgentOutput, LandingAgentOutput } from '@/lib/agents/types';

const argv = process.argv.slice(2);
const sprintArg = argv.find((a) => a.startsWith('--sprint='));
const budgetArg = argv.find((a) => a.startsWith('--budget='));
const DRY_RUN = argv.includes('--dry-run');
const SPRINT_ID = sprintArg?.split('=')[1];
const BUDGET_OVERRIDE = budgetArg ? Number(budgetArg.split('=')[1]) : null;

const c = (code: number, s: string) => `\x1b[${code}m${s}\x1b[0m`;
const ok = (s: string) => console.log(c(32, '✓'), s);
const warn = (s: string) => console.log(c(33, '!'), s);
const fail = (s: string) => console.log(c(31, '✗'), s);
const head = (s: string) => console.log('\n' + c(36, `── ${s} ──`));

async function main() {
  if (!SPRINT_ID) {
    fail('Missing --sprint=<uuid>');
    process.exit(1);
  }

  console.log(c(35, '\nLaunchLense — real sprint launcher'));
  console.log(c(90, `Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`));
  console.log(c(90, `Sprint: ${SPRINT_ID}`));

  // ── Load sprint ──────────────────────────────────────────────────────
  head('1. Loading sprint');
  const db = createServiceClient();
  const { data: sprint, error } = await db
    .from('sprints')
    .select('id, idea, state, angles, landing, budget_cents, active_channels')
    .eq('id', SPRINT_ID)
    .maybeSingle();
  if (error || !sprint) {
    fail(`Sprint not found: ${error?.message ?? 'no rows'}`);
    process.exit(1);
  }
  ok(`Idea:    ${(sprint.idea as string).slice(0, 80)}`);
  ok(`State:   ${sprint.state}`);
  ok(`Budget:  $${((sprint.budget_cents as number) / 100).toFixed(2)}`);
  ok(`Channels: ${(sprint.active_channels as string[] | null)?.join(', ') ?? '(none)'}`);

  const angles = sprint.angles as AngleAgentOutput | null;
  const landing = sprint.landing as LandingAgentOutput | null;
  if (!angles?.angles?.length) {
    fail('Sprint has no angles. Run AnglesAgent first.');
    process.exit(1);
  }
  ok(`Angles:  ${angles.angles.map((a) => a.id).join(', ')}`);
  if (!landing?.pages?.length) {
    warn('No landing pages found — campaigns will use fallback /lp/<sprint> URLs.');
  } else {
    ok(`Landing: ${landing.pages.map((p) => p.angle_id).join(', ')}`);
  }

  const totalBudget = BUDGET_OVERRIDE ?? (sprint.budget_cents as number);
  const dailyPerAngle = perAngleDailyBudgetCents(totalBudget, angles.angles.length);
  ok(`Pacing:  $${(dailyPerAngle / 100).toFixed(2)}/day × ${angles.angles.length} angles × 3 days = $${((dailyPerAngle * angles.angles.length * 3) / 100).toFixed(2)}`);

  if (DRY_RUN) {
    head('2. Dry-run plan');
    for (const a of angles.angles) {
      console.log(`  • ${a.id} — ${a.archetype}`);
      console.log(c(90, `    headline: "${a.copy.meta.headline}"`));
      console.log(c(90, `    body:     "${a.copy.meta.body.slice(0, 80)}…"`));
    }
    console.log(c(90, '\nRe-run without --dry-run to actually launch.'));
    return;
  }

  // ── Launch ───────────────────────────────────────────────────────────
  head('2. Calling launchManagedMetaCampaign()');
  try {
    const result = await launchManagedMetaCampaign({
      sprintId: SPRINT_ID,
      idea: sprint.idea as string,
      angles,
      landing,
      totalBudgetCents: totalBudget,
    });

    if (result.reused) {
      warn(`Reused existing campaign for this sprint: ${result.campaignId}`);
    } else {
      ok(`Campaign created: ${result.campaignId}`);
    }
    ok(`Daily budget per angle: $${(result.dailyBudgetCents / 100).toFixed(2)}`);
    ok(`AdSets: ${Object.entries(result.adsetMap).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    ok(`Ads:    ${Object.entries(result.adMap).map(([k, v]) => `${k}=${v}`).join(', ')}`);

    console.log('\n' + c(32, 'SUCCESS — sprint is live on Meta.'));
    console.log(c(90, 'Inspect in Ads Manager: https://business.facebook.com/adsmanager/manage/campaigns'));
    console.log(c(90, `View locally: http://localhost:3000/sprints/${SPRINT_ID}`));
  } catch (e) {
    fail(`Launch failed: ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof Error && e.stack) console.log(c(90, e.stack));
    process.exit(1);
  }
}

main().catch((e) => {
  fail(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
