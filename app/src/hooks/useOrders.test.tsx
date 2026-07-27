// useUpdateOrder's write can propagate the order's address onto (and stamp) its
// shipment stop server-side. With staleTime 30s and no refetch-on-focus, an
// editor → shipment-detail navigation inside that window would otherwise show
// the pre-propagation address and no banner unless shipment queries are
// invalidated too — this is the regression guard for that.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { qk } from 'src/api/queryKeys';
import { useUpdateOrder } from './useOrders';
import type { UpdateOrderDto } from 'src/generated/api-client';

const updateOrderEndpoint = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({ updateOrderEndpoint: (...args: unknown[]) => updateOrderEndpoint(...args) }),
}));

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  // Seed both resources as fresh data so we can tell invalidation apart from
  // "there was never anything cached to begin with".
  qc.setQueryData(qk.orders.list(), [{ id: 'o1' }]);
  qc.setQueryData(qk.shipments.list(), [{ id: 's1' }]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useUpdateOrder(), { wrapper });
  return { result, qc };
}

describe('useUpdateOrder', () => {
  it('invalidates shipment queries alongside order queries, since the write can propagate onto a shipment stop', async () => {
    updateOrderEndpoint.mockResolvedValue(undefined);
    const { result, qc } = setup();

    result.current.mutate({ id: 'o1', data: {} as UpdateOrderDto });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(qc.getQueryState(qk.orders.list())?.isInvalidated).toBe(true);
    expect(qc.getQueryState(qk.orders.detail('o1'))?.isInvalidated ?? true).toBe(true);
    expect(qc.getQueryState(qk.shipments.list())?.isInvalidated).toBe(true);
  });
});
