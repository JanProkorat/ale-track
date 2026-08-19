// The "Další zboží" card: one row per good with the run's total, and a stepper splitting that
// total between our own garage and a call at the supplier. The route follows the split, so what
// this card writes is what makes a pickup stop appear or vanish.

import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { OutgoingShipmentSupplierGoodDto, SupplierGoodPickupSource } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { aggregateSupplierGoods, type SupplierGoodRow } from './supplierGoodSourcing';

const { SupplierGoodsCard } = await import('./ShipmentDetail');

function line(over: Partial<OutgoingShipmentSupplierGoodDto> = {}): OutgoingShipmentSupplierGoodDto {
  return new OutgoingShipmentSupplierGoodDto({
    id: 'line-1',
    supplierGoodId: 'g-co2',
    name: 'CO₂ láhev',
    size: '10 kg',
    quantity: 2,
    quantityFromGarage: 0,
    pickupSource: SupplierGoodPickupSource.Supplier,
    supplierId: 's-linde',
    supplierName: 'Linde Gas',
    clientId: 'client-a',
    clientName: 'Hospoda A',
    orderId: 'order-1',
    ...over,
  });
}

function renderCard(
  goods: OutgoingShipmentSupplierGoodDto[],
  opts: { editable?: boolean; onAdjust?: (row: SupplierGoodRow, delta: number) => void } = {},
) {
  return render(
    <MuiThemeProvider theme={theme}>
      {/* Through the real aggregation, the way the page feeds it — so these tests cover the
          summing rules and the row together. */}
      <SupplierGoodsCard rows={aggregateSupplierGoods(goods)} editable={opts.editable} onAdjust={opts.onAdjust} />
    </MuiThemeProvider>,
  );
}

/** The row whose good is named `name`. */
function rowFor(name: string): HTMLElement {
  const row = screen.getAllByTestId('supplier-good-row')
    .find((el) => within(el).queryByText(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe('SupplierGoodsCard', () => {
  it('renders nothing at all when no order on the run asks for any', () => {
    const { container } = renderCard([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('is titled Další zboží and names the two columns the stepper moves between', () => {
    renderCard([line()]);

    expect(screen.getByText('Další zboží')).toBeInTheDocument();
    expect(screen.getByText('Z garáže')).toBeInTheDocument();
    expect(screen.getByText('Od dodav.')).toBeInTheDocument();
  });

  // One product, one row: two orders for the same good is one thing to pick up.
  it('sums two orders of the same good into a single row', () => {
    renderCard([
      line({ id: 'l-1', quantity: 2, clientName: 'Hospoda A' }),
      line({ id: 'l-2', quantity: 3, clientName: 'Hospoda B' }),
    ]);

    expect(screen.getAllByText('CO₂ láhev')).toHaveLength(1);
    expect(screen.getByText('5 ks celkem')).toBeInTheDocument();
  });

  it('keeps two goods of the same name from different suppliers apart', () => {
    renderCard([
      line({ id: 'l-1', supplierGoodId: 'g-a', supplierName: 'Linde Gas' }),
      line({ id: 'l-2', supplierGoodId: 'g-b', supplierName: 'Obaly Morava' }),
    ]);

    expect(screen.getAllByText('CO₂ láhev')).toHaveLength(2);
  });

  it('names neither the supplier nor the client', () => {
    renderCard([line()]);

    expect(screen.queryByText(/Linde Gas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hospoda A/)).not.toBeInTheDocument();
  });

  it('splits the total across the garage and supplier columns', () => {
    renderCard([line({ quantity: 5, quantityFromGarage: 2 })]);

    const row = within(rowFor('CO₂ láhev'));
    expect(row.getByText('2')).toBeInTheDocument();
    expect(row.getByText('3 ks')).toBeInTheDocument();
  });

  it('offers no stepper while the loading is closed', () => {
    renderCard([line()], { editable: false });

    expect(screen.queryByRole('button', { name: /Přidat z garáže/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ubrat z garáže/ })).not.toBeInTheDocument();
  });

  it('moves a piece into the garage on the plus, reporting the row and the direction', () => {
    const onAdjust = vi.fn();
    renderCard([line({ quantity: 2, quantityFromGarage: 0 })], { editable: true, onAdjust });

    fireEvent.click(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' }));

    expect(onAdjust).toHaveBeenCalledTimes(1);
    const [row, delta] = onAdjust.mock.calls[0];
    expect(delta).toBe(1);
    expect(row.supplierGoodId).toBe('g-co2');
    // The row carries the lines behind it, which is how the caller picks one to write.
    expect(row.sources).toHaveLength(1);
  });

  it('moves a piece back out on the minus', () => {
    const onAdjust = vi.fn();
    renderCard([line({ quantity: 2, quantityFromGarage: 2 })], { editable: true, onAdjust });

    fireEvent.click(screen.getByRole('button', { name: 'Ubrat z garáže — CO₂ láhev' }));

    expect(onAdjust.mock.calls[0][1]).toBe(-1);
  });

  it('disables each direction at its end of the range', () => {
    renderCard([line({ quantity: 2, quantityFromGarage: 0 })], { editable: true });
    expect(screen.getByRole('button', { name: 'Ubrat z garáže — CO₂ láhev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' })).toBeEnabled();
  });

  it('disables the plus once every piece is already from the garage', () => {
    renderCard([line({ quantity: 2, quantityFromGarage: 2 })], { editable: true });

    expect(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' })).toBeDisabled();
  });

  // Drawing more than the garage holds is allowed — a dovoz may still land before the truck is
  // packed — so the card warns instead of blocking, like the nakládka does for stock.
  it('warns when more is drawn than the garage holds, without disabling anything', () => {
    renderCard([line({ quantity: 5, quantityFromGarage: 4, garageAvailable: 2 })], { editable: true });

    expect(screen.getByText('Na skladě jen 2 ks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' })).toBeEnabled();
  });

  it('does not warn about a good the warehouse does not track', () => {
    renderCard([line({ quantity: 5, quantityFromGarage: 4, garageAvailable: undefined })]);

    expect(screen.queryByText(/Na skladě jen/)).not.toBeInTheDocument();
  });

  it('totals both columns in the footer', () => {
    renderCard([
      line({ id: 'l-1', supplierGoodId: 'g-a', quantity: 4, quantityFromGarage: 1 }),
      line({ id: 'l-2', supplierGoodId: 'g-b', name: 'Přepravka', quantity: 6, quantityFromGarage: 6 }),
    ]);

    const footer = screen.getByText('Celkem').parentElement as HTMLElement;
    // 1 + 6 from the garage, 3 + 0 from suppliers.
    expect(within(footer).getByText('7')).toBeInTheDocument();
    expect(within(footer).getByText('3 ks')).toBeInTheDocument();
  });
});
