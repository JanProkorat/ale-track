// The Vykládka's own affordances: which stop offers to record a change, and which does not.
//
// Recording is opened by that stop's Fakturace row being finished — never by the run's state.
// The office closes rows one client at a time, so two stops of one run legitimately disagree.

import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { UnloadOrderList } from './UnloadOrderList';
import type { UnloadStop } from './unloadOrder';

function stop(over: Partial<UnloadStop> = {}): UnloadStop {
  return {
    seq: 1,
    kind: 'order',
    title: 'Chrastava',
    addressMissing: false,
    orderId: 'order-1',
    clientId: 'client-a',
    clientIdForLedger: 'client-a',
    lines: [{ name: 'Kozel 12°', chip: 'Sud · 50 l', quantity: 4 }],
    totalQuantity: 4,
    openChanges: 0,
    isInvoiceReady: false,
    ...over,
  };
}

function renderList(stops: UnloadStop[], onRecordChange?: (s: UnloadStop) => void) {
  return render(
    <MuiThemeProvider theme={theme}>
      <UnloadOrderList
        stops={stops}
        startPoint={{ name: 'AleTrack s.r.o.' }}
        onRecordChange={onRecordChange}
      />
    </MuiThemeProvider>,
  );
}

const recordButtons = () => screen.queryAllByRole('button', { name: 'Zaznamenat změnu' });

describe('UnloadOrderList — recording a change', () => {
  it('offers it on a stop whose invoice row is finished', () => {
    renderList([stop({ isInvoiceReady: true })], vi.fn());

    expect(recordButtons()).toHaveLength(1);
  });

  it('withholds it while the stop\'s paperwork is unfinished', () => {
    renderList([stop({ isInvoiceReady: false })], vi.fn());

    expect(recordButtons()).toHaveLength(0);
  });

  // The office closes the Fakturace rows one client at a time, so the button appearing per stop
  // rather than per run is the whole point of the change.
  it('decides per stop, not per run', () => {
    renderList(
      [
        stop({ seq: 1, title: 'Chrastava', isInvoiceReady: true }),
        stop({ seq: 2, title: 'Bílý Kostel', orderId: 'order-2', isInvoiceReady: false }),
      ],
      vi.fn(),
    );

    expect(recordButtons()).toHaveLength(1);
  });

  it('hands the stop back to the caller', () => {
    const onRecord = vi.fn();
    const ready = stop({ isInvoiceReady: true });
    renderList([ready], onRecord);

    fireEvent.click(screen.getByRole('button', { name: 'Zaznamenat změnu' }));

    expect(onRecord).toHaveBeenCalledWith(ready);
  });

  // A warehouse or fuel stop has no order, so it has no row to finish and nothing to record.
  it('never offers it on a stop with no order', () => {
    renderList([stop({ kind: 'custom', orderId: undefined, isInvoiceReady: true, lines: [] })], vi.fn());

    expect(recordButtons()).toHaveLength(0);
  });

  it('offers nothing to a user who may not write a client\'s ledger', () => {
    renderList([stop({ isInvoiceReady: true })]);

    expect(recordButtons()).toHaveLength(0);
  });

  it('badges a stop with its open changes independently of the button', () => {
    renderList([stop({ openChanges: 2, isInvoiceReady: false })], vi.fn());

    // The badge says what happened; the button says whether more can be written down. A stop can
    // carry recorded changes from an earlier pass while its row is re-opened.
    expect(screen.getByText('2 změny')).toBeInTheDocument();
    expect(recordButtons()).toHaveLength(0);
  });

  it('strikes the loaded count through on a changed line', () => {
    renderList([stop({
      lines: [{
        name: 'Kozel 12°',
        chip: 'Sud · 50 l',
        quantity: 4,
        key: 'item-1',
        diff: {
          key: 'item-1',
          name: 'Kozel 12°',
          quantity: 4,
          status: 'changed',
          plannedQuantity: 4,
          actualQuantity: 3,
        },
      }],
    })], vi.fn());

    // Scoped to the line: the stop's own total beside the client's name reads "4 ks" too.
    const line = within(screen.getByTestId('unload-line'));
    expect(line.getByText('4 ks')).toBeInTheDocument();
    expect(line.getByText('3 ks')).toBeInTheDocument();
    expect(line.getByText('Nevyloženo 1 ks')).toBeInTheDocument();
  });
});
