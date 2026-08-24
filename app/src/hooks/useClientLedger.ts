// A client's ledger of deviations: what happened differently from the plan, and what is still
// open about it. Same shape as the other per-client resources (notes, reminders, prices).
//
// The `state` argument is the distinction the whole feature turns on. 'all' answers "what
// happened", which the inline diffs and the profile's history read; 'open' answers "what still
// has to be done", which the order editor's preview and the client card read. Using 'open' to
// display a handover would put the plan back on screen the moment somebody settled the entry.

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import {
  ClientLedgerQueryState,
  type ClientLedgerEntryDto,
  type SaveClientLedgerEntriesDto,
  type SetClientLedgerEntryResolutionDto,
  type UpdateClientLedgerEntryDto,
} from 'src/generated/api-client';

export type LedgerState = 'open' | 'all';

const WIRE_STATE: Record<LedgerState, ClientLedgerQueryState> = {
  open: ClientLedgerQueryState.Open,
  all: ClientLedgerQueryState.All,
};

export function useClientLedger(clientId: string | undefined, state: LedgerState = 'all') {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.clientLedger(clientId ?? '', state),
    queryFn: ({ signal }) => ds.getClientLedgerEntriesEndpoint(clientId!, WIRE_STATE[state], signal),
    enabled: Boolean(clientId),
  });
}

/**
 * Several clients' ledgers at once, keyed by client id.
 *
 * A run calls on many clients, so the shipment detail cannot call {@link useClientLedger} per
 * stop — the same reason useSuppliersMany exists. Shares the cache with the single-client hook,
 * and returns a fresh Map per render.
 */
export function useClientLedgersMany(clientIds: string[], state: LedgerState = 'all') {
  const ds = useDataSource();
  const results = useQueries({
    queries: clientIds.map((id) => ({
      queryKey: qk.clientLedger(id, state),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        ds.getClientLedgerEntriesEndpoint(id, WIRE_STATE[state], signal),
    })),
  });

  const byClient = new Map<string, ClientLedgerEntryDto[]>();
  const loading = new Set<string>();
  clientIds.forEach((id, i) => {
    const r = results[i];
    if (r?.data) byClient.set(id, r.data);
    if (r?.isLoading) loading.add(id);
  });

  return { byClient, loading };
}

/**
 * Invalidates both states of a client's ledger, plus the orders and shipments that render it.
 *
 * A recorded deviation changes what an order detail and a run's unload list show, so leaving
 * those caches alone would have the deviation appear on the profile and nowhere else.
 */
function invalidateLedger(qc: ReturnType<typeof useQueryClient>, clientId: string) {
  qc.invalidateQueries({ queryKey: qk.clientLedger(clientId, 'open') });
  qc.invalidateQueries({ queryKey: qk.clientLedger(clientId, 'all') });
  qc.invalidateQueries({ queryKey: qk.clients.detail(clientId) });
  qc.invalidateQueries({ queryKey: qk.orders.all });
  qc.invalidateQueries({ queryKey: qk.shipments.all });
}

export function useSaveClientLedgerEntries() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: SaveClientLedgerEntriesDto }) =>
      ds.saveClientLedgerEntriesEndpoint(clientId, data),
    onSuccess: (_res, { clientId }) => invalidateLedger(qc, clientId),
  });
}

export function useUpdateClientLedgerEntry() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; clientId: string; data: UpdateClientLedgerEntryDto }) =>
      ds.updateClientLedgerEntryEndpoint(id, data),
    onSuccess: (_res, { clientId }) => invalidateLedger(qc, clientId),
  });
}

export function useDeleteClientLedgerEntry() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; clientId: string }) =>
      ds.deleteClientLedgerEntryEndpoint(id),
    onSuccess: (_res, { clientId }) => invalidateLedger(qc, clientId),
  });
}

export function useSetClientLedgerEntryResolution() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: { id: string; clientId: string; data: SetClientLedgerEntryResolutionDto }) =>
      ds.setClientLedgerEntryResolutionEndpoint(id, data),
    onSuccess: (_res, { clientId }) => invalidateLedger(qc, clientId),
  });
}
