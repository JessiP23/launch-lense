// Seed demo data for LaunchLense intelligence features
// Run with: npx tsx scripts/seed-demo-data.ts

import { createClient } from '@supabase/supabase-js';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

const VERTICALS = ['fintech', 'health', 'saas', 'ecommerce', 'marketplace', 'edtech'];
const VERDICTS = ['GO', 'NO-GO', 'ITERATE'];
const GENOME_SIGNALS = ['GO', 'ITERATE', 'STOP'];
const ANGLE_ARCHETYPES = ['PAIN', 'ASPIRATION', 'SOCIAL_PROOF', 'CURIOSITY', 'AUTHORITY'];
const CHANNELS = ['meta', 'google', 'tiktok', 'linkedin'];

const IDEAS = [
  'AI-powered personal finance assistant for millennials',
  'Telehealth platform for chronic disease management',
  'No-code workflow automation tool for SMBs',
  'Sustainable fashion marketplace for Gen Z',
  'Skill-sharing platform for remote workers',
  'B2B procurement automation for manufacturing',
  'Crypto tax reporting software for traders',
  'Mental health app with AI therapy chatbot',
  'Project management tool for creative agencies',
  'Vertical marketplace for handmade goods',
  'Online learning platform for tech skills',
  'Inventory management for e-commerce sellers',
  'Peer-to-peer lending for small businesses',
  'Corporate wellness platform with gamification',
  'Social commerce app for beauty products',
  'HR analytics platform for remote teams',
  'Supply chain visibility tool for retailers',
  'Subscription box for organic snacks',
  'Freelance marketplace for developers',
  'Customer support automation for SaaS',
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateGenome() {
  const signal = randomChoice(GENOME_SIGNALS);
  return {
    signal,
    composite_score: randomInt(40, 95),
    meta_ad_count: randomInt(50, 500),
    scores: {
      demand: randomInt(30, 90),
      competition: randomInt(20, 80),
      icp: randomInt(40, 95),
      timing: randomInt(35, 85),
      moat: randomInt(25, 75),
    },
  };
}

function generateCampaign() {
  const angleMetrics = {
    blended_ctr: randomInt(8, 35) / 1000,
    blended_cpc_cents: randomInt(50, 300),
    angle_A: { ctr: randomInt(8, 35) / 1000, cpc_cents: randomInt(50, 300) },
    angle_B: { ctr: randomInt(8, 35) / 1000, cpc_cents: randomInt(50, 300) },
    angle_C: { ctr: randomInt(8, 35) / 1000, cpc_cents: randomInt(50, 300) },
  };
  return { angle_metrics: angleMetrics };
}

function generateVerdict(genomeSignal: string) {
  const verdict = randomChoice(VERDICTS);
  return {
    aggregate_verdict: verdict,
    confidence: randomInt(60, 95),
    reasoning: 'Demo verdict for testing',
  };
}

function generateAngles() {
  return {
    angle_A: {
      archetype: randomChoice(ANGLE_ARCHETYPES),
      headline: 'Transform your workflow with AI automation',
    },
    angle_B: {
      archetype: randomChoice(ANGLE_ARCHETYPES),
      headline: 'Join 10,000+ teams already using our platform',
    },
    angle_C: {
      archetype: randomChoice(ANGLE_ARCHETYPES),
      headline: 'The secret tool top performers use daily',
    },
  };
}

async function seedDemoData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Seeding 40 demo sprints...');

  const sprints = [];
  for (let i = 0; i < 40; i++) {
    const idea = IDEAS[i % IDEAS.length];
    const genome = generateGenome();
    const campaign = generateCampaign();
    const verdict = generateVerdict(genome.signal);
    const angles = generateAngles();

    const created_at = new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('sprints')
      .insert({
        org_id: DEV_ORG_ID,
        idea,
        state: 'COMPLETE',
        genome,
        campaign,
        verdict,
        angles,
        active_channels: CHANNELS.slice(0, randomInt(1, 4)),
        budget_cents: randomInt(50000, 200000),
        created_at,
        updated_at: created_at,
        is_demo: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting sprint:', error);
      continue;
    }

    sprints.push(data);
    console.log(`Created sprint ${i + 1}/40: ${idea.slice(0, 40)}...`);
  }

  // Seed sprint_angle_results
  console.log('Seeding sprint_angle_results...');
  for (const sprint of sprints) {
    for (const angleId of ['angle_A', 'angle_B', 'angle_C']) {
      for (const channel of CHANNELS.slice(0, randomInt(1, 4))) {
        const ctr = randomInt(8, 35) / 1000;
        const cpc_cents = randomInt(50, 300);
        const spend_cents = randomInt(5000, 50000);

        const { error } = await supabase.from('sprint_angle_results').insert({
          sprint_id: sprint.id,
          angle_id: angleId,
          channel,
          impressions: randomInt(1000, 10000),
          clicks: Math.floor(randomInt(1000, 10000) * ctr),
          ctr,
          cpc_cents,
          spend_cents,
          lp_views: randomInt(50, 500),
          lp_cta_clicks: randomInt(20, 200),
          lp_form_submits: randomInt(5, 50),
          lp_email_captures: randomInt(10, 100),
        });

        if (error) {
          console.error('Error inserting angle result:', error);
        }
      }
    }
  }

  console.log('Demo data seeding complete!');
  console.log(`Created ${sprints.length} sprints with angle results.`);
}

seedDemoData().catch(console.error);
