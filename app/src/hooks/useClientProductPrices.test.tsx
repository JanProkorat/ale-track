// The OrderEditor's whole product catalog (history segment and brewery
// browse) is fetched under qk.productHistory(clientId), not
// qk.clientProductPrices — a price edit that only invalidates the latter
// leaves the editor composing against the stale price for up to the 30s
// staleTime. This is the regression guard for that miss.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { qk } from 'src/api/queryKeys';
import { useDeleteClientProductPrice, useReplaceClientProductPrices, useSaveClientProductPrice } from './useClientProductPrices';
import type { ClientProductPriceEntryDto, SaveClientProductPriceDto } from 'src/generated/api-client';

const saveClientProductPriceEndpoint = vi.fn();
const deleteClientProductPriceEndpoint = vi.fn();
const replaceClientProductPricesEndpoint = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({
    saveClientProductPriceEndpoint: (...args: unknown[]) => saveClientProductPriceEndpoint(...args),
    deleteClientProductPriceEndpoint: (...args: unknown[]) => deleteClientProductPriceEndpoint(...args),
    replaceClientProductPricesEndpoint: (...args: unknown[]) => replaceClientProductPricesEndpoint(...args),
  }),
}));

const CLIENT_ID = 'c1';

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  // Seed all three as fresh data so we can tell invalidation apart from
  // "there was never anything cached to begin with".
  qc.setQueryData(qk.clientProductPrices(CLIENT_ID), []);
  qc.setQueryData(qk.orders.all, []);
  qc.setQueryData(qk.productHistory(CLIENT_ID), []);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  return { qc, wrapper };
}

function expectFullInvalidation(qc: QueryClient) {
  expect(qc.getQueryState(qk.clientProductPrices(CLIENT_ID))?.isInvalidated).toBe(true);
  expect(qc.getQueryState(qk.orders.all)?.isInvalidated).toBe(true);
  expect(qc.getQueryState(qk.productHistory(CLIENT_ID))?.isInvalidated).toBe(true);
}

describe('useSaveClientProductPrice', () => {
  it('invalidates clientProductPrices, orders and productHistory, since the OrderEditor prices from productHistory', async () => {
    saveClientProductPriceEndpoint.mockResolvedValue(undefined);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useSaveClientProductPrice(), { wrapper });

    result.current.mutate({ clientId: CLIENT_ID, productId: 'p1', data: {} as SaveClientProductPriceDto });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expectFullInvalidation(qc);
  });
});

describe('useDeleteClientProductPrice', () => {
  it('invalidates clientProductPrices, orders and productHistory', async () => {
    deleteClientProductPriceEndpoint.mockResolvedValue(undefined);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useDeleteClientProductPrice(), { wrapper });

    result.current.mutate({ clientId: CLIENT_ID, productId: 'p1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expectFullInvalidation(qc);
  });
});

describe('useReplaceClientProductPrices', () => {
  it('invalidates clientProductPrices, orders and productHistory', async () => {
    replaceClientProductPricesEndpoint.mockResolvedValue(undefined);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useReplaceClientProductPrices(), { wrapper });

    result.current.mutate({ clientId: CLIENT_ID, data: [] as ClientProductPriceEntryDto[] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expectFullInvalidation(qc);
  });
});
