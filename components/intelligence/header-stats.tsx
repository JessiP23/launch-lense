'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { MetricCard } from '@/components/ui/metric-card';
import { Skeleton } from '@/components/ui/skeleton';

export function HeaderStats({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const totalSprints = sprints.length;
  const totalIdeas = sprints.length;
  const noGoCount = sprints.filter(
    (s: any) => s.verdict?.aggregate_verdict === 'NO-GO'
  ).length;
  const capitalPreserved = noGoCount * 150000;

  // Calculate Genome accuracy
  let matches = 0;
  let totalWithGenome = 0;
  sprints.forEach((sprint: any) => {
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    if (genomeSignal && verdict) {
      totalWithGenome++;
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      if (mappedSignal === verdict) matches++;
    }
  });
  const accuracy = totalWithGenome > 0 ? (matches / totalWithGenome) * 100 : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Sprints"
        value={totalSprints.toString()}
      />
      <MetricCard
        label="Ideas Validated"
        value={totalIdeas.toString()}
      />
      <MetricCard
        label="Capital Preserved"
        value={`$${(capitalPreserved / 1000).toFixed(0)}K`}
      />
      <MetricCard
        label="Genome Accuracy"
        value={`${accuracy.toFixed(1)}%`}
      />
    </div>
  );
}
