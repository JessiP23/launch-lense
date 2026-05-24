'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useIntelligence(orgId: string | null) {
  const params = orgId ? `?org_id=${orgId}` : '';
  const { data, error, isLoading } = useSWR(
    `/api/intelligence${params}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    sprints: data?.sprints ?? [],
    hasAccess: data?.hasAccess ?? true,
    isLoading,
    error,
  };
}
