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
import {
  ShipmentInvoiceConfirmationDto,
  ShipmentInvoicesDto,
} from 'src/generated/api-client';
import { useSetInvoiceReadiness } from './useShipmentInvoices';

const SHIPMENT = 's-1';
const PAYER = 'client-payer';

const readinessEndpoint = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({
    setInvoiceReadinessEndpoint: (...args: unknown[]) => readinessEndpoint(...args),
  }),
}));

function setup(split: Partial<ShipmentInvoicesDto> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  // Seeded and marked fresh, so only an invalidation can mark them stale.
  qc.setQueryData(
    qk.shipmentInvoices(SHIPMENT),
    new ShipmentInvoicesDto({ invoices: [], confirmations: [], ...split }),
  );
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

// A tick used to change nothing on screen until three invalidated queries had come back — one of
// them every orders query on the client. These tests pin the optimistic half: the invoices cache
// carries the new flag from the click, and gives it back if the write fails.
describe('useSetInvoiceReadiness — optimistic tick', () => {
  /** The seeded split, as the hook leaves it. */
  function confirmations(qc: QueryClient) {
    return (qc.getQueryData(qk.shipmentInvoices(SHIPMENT)) as ShipmentInvoicesDto | undefined)
      ?.confirmations ?? [];
  }

  it('flips the cache before the endpoint answers', async () => {
    let settle = () => {};
    readinessEndpoint.mockImplementation(() => new Promise<void>((r) => { settle = () => r(); }));
    const { qc, result } = setup();

    result.current.mutate({ clientId: PAYER, isReady: true });

    await waitFor(() => expect(confirmations(qc)).toHaveLength(1));
    expect(confirmations(qc)[0].isReady).toBe(true);

    settle();
  });

  it('hands the first tick the number the endpoint would have handed it', async () => {
    readinessEndpoint.mockResolvedValue(undefined);
    const { qc, result } = setup({
      confirmations: [
        new ShipmentInvoiceConfirmationDto({ clientId: 'client-other', number: 2, isReady: true }),
      ],
    });

    await result.current.mutateAsync({ clientId: PAYER, isReady: true });

    // Mirrors NextConfirmationNumber: the highest number on the run, plus one — so the band's
    // circle shows its number from the click rather than a dash.
    const added = confirmations(qc).find((c) => c.clientId === PAYER);
    expect(added?.number).toBe(3);
  });

  it('keeps the number a marked row already has when it is un-ticked', async () => {
    readinessEndpoint.mockResolvedValue(undefined);
    const { qc, result } = setup({
      confirmations: [
        new ShipmentInvoiceConfirmationDto({ clientId: PAYER, number: 4, isReady: true }),
      ],
    });

    await result.current.mutateAsync({ clientId: PAYER, isReady: false });

    expect(confirmations(qc)[0].number).toBe(4);
    expect(confirmations(qc)[0].isReady).toBe(false);
  });

  it('opens no row when clearing one nobody ever marked', async () => {
    readinessEndpoint.mockResolvedValue(undefined);
    const { qc, result } = setup();

    await result.current.mutateAsync({ clientId: PAYER, isReady: false });

    // The endpoint treats this as a no-op rather than burn a number; the cache must not invent one.
    expect(confirmations(qc)).toHaveLength(0);
  });

  it('gives the old flag back when the write fails', async () => {
    readinessEndpoint.mockRejectedValue(new Error('nope'));
    const { qc, result } = setup({
      confirmations: [
        new ShipmentInvoiceConfirmationDto({ clientId: PAYER, number: 1, isReady: true }),
      ],
    });

    await expect(result.current.mutateAsync({ clientId: PAYER, isReady: false })).rejects.toThrow();

    await waitFor(() => expect(confirmations(qc)[0].isReady).toBe(true));
  });
});
