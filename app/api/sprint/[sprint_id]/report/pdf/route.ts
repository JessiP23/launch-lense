import { getSprint } from '@/lib/sprint-machine';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;

  try {
    const sprint = await getSprint(sprint_id);
    if (!sprint) {
      return Response.json({ error: 'Sprint not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (sprint.state !== 'COMPLETE') {
      return Response.json({ error: 'Sprint must be COMPLETE to generate PDF report', code: 'INVALID_STATE' }, { status: 400 });
    }

    if (!sprint.verdict) {
      return Response.json({ error: 'No verdict data available', code: 'NO_VERDICT' }, { status: 400 });
    }

    // Generate a simple text-based report for now
    // In production, this would use a PDF library like jsPDF or react-pdf
    const report = generateTextReport(sprint);

    // Return as text/plain for now (can be converted to PDF later)
    return new Response(report, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="verdict-${sprint_id}.txt"`,
      },
    });
  } catch (error) {
    console.error('[sprint/report/pdf]', error);
    return Response.json({ error: 'Failed to generate PDF report', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

function generateTextReport(sprint: any): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('LAUNCHLENSE VERDICT REPORT');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Sprint ID: ${sprint.sprint_id}`);
  lines.push(`Idea: ${sprint.idea}`);
  lines.push(`State: ${sprint.state}`);
  lines.push(`Created: ${sprint.created_at}`);
  lines.push(`Completed: ${sprint.updated_at}`);
  lines.push('');

  // Genome Section
  lines.push('-'.repeat(80));
  lines.push('GENOME ANALYSIS');
  lines.push('-'.repeat(80));
  if (sprint.genome) {
    lines.push(`Composite Score: ${sprint.genome.composite}/100`);
    lines.push(`Signal: ${sprint.genome.signal}`);
    lines.push(`Market Category: ${sprint.genome.market_category}`);
    lines.push(`ICP: ${sprint.genome.icp}`);
    lines.push(`Problem Statement: ${sprint.genome.problem_statement}`);
    lines.push(`Solution Wedge: ${sprint.genome.solution_wedge}`);
    lines.push('');
    lines.push('Scores:');
    lines.push(`  Demand: ${sprint.genome.scores.demand}/100`);
    lines.push(`  Competition: ${sprint.genome.scores.competition}/100`);
    lines.push(`  ICP: ${sprint.genome.scores.icp}/100`);
    lines.push(`  Timing: ${sprint.genome.scores.timing}/100`);
    lines.push(`  Moat: ${sprint.genome.scores.moat}/100`);
    lines.push('');
    if (sprint.genome.risks && sprint.genome.risks.length > 0) {
      lines.push('Risks:');
      sprint.genome.risks.forEach((risk: string, i: number) => {
        lines.push(`  ${i + 1}. ${risk}`);
      });
    }
  }
  lines.push('');

  // Verdict Section
  lines.push('-'.repeat(80));
  lines.push('VERDICT');
  lines.push('-'.repeat(80));
  if (sprint.verdict) {
    lines.push(`Final Verdict: ${sprint.verdict.verdict}`);
    lines.push(`Reasoning: ${sprint.verdict.reasoning}`);
    lines.push('');
    if (sprint.verdict.demand_validation) {
      lines.push('Demand Validation:');
      lines.push(`  Market Signal Strength: ${sprint.verdict.demand_validation.market_signal_strength}`);
      lines.push(`  CTR Performance: ${sprint.verdict.demand_validation.ctr_performance}`);
      lines.push(`  CPC Efficiency: ${sprint.verdict.demand_validation.cpc_efficiency}`);
    }
    lines.push('');
    if (sprint.verdict.recommendation) {
      lines.push('Recommendation:');
      lines.push(`  ${sprint.verdict.recommendation}`);
    }
  }
  lines.push('');

  // Campaign Performance
  lines.push('-'.repeat(80));
  lines.push('CAMPAIGN PERFORMANCE');
  lines.push('-'.repeat(80));
  if (sprint.campaign) {
    for (const [channel, data] of Object.entries(sprint.campaign) as [string, any][]) {
      lines.push(`Channel: ${channel.toUpperCase()}`);
      lines.push(`  Status: ${data.status}`);
      lines.push(`  Campaign ID: ${data.campaign_id || 'N/A'}`);
      if (data.angle_metrics && data.angle_metrics.length > 0) {
        lines.push('  Angle Metrics:');
        data.angle_metrics.forEach((metric: any) => {
          lines.push(`    ${metric.id}:`);
          lines.push(`      Impressions: ${metric.impressions}`);
          lines.push(`      Clicks: ${metric.clicks}`);
          lines.push(`      CTR: ${(metric.ctr * 100).toFixed(2)}%`);
          lines.push(`      CPC: $${(metric.cpc_cents / 100).toFixed(2)}`);
          lines.push(`      Spend: $${(metric.spend_cents / 100).toFixed(2)}`);
        });
      }
      lines.push('');
    }
  }

  // ICP Discovery (if available)
  if (sprint.icp_discovery) {
    lines.push('-'.repeat(80));
    lines.push('ICP DISCOVERY');
    lines.push('-'.repeat(80));
    if (sprint.icp_discovery.segments && sprint.icp_discovery.segments.length > 0) {
      sprint.icp_discovery.segments.forEach((segment: any, i: number) => {
        lines.push(`Segment ${i + 1}: ${segment.segment_name}`);
        lines.push(`  Why They Fit: ${segment.why_they_fit}`);
        lines.push(`  Where to Find Them: ${segment.where_to_find_them}`);
        lines.push(`  Estimated Size: ${segment.estimated_segment_size}`);
        lines.push(`  Outreach Angle: ${segment.outreach_angle}`);
        lines.push(`  Urgency Signal: ${segment.urgency_signal}`);
        lines.push('');
      });
    }
  }

  // GTM Package (if available)
  if (sprint.gtm_package) {
    lines.push('-'.repeat(80));
    lines.push('GTM PACKAGE');
    lines.push('-'.repeat(80));
    if (sprint.gtm_package.channels) {
      lines.push('Recommended Channels:');
      sprint.gtm_package.channels.forEach((channel: any) => {
        lines.push(`  ${channel.name}: ${channel.rationale}`);
      });
    }
    lines.push('');
    if (sprint.gtm_package.messaging) {
      lines.push('Messaging Framework:');
      lines.push(`  Value Proposition: ${sprint.gtm_package.messaging.value_proposition}`);
      lines.push(`  Key Differentiators: ${sprint.gtm_package.messaging.key_differentiators.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('='.repeat(80));
  lines.push('END OF REPORT');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
