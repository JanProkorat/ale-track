// Rendering behaviour of the brewery-invoice columns. The arithmetic is covered by
// purchaseSplitModel.test.ts; this file covers what only the components decide:
// which cells are editable, what a cap-exceeding entry commits, and when the
// delete control appears.

// fireEvent rather than user-event: the latter is not a dependency of this project.
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { OutgoingShipmentPurchaseInvoiceDto, OutgoingShipmentPurchaseInvoiceLineDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { PurchaseInvoiceHeaderCells, PurchaseInvoiceRowCells } from './PurchaseInvoiceColumns';
import type { PurchasableRow } from './purchaseSplitModel';

const LEZAK = 'p-lezak';

function invoice(sequence: number, id: string, lines: Array<[string, number]> = []) {
  const dto = new OutgoingShipmentPurchaseInvoiceDto();
  dto.id = id;
  dto.sequence = sequence;
  dto.lines = lines.map(([productId, quantity]) => {
    const line = new OutgoingShipmentPurchaseInvoiceLineDto();
    line.productId = productId;
    line.quantity = quantity;
    return line;
  });
  return dto;
}

function row(over: Partial<PurchasableRow> = {}): PurchasableRow {
  return { productId: LEZAK, orderQuantity: 24, fromInventory: 0, stockPurchaseQuantity: 0, ...over };
}

function renderRowCells(props: {
  row?: PurchasableRow;
  invoices?: OutgoingShipmentPurchaseInvoiceDto[];
  editable?: boolean;
  onSet?: (sequence: number, quantity: number) => void;
}) {
  const invoices = props.invoices ?? [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]])];
  return render(
    <MuiThemeProvider theme={theme}>
      <table><tbody><tr>
        <PurchaseInvoiceRowCells
          row={props.row ?? row()}
          invoices={invoices}
          editable={props.editable ?? true}
          onSet={props.onSet ?? vi.fn()}
        />
      </tr></tbody></table>
    </MuiThemeProvider>,
  );
}

describe('PurchaseInvoiceRowCells', () => {
  it('shows the remainder as text and the rest as steppers', () => {
    renderRowCells({});

    expect(screen.getByText('20')).toBeTruthy();
    expect((screen.getByLabelText('Kusy na faktuře 2') as HTMLInputElement).value).toBe('4');
  });

  it('offers a second column on a shipment with no invoices yet', () => {
    // Writing to it materialises the invoice server-side; the column is there first.
    const onSet = vi.fn();
    renderRowCells({ invoices: [], onSet });

    const input = screen.getByLabelText('Kusy na faktuře 2') as HTMLInputElement;
    expect(input.value).toBe('0');
    expect(screen.getByText('24')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Kusy na faktuře 2 — přidat'));
    expect(onSet).toHaveBeenCalledWith(2, 1);
  });

  it('steps by one in each direction', () => {
    const onSet = vi.fn();
    renderRowCells({ onSet });

    fireEvent.click(screen.getByLabelText('Kusy na faktuře 2 — přidat'));
    expect(onSet).toHaveBeenLastCalledWith(2, 5);

    fireEvent.click(screen.getByLabelText('Kusy na faktuře 2 — ubrat'));
    expect(onSet).toHaveBeenLastCalledWith(2, 3);
  });

  it('cannot step below zero or above the cap', () => {
    renderRowCells({ invoices: [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 0]])] });
    expect((screen.getByLabelText('Kusy na faktuře 2 — ubrat') as HTMLButtonElement).disabled).toBe(true);

    renderRowCells({ invoices: [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 24]])] });
    expect((screen.getAllByLabelText('Kusy na faktuře 2 — přidat')[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('commits a typed quantity on blur', () => {
    const onSet = vi.fn();
    renderRowCells({ onSet });

    const input = screen.getByLabelText('Kusy na faktuře 2');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith(2, 9);
  });

  it('clamps an entry above what the run buys', () => {
    // The server clamps too, but silently — a field that takes 99 and then shows
    // 24 after a refetch reads as a bug.
    const onSet = vi.fn();
    renderRowCells({ onSet });

    const input = screen.getByLabelText('Kusy na faktuře 2') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith(2, 24);
    expect(input.value).toBe('24');
  });

  it('caps against the other columns, not just the total', () => {
    const onSet = vi.fn();
    renderRowCells({
      invoices: [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]]), invoice(3, 'i3', [[LEZAK, 6]])],
      onSet,
    });

    const input = screen.getByLabelText('Kusy na faktuře 2');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith(2, 18);
  });

  it('does not fire when the value is unchanged', () => {
    const onSet = vi.fn();
    renderRowCells({ onSet });

    fireEvent.blur(screen.getByLabelText('Kusy na faktuře 2'));

    expect(onSet).not.toHaveBeenCalled();
  });

  it('offers no stepper for a row bought entirely from our own stock', () => {
    renderRowCells({ row: row({ orderQuantity: 12, fromInventory: 12 }) });

    expect(screen.queryByLabelText('Kusy na faktuře 2')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('is read-only for a shipment that can no longer be edited', () => {
    renderRowCells({ editable: false });

    expect(screen.queryByLabelText('Kusy na faktuře 2')).toBeNull();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });
});

function renderHeaderCells(props: {
  invoices?: OutgoingShipmentPurchaseInvoiceDto[];
  editable?: boolean;
  onDelete?: (invoiceId: string) => void;
}) {
  return render(
    <MuiThemeProvider theme={theme}>
      <table><thead><tr>
        <PurchaseInvoiceHeaderCells
          invoices={props.invoices ?? [invoice(1, 'i1'), invoice(2, 'i2')]}
          editable={props.editable ?? true}
          onDelete={props.onDelete ?? vi.fn()}
        />
      </tr></thead></table>
    </MuiThemeProvider>,
  );
}

describe('PurchaseInvoiceHeaderCells', () => {
  it('labels the columns short enough to stay on one line', () => {
    renderHeaderCells({});

    expect(screen.getByText('F1')).toBeTruthy();
    expect(screen.getByText('F2')).toBeTruthy();
  });

  it('cannot delete the remainder invoice', () => {
    renderHeaderCells({});

    expect(screen.queryByLabelText('Smazat fakturu 1')).toBeNull();
    expect(screen.getByLabelText('Smazat fakturu 2')).toBeTruthy();
  });

  it('offers no delete on a column with no invoice behind it', () => {
    renderHeaderCells({ invoices: [] });

    expect(screen.getByText('F2')).toBeTruthy();
    expect(screen.queryByLabelText('Smazat fakturu 2')).toBeNull();
  });

  it('deletes the invoice it is asked about', () => {
    const onDelete = vi.fn();
    renderHeaderCells({ onDelete });

    fireEvent.click(screen.getByLabelText('Smazat fakturu 2'));

    expect(onDelete).toHaveBeenCalledWith('i2');
  });

  it('offers no editing controls on a closed shipment', () => {
    renderHeaderCells({ editable: false });

    expect(screen.queryByLabelText('Smazat fakturu 2')).toBeNull();
  });
});
