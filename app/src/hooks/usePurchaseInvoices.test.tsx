// The optimistic half of the purchase-invoice line write: the remainder column is
// derived from this cache, so it has to move with the edited column rather than
// after the round trip — and go back if the write fails.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentPurchaseInvoiceDto,
  OutgoingShipmentPurchaseInvoiceLineDto,
} from 'src/generated/api-client';
import { qk } from 'src/api/queryKeys';
import { claimAt } from 'src/features/shipments/purchaseSplitModel';
import { useSetPurchaseInvoiceLine } from './usePurchaseInvoices';

const SHIPMENT = 's-1';
const LEZAK = 'p-lezak';

const setLine = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({ setPurchaseInvoiceLineEndpoint: (...args: unknown[]) => setLine(...args) }),
}));

function shipmentWith(lines: Array<[number, string, number]>) {
  const detail = new OutgoingShipmentDetailDto();
  detail.id = SHIPMENT;
  detail.name = 'Rozvoz';
  detail.purchaseInvoices = [1, 2].map((sequence) => {
    const invoice = new OutgoingShipmentPurchaseInvoiceDto();
    invoice.id = `i${sequence}`;
    invoice.sequence = sequence;
    invoice.lines = lines
      .filter(([seq]) => seq === sequence)
      .map(([, productId, quantity]) => {
        const line = new OutgoingShipmentPurchaseInvoiceLineDto();
        line.productId = productId;
        line.quantity = quantity;
        return line;
      });
    return invoice;
  });
  return detail;
}

function setup(initial: OutgoingShipmentDetailDto) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(qk.shipments.detail(SHIPMENT), initial);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useSetPurchaseInvoiceLine(SHIPMENT), { wrapper });
  const cached = () => qc.getQueryData<OutgoingShipmentDetailDto>(qk.shipments.detail(SHIPMENT))!;

  return { result, cached };
}

describe('useSetPurchaseInvoiceLine', () => {
  it('patches the cache before the server answers', async () => {
    // Never resolves: whatever the cache holds while it hangs is what the user sees.
    setLine.mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup(shipmentWith([[2, LEZAK, 4]]));

    result.current.mutate({ sequence: 2, productId: LEZAK, quantity: 9 });

    await waitFor(() => expect(claimAt(cached().purchaseInvoices ?? [], 2, LEZAK)).toBe(9));
  });

  it('keeps the detail usable as a DTO, not a plain object', () => {
    setLine.mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup(shipmentWith([]));

    result.current.mutate({ sequence: 2, productId: LEZAK, quantity: 3 });

    expect(cached()).toBeInstanceOf(OutgoingShipmentDetailDto);
    expect(cached().name).toBe('Rozvoz');
  });

  it('restores the previous split when the write fails', async () => {
    setLine.mockRejectedValue(new Error('boom'));
    const { result, cached } = setup(shipmentWith([[2, LEZAK, 4]]));

    result.current.mutate({ sequence: 2, productId: LEZAK, quantity: 9 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(claimAt(cached().purchaseInvoices ?? [], 2, LEZAK)).toBe(4);
  });

  it('sends what it was asked to send', async () => {
    setLine.mockResolvedValue('');
    const { result } = setup(shipmentWith([]));

    result.current.mutate({ sequence: 2, productId: LEZAK, quantity: 7 });

    await waitFor(() => expect(setLine).toHaveBeenCalled());
    const [shipmentId, dto] = setLine.mock.calls.at(-1)!;
    expect(shipmentId).toBe(SHIPMENT);
    expect(dto).toMatchObject({ sequence: 2, productId: LEZAK, quantity: 7 });
  });
});
