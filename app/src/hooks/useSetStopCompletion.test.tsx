// Marking a stop finished is a value the clicker already knows, so it lands in the cache before
// the write does — the same reasoning the checklist tick follows. These tests pin that, and the
// rollback that has to follow a refused write: the endpoint takes this only while the run is on
// the road, so a 400 is a case the office will actually meet.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { qk } from 'src/api/queryKeys';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentStopDto,
} from 'src/generated/api-client';
import { useSetStopCompletion } from './useShipments';

const SHIPMENT = 'ship-1';
const STOP = 'stop-1';

const completionEndpoint = vi.fn();

vi.mock('src/api/dataSource', () => ({
  useDataSource: () => ({
    setStopCompletionEndpoint: (...args: unknown[]) => completionEndpoint(...args),
  }),
}));

function setup(completedAt?: Date) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  qc.setQueryData(
    qk.shipments.detail(SHIPMENT),
    new OutgoingShipmentDetailDto({
      id: SHIPMENT,
      stops: [
        new OutgoingShipmentStopDto({ id: STOP, order: 1, completedAt }),
        new OutgoingShipmentStopDto({ id: 'stop-2', order: 2 }),
      ],
    }),
  );

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useSetStopCompletion(SHIPMENT), { wrapper });
  return { qc, result };
}

/** The cached stops, as the hook leaves them. */
function stops(qc: QueryClient) {
  return (qc.getQueryData(qk.shipments.detail(SHIPMENT)) as OutgoingShipmentDetailDto).stops ?? [];
}

describe('useSetStopCompletion', () => {
  it('marks the stop before the endpoint answers', async () => {
    let settle = () => {};
    completionEndpoint.mockImplementation(() => new Promise<void>((r) => { settle = () => r(); }));
    const { qc, result } = setup();

    result.current.mutate({ stopId: STOP, isCompleted: true });

    await waitFor(() => expect(stops(qc)[0].completedAt).toBeInstanceOf(Date));
    // Only the stop that was clicked.
    expect(stops(qc)[1].completedAt).toBeUndefined();

    settle();
  });

  it('keeps the time a stop was already marked with', async () => {
    completionEndpoint.mockResolvedValue(undefined);
    const first = new Date('2026-08-24T12:32:00Z');
    const { qc, result } = setup(first);

    await result.current.mutateAsync({ stopId: STOP, isCompleted: true });

    expect(stops(qc)[0].completedAt).toEqual(first);
  });

  it('clears the mark when it is taken back', async () => {
    completionEndpoint.mockResolvedValue(undefined);
    const { qc, result } = setup(new Date('2026-08-24T12:32:00Z'));

    result.current.mutate({ stopId: STOP, isCompleted: false });

    await waitFor(() => expect(stops(qc)[0].completedAt).toBeUndefined());
  });

  it('sends the stop and the mark through to the endpoint', async () => {
    completionEndpoint.mockResolvedValue(undefined);
    const { result } = setup();

    await result.current.mutateAsync({ stopId: STOP, isCompleted: true });

    expect(completionEndpoint).toHaveBeenCalledWith(
      SHIPMENT,
      STOP,
      expect.objectContaining({ isCompleted: true }),
    );
  });

  // The endpoint refuses a run that is not on the road, so the row must go back to what it was
  // rather than keep a mark the server never took.
  it('gives the old state back when the write is refused', async () => {
    completionEndpoint.mockRejectedValue(new Error('not in transit'));
    const { qc, result } = setup();

    await expect(result.current.mutateAsync({ stopId: STOP, isCompleted: true })).rejects.toThrow();

    await waitFor(() => expect(stops(qc)[0].completedAt).toBeUndefined());
  });

  it('leaves the cache alone when it has no shipment to patch', async () => {
    completionEndpoint.mockResolvedValue(undefined);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetStopCompletion(SHIPMENT), { wrapper });

    await result.current.mutateAsync({ stopId: STOP, isCompleted: true });

    expect(qc.getQueryData(qk.shipments.detail(SHIPMENT))).toBeUndefined();
  });
});
