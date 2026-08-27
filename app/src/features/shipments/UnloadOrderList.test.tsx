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
import type { StopHoursNote } from './supplierStopHours';

function stop(over: Partial<UnloadStop> = {}): UnloadStop {
  return {
    seq: 1,
    stopId: 'stop-1',
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

function renderList(
  stops: UnloadStop[],
  onRecordChange?: (s: UnloadStop) => void,
  supplierHours?: Map<string, StopHoursNote>,
  onToggleFinished?: (s: UnloadStop, isCompleted: boolean) => void,
) {
  return render(
    <MuiThemeProvider theme={theme}>
      <UnloadOrderList
        stops={stops}
        startPoint={{ name: 'AleTrack s.r.o.' }}
        supplierHours={supplierHours}
        onRecordChange={onRecordChange}
        onToggleFinished={onToggleFinished}
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

  // Wordless in this row — it already carries a pressable circle, a badge and a count — so the
  // whole action has to live in the accessible name instead of on screen.
  it('carries no word, while still announcing the whole action', () => {
    renderList([stop()], vi.fn());

    const button = screen.getByRole('button', { name: 'Zaznamenat změnu' });
    expect(button).toHaveTextContent('');
    expect(button.querySelector('svg')).not.toBeNull();
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

// A pickup stop is on the list now, and the one thing the office checks about it before the van
// leaves is whether the gate will be open. What the line says is pinned in
// supplierStopHours.test.ts; what the row owes is showing it, and shouting when it is shut.
describe('UnloadOrderList — a supplier pickup\'s opening hours', () => {
  const pickup = (over: Partial<UnloadStop> = {}) => stop({
    seq: 3,
    kind: 'supplier',
    title: 'Linde Gas',
    subtitle: 'Průmyslová 12, Liberec',
    orderId: undefined,
    clientId: undefined,
    clientIdForLedger: undefined,
    supplierId: 'sup-linde',
    lines: [{ name: 'CO₂ láhev', chip: 'Zboží dodavatele · 10 kg', quantity: 2 }],
    totalQuantity: 2,
    ...over,
  });

  it('reads out the day the run falls on', () => {
    renderList([pickup()], undefined, new Map([
      ['sup-linde', { text: 'Po 7:00–15:30', closedAtArrival: false }],
    ]));

    expect(screen.getByText('Po 7:00–15:30')).toBeInTheDocument();
    expect(screen.queryByLabelText('V čase vývozu zavřeno')).not.toBeInTheDocument();
  });

  it('warns when the van would arrive to a closed gate', () => {
    renderList([pickup()], undefined, new Map([
      ['sup-linde', { text: 'Po 7:00–15:30', closedAtArrival: true }],
    ]));

    // The chip beside the name says it, rather than leaving the warning to colour alone.
    expect(screen.getByText('Po 7:00–15:30 · zavřeno')).toBeInTheDocument();
    expect(screen.getByLabelText('V čase vývozu zavřeno')).toBeInTheDocument();
  });

  // No date on the run, or no schedule on the supplier: the row says nothing about hours rather
  // than guessing at them.
  it('says nothing about hours when there is nothing to say', () => {
    renderList([pickup()], undefined, new Map());

    expect(screen.getByText('Linde Gas')).toBeInTheDocument();
    expect(screen.queryByText(/zavřeno/)).not.toBeInTheDocument();
  });

  // The hours belong to the supplier, so a delivery stop must not borrow them even if a map
  // somehow carries its id.
  it('leaves a delivery stop without an hours line', () => {
    renderList([stop()], undefined, new Map([
      ['sup-linde', { text: 'Po 7:00–15:30', closedAtArrival: true }],
    ]));

    expect(screen.queryByText(/7:00/)).not.toBeInTheDocument();
  });
});

// Marking a stop off as the drivers ring in. Whether it is offered at all is the run's business —
// the caller withholds the handler unless the van is on the road — and what the row owes is the
// button, the time once it is marked, and a way back from a mis-click.
describe('UnloadOrderList — finishing a stop', () => {
  /** The stop's own circle, which is the control — named by what pressing it would do. */
  const finishButtons = () => screen.queryAllByRole('button', {
    name: /^(Označit jako hotovo|Hotovo .* kliknutím zrušit)$/,
  });

  it('offers every stop a mark once the caller opens it', () => {
    const finish = vi.fn();
    renderList(
      [stop(), stop({ seq: 2, stopId: 'stop-2', title: 'Linde Gas', kind: 'supplier', orderId: undefined })],
      undefined,
      undefined,
      finish,
    );

    // A pickup is called at too, so it gets the same mark as a delivery.
    expect(finishButtons()).toHaveLength(2);

    fireEvent.click(finishButtons()[0]);
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ stopId: 'stop-1' }), true);
  });

  it('reads out when the stop was finished, and takes the mark back on click', () => {
    const finish = vi.fn();
    renderList(
      [stop({ completedAt: new Date(2026, 7, 24, 14, 32) })],
      undefined,
      undefined,
      finish,
    );

    // The circle reads as a check, the time reads in the row, and the circle's name says what
    // pressing it would do now.
    expect(screen.getByText('14:32')).toBeInTheDocument();
    expect(screen.getByTestId('stop-done-check')).toBeInTheDocument();
    const done = screen.getByRole('button', { name: 'Hotovo 14:32 — kliknutím zrušit' });

    fireEvent.click(done);
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ stopId: 'stop-1' }), false);
  });

  // Off the road, or a viewer who cannot edit: the record stays readable, the control does not.
  it('keeps the time but drops the control when marking is closed', () => {
    renderList([stop({ completedAt: new Date(2026, 7, 24, 14, 32) })]);

    // Nothing to press, but the row still says the stop was done and when.
    expect(screen.getByText('14:32')).toBeInTheDocument();
    expect(screen.getByTestId('stop-done-check')).toBeInTheDocument();
    expect(finishButtons()).toHaveLength(0);
  });

  it('offers nothing on an unmarked stop when marking is closed', () => {
    renderList([stop()]);

    expect(finishButtons()).toHaveLength(0);
  });

  // The write is addressed by the stop's id; without one there is nothing to write against.
  it('offers no mark on a stop with no id', () => {
    renderList([stop({ stopId: undefined })], undefined, undefined, vi.fn());

    expect(finishButtons()).toHaveLength(0);
  });
});
