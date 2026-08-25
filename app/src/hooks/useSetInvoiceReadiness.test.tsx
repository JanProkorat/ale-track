// Ticking a Fakturace row is not only an invoicing fact: it is what opens recording a deviation,
// and that flag rides on the shipment's stops and on the order itself. Invalidating only the
// invoices query left the Zaznamenat změnu button a page refresh behind — appearing late when a
// row was ticked, and staying put when it was un-ticked.
//
// These tests pin which caches the tick refreshes, and that it does not settle before they have.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { qk } from 'src/api/queryKeys';
import { useSetInvoiceReadiness } from './useShipmentInvoices';

const SHIPMENT = 's-1';
const PAYER = 'client-payer';

const readinessEndpoint = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({
    setInvoiceReadinessEndpoint: (...args: unknown[]) => readinessEndpoint(...args),
  }),
}));

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  // Seeded and marked fresh, so only an invalidation can mark them stale.
  qc.setQueryData(qk.shipmentInvoices(SHIPMENT), { invoices: [] });
  qc.setQueryData(qk.shipments.detail(SHIPMENT), { id: SHIPMENT });
  qc.setQueryData(qk.orders.detail('order-1'), { id: 'order-1', isInvoiceReady: false });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useSetInvoiceReadiness(SHIPMENT), { wrapper });
  return { qc, result };
}

/** Whether the cache entry behind a key has been marked stale. */
function isStale(qc: QueryClient, key: readonly unknown[]) {
  return qc.getQueryState(key)?.isInvalidated ?? false;
}

describe('useSetInvoiceReadiness', () => {
  it('refreshes the invoices, the run and its orders', async () => {
    readinessEndpoint.mockResolvedValue(undefined);
    const { qc, result } = setup();

    await result.current.mutateAsync({ clientId: PAYER, isReady: true });

    expect(isStale(qc, qk.shipmentInvoices(SHIPMENT))).toBe(true);
    // Where the unload list reads the per-stop flag from.
    expect(isStale(qc, qk.shipments.detail(SHIPMENT))).toBe(true);
    // And where the order screen reads its own. Invalidated wholesale, because a payer's tick
    // covers its whole sub-client group and which orders it touched is not knowable from here.
    expect(isStale(qc, qk.orders.detail('order-1'))).toBe(true);
  });

  it('refreshes the same caches when a row is un-ticked', async () => {
    readinessEndpoint.mockResolvedValue(undefined);
    const { qc, result } = setup();

    await result.current.mutateAsync({ clientId: PAYER, isReady: false });

    expect(isStale(qc, qk.shipments.detail(SHIPMENT))).toBe(true);
    expect(isStale(qc, qk.orders.detail('order-1'))).toBe(true);
  });

  it('sends the payer and the flag through to the endpoint', async () => {
    readinessEndpoint.mockResolvedValue(undefined);
    const { result } = setup();

    await result.current.mutateAsync({ clientId: PAYER, isReady: true });

    expect(readinessEndpoint).toHaveBeenCalledWith(
      SHIPMENT,
      PAYER,
      expect.objectContaining({ isReady: true }),
    );
  });

  it('leaves the caches alone when the write fails', async () => {
    readinessEndpoint.mockRejectedValue(new Error('nope'));
    const { qc, result } = setup();

    await expect(result.current.mutateAsync({ clientId: PAYER, isReady: true })).rejects.toThrow();

    await waitFor(() => expect(isStale(qc, qk.shipments.detail(SHIPMENT))).toBe(false));
    expect(isStale(qc, qk.orders.detail('order-1'))).toBe(false);
  });
});
