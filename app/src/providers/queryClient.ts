import { MutationCache, QueryClient } from '@tanstack/react-query';
import { qk } from 'src/api/queryKeys';

/**
 * The app's QueryClient, and the two rules that decide when the screen catches up with
 * the server.
 *
 * **Any successful write refreshes the sidebar's counts.** Every module's badge comes from
 * one aggregate (`useModuleCounts`, keyed `['reports']`) that the Sidebar mounts once and
 * never unmounts — so without an invalidation it could not update for the rest of the
 * session, and creating an order left its badge on yesterday's number until a reload.
 * Doing it here rather than in each mutation's `onSuccess` is deliberate: nearly every
 * write moves some module's count, the list of them keeps growing, and a missed one fails
 * silently — the badge is simply wrong.
 *
 * **Stale data is refetched when the window comes back.** This is TanStack's own default,
 * off here until now, and turning it off is what left an open editor showing a catalog
 * from before the product you just added in the next tab. `staleTime` still applies, so
 * flipping between tabs inside 30s costs no requests; every editor that seeds local state
 * from a query guards it behind a load-once ref, so a refetch cannot overwrite edits in
 * progress.
 *
 * Its own module so `QueryProvider.tsx` exports nothing but its component — a file that
 * exports both trips react-refresh, and CI holds the lint warning count.
 */
export function createQueryClient(): QueryClient {
  const mutationCache = new MutationCache({
    // `client` is assigned before any mutation can settle, so the late read is safe.
    onSuccess: () => { void client.invalidateQueries({ queryKey: qk.reports }); },
  });

  const client = new QueryClient({
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });

  return client;
}
