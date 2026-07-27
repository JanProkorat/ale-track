// The two garage cards are views of the nakládka's own numbers, so what matters is
// which rows each one picks and which of a row's several quantities it shows —
// a row can be ordered, part-sourced from the garage and bought for it at once.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { ProductKind } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { GarageCard } from './ShipmentDetail';

type Row = Parameters<typeof GarageCard>[0]['rows'][number];

function row(over: Partial<Row> & { name: string }): Row {
  return {
    key: over.name,
    quantity: 0,
    orderQuantity: 0,
    stockPurchaseQuantity: 0,
    fromInventory: 0,
    stockPurchase: false,
    sources: [],
    ...over,
  } as Row;
}

function renderCard(props: Partial<Parameters<typeof GarageCard>[0]> = {}) {
  return render(
    <MuiThemeProvider theme={theme}>
      <GarageCard
        title="Vyložit"
        icon={null}
        rows={props.rows ?? []}
        quantityOf={props.quantityOf ?? ((r) => r.stockPurchaseQuantity)}
        emptyText={props.emptyText ?? 'Nic se do garáže nevykládá.'}
        {...props}
      />
    </MuiThemeProvider>,
  );
}

describe('GarageCard', () => {
  it('lists only rows with a quantity for this direction', () => {
    renderCard({
      rows: [
        row({ name: 'Ležák', stockPurchaseQuantity: 4 }),
        row({ name: 'Jedenáctka', orderQuantity: 10 }),
      ],
    });

    expect(screen.getByText('Ležák')).toBeTruthy();
    expect(screen.queryByText('Jedenáctka')).toBeNull();
  });

  it('shows the direction’s own quantity, not the row total', () => {
    // 12 in the van, of which 5 came off our shelf: the Doložit card is about the 5.
    renderCard({
      title: 'Doložit',
      quantityOf: (r) => r.fromInventory,
      rows: [row({ name: 'Ležák', quantity: 12, orderQuantity: 12, fromInventory: 5 })],
    });

    // Header total and the only row both read "5 ks"; the point is that 12 appears nowhere.
    expect(screen.getAllByText('5 ks')).toHaveLength(2);
    expect(screen.queryByText('12 ks')).toBeNull();
  });

  it('totals the listed quantities in the header', () => {
    renderCard({
      rows: [
        row({ name: 'Ležák', stockPurchaseQuantity: 4 }),
        row({ name: 'Desítka', stockPurchaseQuantity: 3 }),
        row({ name: 'Nic', orderQuantity: 9 }),
      ],
    });

    expect(screen.getByText('7 ks')).toBeTruthy();
  });

  it('carries the kind and package size', () => {
    renderCard({ rows: [row({ name: 'Ležák', kind: ProductKind.Keg, packageSize: 30, stockPurchaseQuantity: 2 })] });

    expect(screen.getByText('Sud · 30 l')).toBeTruthy();
  });

  it('says so when there is nothing in this direction', () => {
    renderCard({ rows: [row({ name: 'Jedenáctka', orderQuantity: 10 })] });

    expect(screen.getByText('Nic se do garáže nevykládá.')).toBeTruthy();
  });

  it('keeps the same row apart in the two directions', () => {
    // One product both taken from the garage and bought for it.
    const rows = [row({ name: 'Ležák', orderQuantity: 6, fromInventory: 2, stockPurchaseQuantity: 9 })];

    const unload = renderCard({ rows });
    expect(within(unload.container).getAllByText('9 ks').length).toBeGreaterThan(0);
    expect(within(unload.container).queryByText('2 ks')).toBeNull();

    const load = renderCard({ title: 'Doložit', quantityOf: (r) => r.fromInventory, rows });
    expect(within(load.container).getAllByText('2 ks').length).toBeGreaterThan(0);
  });
});
