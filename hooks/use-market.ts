'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useMarket(orgId: string | null) {
  const params = orgId ? `?org_id=${orgId}` : '';
  const { data, error, isLoading } = useSWR(
    `/api/market${params}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    sprints: data?.sprints ?? [],
    angleResults: data?.angleResults ?? [],
    isLoading,
    error,
  };
}
