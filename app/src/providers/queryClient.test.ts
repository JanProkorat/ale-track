// The QueryClient's two staleness rules. Both are config, and config that regresses
// fails silently — the screen just keeps showing old numbers — so each is pinned here.

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { qk } from 'src/api/queryKeys';
import { createQueryClient } from './queryClient';

/** Runs one mutation to completion through the client, the way a hook would. */
async function mutate(client: QueryClient, fn: () => Promise<unknown> = () => Promise.resolve('ok')) {
  const observer = client.getMutationCache().build(client, { mutationFn: fn });
  await observer.execute(undefined).catch(() => undefined);
}

describe('the app QueryClient', () => {
  /**
   * Reported: creating an order, client or shipment left the sidebar badge on its old
   * number until a reload. The counts are one aggregate keyed `['reports']`, and the
   * Sidebar mounts once and never unmounts, so nothing could ever refetch it — no
   * mutation invalidated that key. Now any successful write does.
   */
  it('refreshes the module counts after a successful mutation', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await mutate(client);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.reports });
  });

  it('leaves the counts alone when a mutation fails', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await mutate(client, () => Promise.reject(new Error('400')));

    // A write the server refused moved no counts, and a refetch would only cost a request
    // and repaint the same numbers.
    expect(invalidate).not.toHaveBeenCalled();
  });

  /**
   * The other half of the same report: a product added in another tab stayed invisible in
   * an already-open editor. Nothing refetches a mounted query otherwise — the editors do
   * not remount, and `staleTime` alone never triggers a fetch.
   */
  it('refetches stale queries when the window is focused again', () => {
    const defaults = createQueryClient().getDefaultOptions().queries;

    expect(defaults?.refetchOnWindowFocus).toBe(true);
    // Kept, so tab-flipping inside half a minute still costs nothing: a focus refetch
    // fires only for queries that have gone stale.
    expect(defaults?.staleTime).toBe(30_000);
  });
});
