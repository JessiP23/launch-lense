// ─────────────────────────────────────────────────────────────────────────────
// Seed Signal Fabric with realistic benchmark data
// Run with: npx tsx scripts/seed-signal-fabric.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '../lib/supabase';

const VERTICALS = ['saas', 'fintech', 'health', 'ecommerce', 'consumer', 'b2b', 'other'] as const;
const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;

// Realistic CTR ranges by vertical (as decimal, e.g., 0.012 = 1.2%)
const REALISTIC_CTR_RANGES: Record<string, { min: number; max: number }> = {
  saas: { min: 0.008, max: 0.018 },      // 0.8% - 1.8%
  fintech: { min: 0.006, max: 0.015 },    // 0.6% - 1.5%
  health: { min: 0.005, max: 0.012 },     // 0.5% - 1.2%
  ecommerce: { min: 0.010, max: 0.025 },  // 1.0% - 2.5%
  consumer: { min: 0.008, max: 0.020 },   // 0.8% - 2.0%
  b2b: { min: 0.007, max: 0.016 },       // 0.7% - 1.6%
  other: { min: 0.006, max: 0.015 },     // 0.6% - 1.5%
};

// Channel multipliers (relative to baseline)
const CHANNEL_MULTIPLIERS: Record<string, number> = {
  meta: 1.0,      // Baseline
  google: 0.85,   // Google typically has lower CTR
  linkedin: 0.7,  // LinkedIn B2B focus, lower CTR but higher quality
  tiktok: 1.3,    // TikTok can have higher CTR for consumer
};

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function formatNumber(num: number, decimals: number): number {
  return Number(num.toFixed(decimals));
}

async function seedBenchmarks() {
  const db = createServiceClient();
  
  console.log('🌱 Seeding Signal Fabric with realistic benchmark data...');
  
  for (const vertical of VERTICALS) {
    const ctrRange = REALISTIC_CTR_RANGES[vertical] || REALISTIC_CTR_RANGES.other;
    
    for (const channel of CHANNELS) {
      // Calculate realistic CTR based on vertical range and channel multiplier
      const baseCtr = randomInRange(ctrRange.min, ctrRange.max);
      const multiplier = CHANNEL_MULTIPLIERS[channel];
      const ctr = baseCtr * multiplier;
      
      // Calculate other metrics based on CTR
      const cpc = randomInRange(50, 200); // $0.50 - $2.00 per click
      const cvr = randomInRange(0.02, 0.08); // 2% - 8% conversion rate
      const cpa = ctr > 0 ? (cpc / cvr) : null; // Cost per acquisition
      
      const sampleSize = Math.floor(randomInRange(5, 50)); // 5-50 sprints
      
      const { error } = await db.from('signal_benchmarks').insert({
        vertical,
        channel,
        avg_ctr: formatNumber(ctr, 4),
        avg_cpc: formatNumber(cpc, 2),
        avg_cvr: formatNumber(cvr, 4),
        avg_cpa: cpa !== null ? formatNumber(cpa, 2) : null,
        sample_size: sampleSize,
        last_updated: new Date().toISOString(),
      });
      
      if (error) {
        console.error(`❌ Failed to insert benchmark for ${vertical}/${channel}:`, error.message);
      } else {
        console.log(`✅ Inserted benchmark for ${vertical}/${channel}: CTR=${(ctr * 100).toFixed(2)}%, n=${sampleSize}`);
      }
    }
  }
  
  console.log('🎉 Benchmark seeding complete!');
}

async function seedSprintSignals() {
  const db = createServiceClient();
  
  console.log('🌱 Seeding sprint signals...');
  
  // Generate 20-30 realistic sprint signals
  const signalCount = Math.floor(randomInRange(20, 30));
  
  for (let i = 0; i < signalCount; i++) {
    const vertical = VERTICALS[Math.floor(Math.random() * VERTICALS.length)];
    const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
    const verdicts: Array<'GO' | 'ITERATE' | 'NO-GO'> = ['GO', 'ITERATE', 'NO-GO'];
    const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];
    
    const ctrRange = REALISTIC_CTR_RANGES[vertical] || REALISTIC_CTR_RANGES.other;
    const multiplier = CHANNEL_MULTIPLIERS[channel];
    const baseCtr = randomInRange(ctrRange.min, ctrRange.max);
    const ctr = baseCtr * multiplier * randomInRange(0.7, 1.3); // Add some variance
    
    const cpc = randomInRange(50, 200);
    const cvr = randomInRange(0.02, 0.08);
    const cpa = ctr > 0 ? (cpc / cvr) : null;
    
    const archetypes: Array<'PAIN' | 'ASPIRATION' | 'SOCIAL_PROOF' | 'CURIOSITY' | 'AUTHORITY'> = 
      ['PAIN', 'ASPIRATION', 'SOCIAL_PROOF', 'CURIOSITY', 'AUTHORITY'];
    const angleArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    
    // Generate a random sprint ID
    const sprintId = crypto.randomUUID();
    
    // Random date within the last 30 days
    const daysAgo = Math.floor(randomInRange(0, 30));
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    
    const { error } = await db.from('sprint_signals').insert({
      sprint_id: sprintId,
      vertical,
      channel,
      ctr: formatNumber(ctr, 4),
      cpc: formatNumber(cpc, 2),
      cvr: formatNumber(cvr, 4),
      cpa: cpa !== null ? formatNumber(cpa, 2) : null,
      verdict,
      angle_archetype: angleArchetype,
      created_at: createdAt,
    });
    
    if (error) {
      console.error(`❌ Failed to insert sprint signal ${i + 1}:`, error.message);
    } else {
      console.log(`✅ Inserted sprint signal ${i + 1}/${signalCount}: ${vertical}/${channel}, verdict=${verdict}`);
    }
  }
  
  console.log('🎉 Sprint signal seeding complete!');
}

async function main() {
  try {
    await seedBenchmarks();
    await seedSprintSignals();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
