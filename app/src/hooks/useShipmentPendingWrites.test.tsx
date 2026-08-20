// The timing the shipment screen's predicted routes depend on.
//
// Both writes below are predicted client-side — the screen draws the stops the change will leave
// behind and drops that prediction when the mutation settles. For that to be flicker-free the
// settle has to come *after* the refetch, because until then the cache still holds the pre-write
// route. These tests pin that ordering, which is the part reasoning alone got wrong once.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { OutgoingShipmentDetailDto, OutgoingShipmentStopDto } from 'src/generated/api-client';
import { qk } from 'src/api/queryKeys';
import { useReorderShipmentStops, useSetSupplierGoodSourcing } from './useShipments';

const SHIPMENT = 's-1';

const reorderEndpoint = vi.fn();
const sourcingEndpoint = vi.fn();
const detailEndpoint = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({
    reorderShipmentStopsEndpoint: (...args: unknown[]) => reorderEndpoint(...args),
    setSupplierGoodSourcingEndpoint: (...args: unknown[]) => sourcingEndpoint(...args),
    getOutgoingShipmentDetailEndpoint: (...args: unknown[]) => detailEndpoint(...args),
  }),
}));

function detailWith(stopIds: string[]) {
  const detail = new OutgoingShipmentDetailDto();
  detail.id = SHIPMENT;
  detail.name = 'Rozvoz';
  detail.stops = stopIds.map((id, i) => new OutgoingShipmentStopDto({ id, order: i + 1 }));
  detail.supplierGoods = [];
  return detail;
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(qk.shipments.detail(SHIPMENT), detailWith(['a', 'b']));

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  return { qc, wrapper };
}

/**
 * The mutation, rendered alongside a live subscription to the run.
 *
 * The subscription is what makes these tests mean anything: `invalidateQueries` refetches *active*
 * queries only, so without an observer it resolves at once and the window this file is about would
 * not exist to observe.
 */
function renderWithDetailObserver<T>(useMutationHook: () => T, wrapper: ReturnType<typeof setup>['wrapper']) {
  return renderHook(() => {
    useQuery({
      queryKey: qk.shipments.detail(SHIPMENT),
      queryFn: () => detailEndpoint(SHIPMENT) as Promise<OutgoingShipmentDetailDto>,
    });
    return useMutationHook();
  }, { wrapper });
}

describe('useReorderShipmentStops', () => {
  it('settles only once the refetched run has arrived', async () => {
    reorderEndpoint.mockReset().mockResolvedValue(undefined);

    // The refetch resolves on our command, so the window between "write done" and "run re-read"
    // is observable rather than a race.
    let releaseRefetch: (() => void) | undefined;
    detailEndpoint.mockReset().mockImplementation(() => new Promise((resolve) => {
      releaseRefetch = () => resolve(detailWith(['b', 'a']));
    }));

    const { wrapper } = setup();
    const { result } = renderWithDetailObserver(() => useReorderShipmentStops(SHIPMENT), wrapper);

    const settled = vi.fn();
    result.current.mutate(['b', 'a'], { onSettled: settled });

    await waitFor(() => expect(releaseRefetch).toBeDefined());
    // The write itself is done, but the run has not been re-read — the caller must still be
    // holding its prediction here.
    expect(settled).not.toHaveBeenCalled();

    releaseRefetch!();
    await waitFor(() => expect(settled).toHaveBeenCalled());
  });

  it('patches the order into the cache so the list moves before the refetch', async () => {
    reorderEndpoint.mockReset().mockResolvedValue(undefined);
    detailEndpoint.mockReset().mockResolvedValue(detailWith(['b', 'a']));

    const { qc, wrapper } = setup();
    const { result } = renderWithDetailObserver(() => useReorderShipmentStops(SHIPMENT), wrapper);

    result.current.mutate(['b', 'a']);

    await waitFor(() => {
      const cached = qc.getQueryData<OutgoingShipmentDetailDto>(qk.shipments.detail(SHIPMENT));
      expect(cached?.stops?.find((s) => s.id === 'b')?.order).toBe(1);
      expect(cached?.stops?.find((s) => s.id === 'a')?.order).toBe(2);
    });
  });

  it('puts the old order back when the write fails', async () => {
    reorderEndpoint.mockReset().mockRejectedValue(new Error('nope'));
    detailEndpoint.mockReset().mockResolvedValue(detailWith(['a', 'b']));

    const { qc, wrapper } = setup();
    const { result } = renderWithDetailObserver(() => useReorderShipmentStops(SHIPMENT), wrapper);

    result.current.mutate(['b', 'a']);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = qc.getQueryData<OutgoingShipmentDetailDto>(qk.shipments.detail(SHIPMENT));
    expect(cached?.stops?.find((s) => s.id === 'a')?.order).toBe(1);
  });
});

describe('useSetSupplierGoodSourcing', () => {
  it('settles only once the refetched run has arrived', async () => {
    sourcingEndpoint.mockReset().mockResolvedValue(undefined);

    let releaseRefetch: (() => void) | undefined;
    detailEndpoint.mockReset().mockImplementation(() => new Promise((resolve) => {
      releaseRefetch = () => resolve(detailWith(['a', 'b']));
    }));

    const { wrapper } = setup();
    const { result } = renderWithDetailObserver(() => useSetSupplierGoodSourcing(SHIPMENT), wrapper);

    const settled = vi.fn();
    result.current.mutate({ itemId: 'line-1', quantityFromGarage: 1 }, { onSettled: settled });

    await waitFor(() => expect(releaseRefetch).toBeDefined());
    // The stops the server reconciled are not in the cache yet, so dropping the prediction now
    // would show the pre-write route for a frame — the flicker this guards against.
    expect(settled).not.toHaveBeenCalled();

    releaseRefetch!();
    await waitFor(() => expect(settled).toHaveBeenCalled());
  });
});
