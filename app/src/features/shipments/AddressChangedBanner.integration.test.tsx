// Round-trip test for the banner's "Rozumím" action.
//
// AddressChangedBanner.test.tsx mocks `useAcknowledgeAddressChanges`, so it can
// only prove the mutation was *called*. It cannot prove the banner actually
// goes away, because that depends on the mutation invalidating the shipment
// query and the refetch returning cleared stops. That chain — click → endpoint
// → invalidate → refetch → banner gone — is what this file covers, with a real
// QueryClient and only the data source stubbed.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type OutgoingShipmentStopDto } from 'src/generated/api-client';
import { useShipment } from 'src/hooks/useShipments';
import { AddressChangedBanner } from './AddressChangedBanner';

const SHIPMENT_ID = 's1';

const stampedStop = {
  id: 'st1',
  clientName: 'U Zlatého sklepa',
  addressChangedAt: new Date('2026-07-27T09:00:00Z'),
  isAddressOverridden: false,
} as unknown as OutgoingShipmentStopDto;

const clearedStop = {
  ...stampedStop,
  addressChangedAt: undefined,
} as unknown as OutgoingShipmentStopDto;

/** Serves stamped stops until acknowledge is called, cleared stops after —
 * exactly what the real backend does. */
function makeDataSource() {
  let acknowledged = false;
  const acknowledgeAddressChangesEndpoint = vi.fn(async () => {
    acknowledged = true;
    return '';
  });
  const getOutgoingShipmentDetailEndpoint = vi.fn(async () => ({
    id: SHIPMENT_ID,
    stops: [acknowledged ? clearedStop : stampedStop],
  }));
  return { acknowledgeAddressChangesEndpoint, getOutgoingShipmentDetailEndpoint };
}

const ds = makeDataSource();
vi.mock('src/api/dataSource', () => ({ useDataSource: () => ds }));

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

function Harness() {
  const query = useShipment(SHIPMENT_ID);
  if (!query.data) return null;
  return <AddressChangedBanner shipmentId={SHIPMENT_ID} stops={query.data.stops ?? []} />;
}

function renderHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('acknowledging an address change', () => {
  it('removes the banner and does not bring it back', async () => {
    renderHarness();

    // The banner is there to begin with.
    await screen.findByText('Změna adresy doručení');

    fireEvent.click(screen.getByRole('button', { name: 'Rozumím' }));

    // The whole chain has to complete for this to pass: the mutation resolves,
    // onSuccess invalidates the shipment query, the refetch returns a stop with
    // no addressChangedAt, and the banner renders null.
    await waitForElementToBeRemoved(() => screen.queryByText('Změna adresy doručení'));

    expect(ds.acknowledgeAddressChangesEndpoint).toHaveBeenCalledWith(SHIPMENT_ID);
    expect(screen.queryByText('Změna adresy doručení')).not.toBeInTheDocument();
  });

  // Scope note, verified by sabotage: the `enqueueSnackbar` assertion below is
  // what this test guards — removing the catch in AddressChangedBanner fails
  // it. The "notice is still there" assertion does NOT isolate the optimistic
  // rollback: onSettled refetches on failure too, so the stamped stop comes
  // back through the refetch whether or not onError restored the cache
  // (sabotaging the rollback alone leaves this test green). The rollback earns
  // its place as the fast path for when the refetch is slow or also fails, not
  // as something this test can distinguish.
  it('reports the error and leaves the notice in place when the server rejects', async () => {
    const failing = {
      acknowledgeAddressChangesEndpoint: vi.fn(async () => {
        throw new Error('403');
      }),
      getOutgoingShipmentDetailEndpoint: vi.fn(async () => ({
        id: SHIPMENT_ID,
        stops: [stampedStop],
      })),
    };
    Object.assign(ds, failing);
    enqueueSnackbar.mockClear();

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );

    await screen.findByText('Změna adresy doručení');
    fireEvent.click(screen.getByRole('button', { name: 'Rozumím' }));

    // Assert on the DOM first — findBy* settles React inside act(), so the
    // rollback and the snackbar call have both landed by the time we inspect
    // the mock. Checking the mock first would race the re-render and warn.
    //
    // Still on screen: the rollback restored it rather than leaving the planner
    // believing a notice was dismissed that the server never cleared.
    expect(await screen.findByText('Změna adresy doručení')).toBeInTheDocument();

    expect(enqueueSnackbar).toHaveBeenCalled();
    expect(enqueueSnackbar.mock.calls[0][1]).toEqual({ variant: 'error' });
  });
});
