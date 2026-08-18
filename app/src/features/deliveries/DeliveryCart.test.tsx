import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierChargeKind } from 'src/generated/api-client';
import { DeliveryCart } from './DeliveryCart';
import type { CartRow } from './deliveryCartModel';

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

function row(over: Partial<CartRow> = {}): CartRow {
  return {
    key: 'stop-b:p:p1',
    stopKey: 'stop-b',
    line: { source: 'product', productId: 'p1', quantity: 1 },
    name: 'Svijanská Desítka',
    color: '#C22A2A',
    details: ['Plechovka', '0,5 l'],
    unitPrice: 25,
    quantity: 1,
    note: '',
    ...over,
  };
}

function goodRow(over: Partial<CartRow> = {}): CartRow {
  return row({
    key: 'stop-s:g:g1:Fill',
    stopKey: 'stop-s',
    line: { source: 'good', supplierGoodId: 'g1', chargeKind: SupplierChargeKind.Fill, quantity: 1 },
    name: 'CO₂ láhev',
    details: ['Plnění', '10 kg'],
    unitPrice: 640,
    ...over,
  });
}

function renderCart(rows: CartRow[], handlers: Partial<{
  onChangeQuantity: (row: CartRow, delta: number) => void;
  onChangeNote: (row: CartRow, note: string) => void;
  onRemove: (row: CartRow) => void;
}> = {}) {
  const props = {
    onChangeQuantity: vi.fn(),
    onChangeNote: vi.fn(),
    onRemove: vi.fn(),
    ...handlers,
  };
  render(<DeliveryCart rows={rows} {...props} />);
  return props;
}

describe('DeliveryCart', () => {
  it('shows the empty state with no lines', () => {
    renderCart([]);

    expect(screen.getByText('Košík je prázdný')).toBeInTheDocument();
    expect(screen.queryByText('Celkem s DPH')).not.toBeInTheDocument();
  });

  it('counts units across products and goods in its head', () => {
    renderCart([row({ quantity: 2 }), goodRow({ quantity: 1 })]);

    expect(screen.getByText('3 ks')).toBeInTheDocument();
  });

  it('shows each line with its details and line total', () => {
    renderCart([row({ quantity: 2 })]);

    expect(screen.getByText('Svijanská Desítka')).toBeInTheDocument();
    expect(screen.getByText('Plechovka · 0,5 l · 50 Kč')).toBeInTheDocument();
  });

  it('shows a good line by its charge kind and size', () => {
    renderCart([goodRow()]);

    expect(screen.getByText('Plnění · 10 kg · 640 Kč')).toBeInTheDocument();
  });

  it('totals the cart with VAT', () => {
    renderCart([row({ quantity: 2 }), goodRow()]);

    expect(screen.getByText('690 Kč')).toBeInTheDocument();
  });

  /** A line whose catalogue is still loading keeps its row; only its price is missing. */
  it('shows an unpriced line without a total for it', () => {
    renderCart([goodRow({ unitPrice: null, name: '—', details: ['Plnění'] })]);

    expect(screen.getByText('Plnění')).toBeInTheDocument();
    expect(screen.getByText('0 Kč')).toBeInTheDocument();
  });

  it('reports which row the plus and minus belong to', () => {
    const rows = [row(), goodRow()];
    const { onChangeQuantity } = renderCart(rows);

    fireEvent.click(screen.getByLabelText('Přidat CO₂ láhev'));
    expect(onChangeQuantity).toHaveBeenCalledWith(rows[1], 1);

    fireEvent.click(screen.getByLabelText('Ubrat Svijanská Desítka'));
    expect(onChangeQuantity).toHaveBeenCalledWith(rows[0], -1);
  });

  it('reports a removal for the row it was pressed on', () => {
    const rows = [row(), goodRow()];
    const { onRemove } = renderCart(rows);

    fireEvent.click(screen.getByLabelText('Odebrat CO₂ láhev'));

    expect(onRemove).toHaveBeenCalledWith(rows[1]);
  });

  /** The note field is the only place a line's note can be written, so it has to be reachable. */
  it('reveals a note field on demand and reports what is typed', () => {
    const rows = [goodRow()];
    const { onChangeNote } = renderCart(rows);

    expect(screen.queryByLabelText('Poznámka k položce CO₂ láhev')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Přidat poznámku k CO₂ láhev'));
    const field = screen.getByLabelText('Poznámka k položce CO₂ láhev');
    fireEvent.change(field, { target: { value: 'vyměnit za prázdné' } });

    expect(onChangeNote).toHaveBeenCalledWith(rows[0], 'vyměnit za prázdné');
  });

  /** A note somebody has written must never be hidden behind a toggle. */
  it('shows a line that already has a note without being asked', () => {
    renderCart([goodRow({ note: 'vyměnit za prázdné' })]);

    expect(screen.getByLabelText('Poznámka k položce CO₂ láhev')).toHaveValue('vyměnit za prázdné');
  });
});
