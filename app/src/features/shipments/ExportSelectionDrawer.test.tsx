// Choosing what an export carries. The rules worth pinning are all about the preselection:
// it has to follow the export stamps, and it must not be rewritten under the office's hands
// by a refetch (the invoices query refetches on window focus).

import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InvoiceLineSourceKind,
  ProductKind,
  ShipmentInvoiceConfirmationDto,
  ShipmentInvoiceDto,
  ShipmentInvoiceLineDto,
  ShipmentInvoicesDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

let invoicesResponse: ShipmentInvoicesDto | undefined;
let queryState = { isLoading: false, isError: false };

vi.mock('src/hooks/useShipmentInvoices', () => ({
  useShipmentInvoices: () => ({ data: invoicesResponse, ...queryState }),
}));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

const { ExportSelectionDrawer } = await import('./ExportSelectionDrawer');

const KOUT = 'client-kout';
const LVA = 'client-lva';
const BESEDA = 'client-beseda';

function invoice(
  clientId: string,
  clientName: string,
  quantity: number,
  clientBusinessName?: string,
): ShipmentInvoiceDto {
  return new ShipmentInvoiceDto({
    id: `inv-${clientId}`,
    clientId,
    clientName,
    clientBusinessName,
    sequence: 1,
    stopOrder: 1,
    lines: [
      new ShipmentInvoiceLineDto({
        id: `line-${clientId}`,
        sourceKind: InvoiceLineSourceKind.OrderItem,
        sourceItemId: `item-${clientId}`,
        name: 'Albrecht 12°',
        kind: ProductKind.Keg,
        packageSize: 30,
        priceWithVat: 100,
        quantity,
        orderingClientId: clientId,
        orderingClientName: clientName,
        isFromStock: false,
      }),
    ],
  });
}

/** A run with three rows: two confirmed (Lva #1, Kout #2) and Beseda not confirmed at all. */
function split(over: { lvaExportedAt?: Date; koutExportedAt?: Date } = {}) {
  return new ShipmentInvoicesDto({
    isEditable: true,
    adjustments: [],
    invoices: [
      invoice(LVA, 'Hospoda U Lva', 10, 'U Lva gastro s.r.o.'),
      invoice(KOUT, 'Pivovar Kout', 7),
      invoice(BESEDA, 'Beseda', 4),
    ],
    confirmations: [
      new ShipmentInvoiceConfirmationDto({
        clientId: LVA, number: 1, isReady: true, lastExportedAt: over.lvaExportedAt,
      }),
      new ShipmentInvoiceConfirmationDto({
        clientId: KOUT, number: 2, isReady: true, lastExportedAt: over.koutExportedAt,
      }),
    ],
  });
}

const onExport = vi.fn();
const onClose = vi.fn();

function renderDrawer(open = true, busy = false) {
  return render(
    <MuiThemeProvider theme={theme}>
      <ExportSelectionDrawer
        open={open}
        shipmentId="ship-1"
        busy={busy}
        onClose={onClose}
        onExport={onExport}
      />
    </MuiThemeProvider>,
  );
}

/** The chosen ids of the one export that was fired. */
function exportedIds(): string[] {
  expect(onExport).toHaveBeenCalledTimes(1);
  return onExport.mock.calls[0][1];
}

beforeEach(() => {
  vi.clearAllMocks();
  queryState = { isLoading: false, isError: false };
  invoicesResponse = split();
});

describe('which rows it offers', () => {
  it('lists the confirmed rows and leaves the unconfirmed ones out', () => {
    renderDrawer();

    expect(screen.getByText('Hospoda U Lva')).toBeInTheDocument();
    expect(screen.getByText('Pivovar Kout')).toBeInTheDocument();
    // Beseda has no confirmed row, so it has nothing in the file to choose.
    expect(screen.queryByText('Beseda')).not.toBeInTheDocument();
  });

  it('says so when nothing on the run is confirmed', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [], invoices: [invoice(KOUT, 'Pivovar Kout', 7)], confirmations: [],
    });

    renderDrawer();

    expect(screen.getByText(/Žádná objednávka není označená jako hotová/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
  });

  // Two clients can genuinely share a name; the trading name is what tells them apart, and the
  // office has to be able to read it before ticking a row into a file.
  it("shows the client's trading name beside its name, and nothing when it has none", () => {
    renderDrawer();

    expect(within(screen.getByTestId(`export-row-${LVA}`)).getByText(/U Lva gastro s\.r\.o\./))
      .toBeInTheDocument();
    // Kout has none, so its row carries its name alone — no separator, nothing after it.
    expect(within(screen.getByTestId(`export-row-${KOUT}`)).queryByText(/·/)).not.toBeInTheDocument();
  });

  it('reports a failed load rather than an empty list', () => {
    invoicesResponse = undefined;
    queryState = { isLoading: false, isError: true };

    renderDrawer();

    expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument();
  });
});

describe('the preselection', () => {
  it('ticks the rows that have never been exported', () => {
    invoicesResponse = split({ lvaExportedAt: new Date('2026-08-23T19:40:00Z') });

    renderDrawer();

    expect(screen.getByRole('checkbox', { name: 'Hospoda U Lva' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pivovar Kout' })).toBeChecked();
  });

  it('ticks nothing when every row has already gone out, and offers no export', () => {
    invoicesResponse = split({
      lvaExportedAt: new Date('2026-08-23T19:40:00Z'),
      koutExportedAt: new Date('2026-08-23T19:40:00Z'),
    });

    renderDrawer();

    expect(screen.getByRole('checkbox', { name: 'Hospoda U Lva' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pivovar Kout' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Word' })).toBeDisabled();
  });

  it('says when an already-exported row last went out', () => {
    invoicesResponse = split({ lvaExportedAt: new Date('2026-08-23T19:40:00Z') });

    renderDrawer();

    expect(screen.getByText(/Exportováno 23\. 8\./)).toBeInTheDocument();
    expect(screen.getByText('Zatím neexportováno')).toBeInTheDocument();
  });

  // The query refetches on window focus, and re-seeding on every result would silently undo the
  // office's ticks between choosing and exporting.
  it('keeps a hand-made selection across a refetch', () => {
    const { rerender } = renderDrawer();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hospoda U Lva' }));
    expect(screen.getByRole('checkbox', { name: 'Hospoda U Lva' })).not.toBeChecked();

    // A fresh response object with the same content, as a refetch hands back.
    invoicesResponse = split();
    rerender(
      <MuiThemeProvider theme={theme}>
        <ExportSelectionDrawer
          open
          shipmentId="ship-1"
          busy={false}
          onClose={onClose}
          onExport={onExport}
        />
      </MuiThemeProvider>,
    );

    expect(screen.getByRole('checkbox', { name: 'Hospoda U Lva' })).not.toBeChecked();
  });
});

describe('exporting', () => {
  it('hands the ticked rows to the format that was chosen', () => {
    invoicesResponse = split({ lvaExportedAt: new Date('2026-08-23T19:40:00Z') });

    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Word' }));

    expect(onExport.mock.calls[0][0]).toBe('word');
    expect(exportedIds()).toEqual([KOUT]);
  });

  // The whole point of the drawer: an already-exported row can be sent again on purpose.
  it('can include a row that has already been exported', () => {
    invoicesResponse = split({ lvaExportedAt: new Date('2026-08-23T19:40:00Z') });

    renderDrawer();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hospoda U Lva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    expect(exportedIds()).toEqual([KOUT, LVA]);
  });

  it('ticks and unticks every row at once', () => {
    invoicesResponse = split({
      lvaExportedAt: new Date('2026-08-23T19:40:00Z'),
      koutExportedAt: new Date('2026-08-23T19:40:00Z'),
    });

    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Označit vše' }));

    expect(screen.getByRole('checkbox', { name: 'Hospoda U Lva' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pivovar Kout' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Odznačit vše' }));

    expect(screen.getByRole('checkbox', { name: 'Hospoda U Lva' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
  });

  it('counts what is ticked against what there is', () => {
    invoicesResponse = split({ lvaExportedAt: new Date('2026-08-23T19:40:00Z') });

    renderDrawer();

    expect(screen.getByText('1 z 2 objednávek')).toBeInTheDocument();
  });

  // Generating the file is a server round trip; a live button invites a second one.
  it('locks both formats while an export is running', () => {
    renderDrawer(true, true);

    expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Word' })).toBeDisabled();
  });

  it('shows each row with its number, pieces and value', () => {
    renderDrawer();

    const row = screen.getByTestId(`export-row-${LVA}`);
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByText('10 ks')).toBeInTheDocument();
    expect(within(row).getByText('1000 Kč')).toBeInTheDocument();
  });
});
