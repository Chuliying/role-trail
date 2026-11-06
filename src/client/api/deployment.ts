import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './client';
import { t } from '../domain';

export function useDeploymentVersion() {
  const client = useQueryClient();
  return () =>
    client.fetchQuery({
      queryKey: queryKeys.deployment,
      staleTime: 0,
      retry: false,
      queryFn: async ({ signal }) => {
        const response = await fetch('/', { cache: 'no-store', signal });
        if (!response.ok) throw Error(t('Could not refresh workspace.'));
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        return html.querySelector('script[src^="/app.js"]')?.getAttribute('src');
      },
    });
}
