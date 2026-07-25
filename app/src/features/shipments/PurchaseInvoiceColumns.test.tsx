// Rendering behaviour of the brewery-invoice columns. The arithmetic is covered by
// purchaseSplitModel.test.ts; this file covers what only the components decide:
// which cells are editable, what a caps-exceeding entry commits, and when the
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

function invoice(sequence: number, id: string, lines: Array<[string, number]> = [], label?: string) {
  const dto = new OutgoingShipmentPurchaseInvoiceDto();
  dto.id = id;
  dto.sequence = sequence;
  dto.label = label;
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
  onSet?: (invoiceId: string, quantity: number) => void;
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
  it('shows the remainder as text and the rest as inputs', () => {
    renderRowCells({});

    expect(screen.getByText('20')).toBeTruthy();
    const input = screen.getByLabelText('Kusy na faktuře 2') as HTMLInputElement;
    expect(input.value).toBe('4');
  });

  it('commits a typed quantity on blur', () => {
    const onSet = vi.fn();
    renderRowCells({ onSet });

    const input = screen.getByLabelText('Kusy na faktuře 2');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith('i2', 9);
  });

  it('clamps an entry above what the run buys', () => {
    // The server clamps too, but silently — a field that takes 99 and then shows
    // 20 after a refetch reads as a bug.
    const onSet = vi.fn();
    renderRowCells({ onSet });

    const input = screen.getByLabelText('Kusy na faktuře 2') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith('i2', 24);
    expect(input.value).toBe('24');
  });

  it('caps against the other invoices, not just the total', () => {
    const onSet = vi.fn();
    renderRowCells({
      invoices: [invoice(1, 'i1'), invoice(2, 'i2', [[LEZAK, 4]]), invoice(3, 'i3', [[LEZAK, 6]])],
      onSet,
    });

    const input = screen.getByLabelText('Kusy na faktuře 2');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith('i2', 18);
  });

  it('does not fire when the value is unchanged', () => {
    const onSet = vi.fn();
    renderRowCells({ onSet });

    fireEvent.blur(screen.getByLabelText('Kusy na faktuře 2'));

    expect(onSet).not.toHaveBeenCalled();
  });

  it('offers no input for a row bought entirely from our own stock', () => {
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
  onLabel?: (invoiceId: string, label: string) => void;
  onDelete?: (invoiceId: string) => void;
}) {
  return render(
    <MuiThemeProvider theme={theme}>
      <table><thead><tr>
        <PurchaseInvoiceHeaderCells
          invoices={props.invoices ?? [invoice(1, 'i1'), invoice(2, 'i2')]}
          editable={props.editable ?? true}
          onLabel={props.onLabel ?? vi.fn()}
          onDelete={props.onDelete ?? vi.fn()}
        />
      </tr></thead></table>
    </MuiThemeProvider>,
  );
}

describe('PurchaseInvoiceHeaderCells', () => {
  it('cannot delete the remainder invoice', () => {
    renderHeaderCells({});

    expect(screen.queryByLabelText('Smazat fakturu 1')).toBeNull();
    expect(screen.getByLabelText('Smazat fakturu 2')).toBeTruthy();
  });

  it('deletes the invoice it is asked about', () => {
    const onDelete = vi.fn();
    renderHeaderCells({ onDelete });

    fireEvent.click(screen.getByLabelText('Smazat fakturu 2'));

    expect(onDelete).toHaveBeenCalledWith('i2');
  });

  it('commits a changed label on blur', () => {
    const onLabel = vi.fn();
    renderHeaderCells({ onLabel });

    const fields = screen.getAllByPlaceholderText('č. faktury');
    fireEvent.change(fields[1], { target: { value: '2026-0453' } });
    fireEvent.blur(fields[1]);

    expect(onLabel).toHaveBeenCalledWith('i2', '2026-0453');
  });

  it('offers no editing controls on a closed shipment', () => {
    renderHeaderCells({ invoices: [invoice(1, 'i1'), invoice(2, 'i2', [], '2026-0453')], editable: false });

    expect(screen.queryByPlaceholderText('č. faktury')).toBeNull();
    expect(screen.queryByLabelText('Smazat fakturu 2')).toBeNull();
    expect(screen.getByText('2026-0453')).toBeTruthy();
  });
});
