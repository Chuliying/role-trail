import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './client';
import type { ResearchBundle } from '../types';
import { t } from '../domain';

export function useResearch(runId: string, archiveHash?: string) {
  return useQuery({
    queryKey: queryKeys.research(runId, archiveHash),
    queryFn: async ({ signal }): Promise<ResearchBundle> => {
      const response = await fetch('/api/research?run=' + encodeURIComponent(runId), { signal });
      const value = await response.json();
      if (!response.ok) throw Error(value.error || t('Could not load research.'));
      if (!value.run || !Array.isArray(value.run.coverage) || !Array.isArray(value.jobs))
        throw Error(t('Saved research archive is invalid'));
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}
