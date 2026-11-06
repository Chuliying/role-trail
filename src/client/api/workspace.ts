import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTransport } from '../../../web/transport.mjs';
import { deriveSnapshot } from '../../../web/snapshot.mjs';
import type { Action, Workspace } from '../types';
import { queryKeys } from './client';

interface Snapshot {
  state: Workspace;
  staleResumes: Set<string>;
}
type Request = (
  path: string,
  data?: unknown,
  options?: { signal?: AbortSignal },
) => Promise<unknown>;

export function useWorkspaceData() {
  const client = useQueryClient();
  const [unauthorized, setUnauthorized] = useState(false);
  const request = useRef<Request | null>(null);
  const current = () => client.getQueryData<Snapshot>(queryKeys.workspace);
  if (!request.current)
    request.current = createTransport({
      getState: () => current()?.state,
      onUnauthorized: () => setUnauthorized(true),
    }) as Request;

  // Check both sides of asynchronous hashing and again when the cache commits.
  // A late GET or mutation response must not replace a newer successful write.
  async function derive(next: Workspace): Promise<Snapshot> {
    let saved = current();
    if (saved && saved.state.revision > next.revision) return saved;
    const snapshot = (await deriveSnapshot(next)) as Snapshot;
    saved = current();
    return saved && saved.state.revision > next.revision ? saved : snapshot;
  }
  function newer(oldValue: unknown, newValue: unknown) {
    const old = oldValue as Snapshot | undefined,
      next = newValue as Snapshot;
    return old && old.state.revision > next.state.revision ? old : next;
  }
  const queryOptions = {
    queryKey: queryKeys.workspace,
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
      derive((await request.current!('state', undefined, { signal })) as Workspace),
    structuralSharing: newer,
    staleTime: 0,
    retry: false as const,
  };
  const query = useQuery(queryOptions);
  async function commit(next: Workspace) {
    const snapshot = await derive(next);
    client.setQueryData<Snapshot>(queryKeys.workspace, (old) => newer(old, snapshot) as Snapshot);
    setUnauthorized(false);
  }
  const action = useMutation({
    mutationKey: ['workspace', 'action'],
    retry: false,
    mutationFn: async (payload: Action) =>
      (await request.current!('action', {
        revision: current()?.state.revision,
        action: payload,
      })) as Workspace,
    onSuccess: commit,
  });
  const collect = useMutation({
    mutationKey: ['workspace', 'collect'],
    retry: false,
    mutationFn: async () =>
      (await request.current!('collect', { revision: current()?.state.revision })) as Workspace,
    onSuccess: commit,
  });
  const login = useMutation({
    mutationKey: ['session', 'login'],
    retry: false,
    gcTime: 0,
    mutationFn: (key: string) => request.current!('login', { key }),
    onSuccess: async () => {
      await query.refetch({ throwOnError: true });
      setUnauthorized(false);
    },
    // Release the access-key mutation variables after either outcome. Pending
    // remains active until the authenticated workspace read has completed.
    onSettled: (): void => {
      login.reset();
    },
  });
  const logout = useMutation({
    mutationKey: ['session', 'logout'],
    retry: false,
    mutationFn: () => request.current!('logout', {}),
    onSuccess: () => client.clear(),
  });
  const restore = useMutation({
    mutationKey: ['workspace', 'restore'],
    retry: false,
    mutationFn: async (state: unknown) =>
      (await request.current!('restore', {
        revision: current()?.state.revision,
        state,
      })) as Workspace,
    onSuccess: commit,
  });
  return {
    query,
    action,
    collect,
    login,
    logout,
    restore,
    unauthorized,
    pending:
      action.isPending ||
      collect.isPending ||
      login.isPending ||
      logout.isPending ||
      restore.isPending,
    snapshot: query.data,
    refresh: () => query.refetch({ throwOnError: true }),
    currentState: () => current()?.state,
  };
}
