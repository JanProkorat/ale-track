// The Vykládka's own affordances: which stop offers to record a change, and which does not.
//
// Recording opens for the whole run at once, when its invoicing is filed — the caller withholds
// the handler until then. What this list decides is narrower: a stop needs an order to record
// against.

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
  it('offers it on every stop with an order once the caller opens recording', () => {
    renderList([stop(), stop({ seq: 2, title: 'Bílý Kostel', orderId: 'order-2' })], vi.fn());

    expect(recordButtons()).toHaveLength(2);
  });

  it('reads just "Změna" while still announcing the whole action', () => {
    renderList([stop()], vi.fn());

    const button = screen.getByRole('button', { name: 'Zaznamenat změnu' });
    expect(button).toHaveTextContent('Změna');
    expect(button).not.toHaveTextContent('Zaznamenat');
  });

  // Whether recording is open is the run's business, not the stop's: it opens when the run's
  // invoicing is filed, and the caller says so by withholding the handler.
  it('offers nothing while the caller holds recording shut', () => {
    renderList([stop()]);

    expect(recordButtons()).toHaveLength(0);
  });

  it('hands the stop back to the caller', () => {
    const onRecord = vi.fn();
    const target = stop();
    renderList([target], onRecord);

    fireEvent.click(screen.getByRole('button', { name: 'Zaznamenat změnu' }));

    expect(onRecord).toHaveBeenCalledWith(target);
  });

  // A warehouse or fuel stop has no order, so there is nothing to record against.
  it('never offers it on a stop with no order', () => {
    renderList([stop({ kind: 'custom', orderId: undefined, lines: [] })], vi.fn());

    expect(recordButtons()).toHaveLength(0);
  });

  it('badges a stop with its open changes independently of the button', () => {
    renderList([stop({ openChanges: 2 })]);

    // The badge says what happened; the button says whether more can be written down. A stop
    // carries what was recorded whether or not recording is open now.
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
