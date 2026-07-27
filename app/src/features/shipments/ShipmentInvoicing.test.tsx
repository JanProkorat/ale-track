// Rendering behaviour of the Fakturace section. The shaping logic is covered by
// shipmentInvoiceModel.test.ts; this file covers what only the component decides:
// when the per-invoice sub-header appears, the drift banner, the read-only state,
// and the move dialog's per-origin quantity cap.

// fireEvent rather than user-event: the latter is not a dependency of this project
// and adding one for a test file is not worth it. MUI's Select opens on mouseDown.
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InvoiceAdjustmentKind,
  InvoiceLineSourceKind,
  ProductKind,
  ShipmentInvoiceDto,
  ShipmentInvoiceLineDto,
  ShipmentInvoicesDto,
  type OutgoingShipmentStopDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const moveMutate = vi.fn();
const addMutate = vi.fn();
const deleteMutate = vi.fn();
let invoicesResponse: ShipmentInvoicesDto | undefined;
// The query can also be loading or failed. An earlier version of the mock always handed
// back a response, which is why it could not catch the crash on a missing one.
let queryState: { isLoading: boolean; isError: boolean; error?: unknown } =
  { isLoading: false, isError: false };

vi.mock('src/hooks/useShipmentInvoices', () => ({
  useShipmentInvoices: () => ({ data: invoicesResponse, ...queryState }),
  useMoveInvoiceLine: () => ({ mutate: moveMutate, isPending: false }),
  useAddShipmentInvoice: () => ({ mutate: addMutate, isPending: false }),
  useDeleteShipmentInvoice: () => ({ mutate: deleteMutate, isPending: false }),
}));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const { ShipmentInvoicing } = await import('./ShipmentInvoicing');

const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';
const ALE = 'prod-ale';

function line(over: Partial<ShipmentInvoiceLineDto> = {}): ShipmentInvoiceLineDto {
  return new ShipmentInvoiceLineDto({
    id: `line-${Math.random().toString(36).slice(2, 8)}`,
    sourceKind: InvoiceLineSourceKind.OrderItem,
    sourceItemId: `item-${Math.random().toString(36).slice(2, 8)}`,
    productId: ALE,
    name: 'Albrecht 12°',
    kind: ProductKind.Keg,
    packageSize: 30,
    priceWithVat: 100,
    quantity: 1,
    orderingClientId: CLIENT_A,
    orderingClientName: 'Klient A',
    isFromStock: false,
    ...over,
  });
}

function invoice(over: Partial<ShipmentInvoiceDto> = {}): ShipmentInvoiceDto {
  return new ShipmentInvoiceDto({
    id: `inv-${Math.random().toString(36).slice(2, 8)}`,
    clientId: CLIENT_A,
    clientName: 'Klient A',
    sequence: 1,
    stopOrder: 1,
    lines: [],
    ...over,
  });
}

function renderSection(editable = true, stops: OutgoingShipmentStopDto[] = []) {
  return render(
    <MuiThemeProvider theme={theme}>
      <ShipmentInvoicing shipmentId="ship-1" editable={editable} stops={stops} />
    </MuiThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  queryState = { isLoading: false, isError: false };
  invoicesResponse = new ShipmentInvoicesDto({
    isEditable: true,
    adjustments: [],
    invoices: [invoice({ lines: [line({ quantity: 10 })] })],
  });
});

describe('client bands', () => {
  it('shows one band per client, with the counts left to the section total', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, lines: [line({ quantity: 10, priceWithVat: 100 })] }),
        invoice({ clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, lines: [line({ quantity: 4, priceWithVat: 100, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' })] }),
      ],
    });

    renderSection();

    expect(screen.getByText('Klient A')).toBeInTheDocument();
    expect(screen.getByText('Klient B')).toBeInTheDocument();
    expect(screen.getByText('2 faktury · 2 klienti')).toBeInTheDocument();

    // The per-band rollup was removed deliberately: it repeats on every invoice
    // sub-header and in the section total above. Guarded so it does not creep
    // back in.
    expect(screen.queryByText(/1 faktura · 10 ks/)).not.toBeInTheDocument();
  });

  it('omits the per-invoice sub-header when the client has only one invoice', () => {
    renderSection();

    expect(screen.queryByText('Faktura 1')).not.toBeInTheDocument();
  });

  it('labels each invoice once the client has two', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ sequence: 1, lines: [line({ quantity: 6 })] }),
        invoice({ sequence: 2, lines: [line({ quantity: 4 })] }),
      ],
    });

    renderSection();

    expect(screen.getByText('Faktura 1')).toBeInTheDocument();
    expect(screen.getByText('Faktura 2')).toBeInTheDocument();
  });

  it('shows an empty-state row for an invoice with no lines', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ sequence: 1, lines: [line({ quantity: 6 })] }), invoice({ sequence: 2, lines: [] })],
    });

    renderSection();

    expect(screen.getByText(/Zatím bez položek/)).toBeInTheDocument();
  });

  it('collapses a band and leaves its siblings open', async () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, lines: [line({ name: 'Albrecht 12°', quantity: 3 })] }),
        invoice({ clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, lines: [line({ name: 'Lager 50', quantity: 5, orderingClientId: CLIENT_B })] }),
      ],
    });
    renderSection();

    fireEvent.click(screen.getAllByRole('button', { name: 'Sbalit' })[0]);

    // The panel animates out, so it is still mounted for the duration of the transition.
    await waitForElementToBeRemoved(() => screen.queryByText('Albrecht 12°'));
    expect(screen.getByText('Lager 50')).toBeInTheDocument();
  });

  it('animates the panel out rather than removing it instantly', () => {
    renderSection();
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sbalit' }));

    // Still present immediately after the click — that is the transition running. Without
    // the Collapse wrapper this row would already be gone.
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
  });

  it('offers collapse-all only when there is more than one client', async () => {
    renderSection();
    expect(screen.queryByRole('button', { name: /Sbalit vše/ })).not.toBeInTheDocument();

    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ clientId: CLIENT_A, stopOrder: 1, lines: [line({ quantity: 1 })] }),
        invoice({ clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, lines: [line({ quantity: 1, orderingClientId: CLIENT_B })] }),
      ],
    });
    const { unmount } = renderSection();

    const collapseAll = screen.getByRole('button', { name: /Sbalit vše/ });
    fireEvent.click(collapseAll);
    await waitFor(() => expect(screen.getByRole('button', { name: /Rozbalit vše/ })).toBeInTheDocument());
    unmount();
  });
});

describe('provenance chips', () => {
  it('marks a fully stock-sourced row', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [],
      invoices: [invoice({ lines: [line({ quantity: 4, isFromStock: true, sourceKind: InvoiceLineSourceKind.OrderItem })] })],
    });

    renderSection();

    expect(screen.getByText('ze skladu')).toBeInTheDocument();
  });

  it('states how many pieces came from stock when the row mixes sources', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [],
      invoices: [invoice({
        lines: [
          line({ quantity: 10, sourceItemId: 'ordered' }),
          line({ quantity: 4, sourceItemId: 'stock', isFromStock: true, sourceKind: InvoiceLineSourceKind.OrderItem }),
        ],
      })],
    });

    renderSection();

    expect(screen.getByText('4 ks ze skladu')).toBeInTheDocument();
    expect(screen.getByText('14 ks')).toBeInTheDocument();
  });

  it('marks a cross-billed portion with its ordering client and count', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [],
      invoices: [invoice({
        clientId: CLIENT_A,
        lines: [
          line({ quantity: 5, sourceItemId: 'own' }),
          line({ quantity: 2, sourceItemId: 'foreign', orderingClientId: CLIENT_B, orderingClientName: 'Klient B' }),
        ],
      })],
    });

    renderSection();

    expect(screen.getByText('2 ks z obj. Klient B')).toBeInTheDocument();
    expect(screen.getByText('1 položka fakturována jinému klientovi')).toBeInTheDocument();
    expect(screen.getByText('1× přefakturováno')).toBeInTheDocument();
  });

  it('omits the piece count on an unmerged cross-billed row', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [],
      invoices: [invoice({ clientId: CLIENT_A, lines: [line({ quantity: 3, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' })] })],
    });

    renderSection();

    expect(screen.getByText('z obj. Klient B')).toBeInTheDocument();
  });
});

describe('drift banner', () => {
  it('reports what reconciliation changed and can be dismissed', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      invoices: [invoice({ lines: [line({ quantity: 6 })] })],
      adjustments: [
        { kind: InvoiceAdjustmentKind.QuantityRemoved, sourceKind: InvoiceLineSourceKind.OrderItem, itemName: 'Albrecht 12°', quantity: 4 } as never,
      ],
    });

    renderSection();

    expect(screen.getByText(/rozdělení na faktury bylo upraveno/)).toBeInTheDocument();
    expect(screen.getByText('Albrecht 12° — odebráno 4 ks (nejdřív ze soukromých, pak z přefakturovaných)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skrýt hlášení' }));

    expect(screen.queryByText(/rozdělení na faktury bylo upraveno/)).not.toBeInTheDocument();
  });

  it('stays hidden when nothing drifted', () => {
    renderSection();

    expect(screen.queryByText(/rozdělení na faktury bylo upraveno/)).not.toBeInTheDocument();
  });

  it('words an added quantity and a removed source distinctly', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      invoices: [invoice({ lines: [line({ quantity: 6 })] })],
      adjustments: [
        { kind: InvoiceAdjustmentKind.QuantityAdded, sourceKind: InvoiceLineSourceKind.OrderItem, itemName: 'Lager', quantity: 3 } as never,
        { kind: InvoiceAdjustmentKind.SourceRemoved, sourceKind: InvoiceLineSourceKind.OrderItem, itemName: 'Stout', quantity: 2 } as never,
      ],
    });

    renderSection();

    expect(screen.getByText('Lager — přidáno 3 ks na 1. fakturu objednavatele')).toBeInTheDocument();
    expect(screen.getByText('Stout — odebrána z nakládky, řádky faktur zrušeny (2 ks)')).toBeInTheDocument();
  });
});

describe('read-only state', () => {
  it('hides every action when the shipment is no longer editable', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: false, adjustments: [],
      invoices: [invoice({ sequence: 1, lines: [line({ quantity: 6 })] }), invoice({ sequence: 2, lines: [line({ quantity: 2 })] })],
    });

    renderSection();

    expect(screen.queryByRole('button', { name: /Faktura$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Přesunout kusy na jinou fakturu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Smazat fakturu' })).not.toBeInTheDocument();
  });

  it('hides actions when the caller says the shipment is read-only even if the server allows it', () => {
    renderSection(false);

    expect(screen.queryByRole('button', { name: 'Přesunout kusy na jinou fakturu' })).not.toBeInTheDocument();
  });

  it('never offers to delete a client first invoice', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [],
      invoices: [invoice({ sequence: 1, lines: [line({ quantity: 6 })] }), invoice({ sequence: 2, lines: [line({ quantity: 2 })] })],
    });

    renderSection();

    // Only the second invoice may be deleted.
    expect(screen.getAllByRole('button', { name: 'Smazat fakturu' })).toHaveLength(1);
  });
});

describe('move dialog', () => {
  beforeEach(() => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          id: 'inv-a', clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, sequence: 1,
          lines: [
            line({ id: 'l-own', sourceItemId: 'own', quantity: 5 }),
            line({ id: 'l-foreign', sourceItemId: 'foreign', quantity: 3, orderingClientId: CLIENT_B, orderingClientName: 'Klient B' }),
          ],
        }),
        invoice({ id: 'inv-b', clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, sequence: 1, lines: [] }),
      ],
    });
  });

  it('caps the quantity against the chosen source, not the merged row total', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    // The row totals 8 pieces from two sources...
    expect(within(dialog).getByText('8 ks')).toBeInTheDocument();
    // ...but the preselected (biggest) source only contributes 5.
    expect(within(dialog).getByText(/nejvýš 5 ks/)).toBeInTheDocument();
  });

  it('follows the cap when a different origin is picked', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Původ kusů' }));
    fireEvent.click(screen.getByRole('option', { name: 'z obj. Klient B — 3 ks' }));

    expect(within(dialog).getByText(/nejvýš 3 ks/)).toBeInTheDocument();
  });

  it('submits the chosen source, quantity and target', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    const qty = within(dialog).getByRole('spinbutton', { name: 'Počet kusů k přesunu' });
    fireEvent.change(qty, { target: { value: '2' } });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }));
    fireEvent.click(screen.getByRole('option', { name: 'Faktura 1 — 0 ks' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate).toHaveBeenCalledTimes(1);
    expect(moveMutate.mock.calls[0][0]).toEqual({
      fromInvoiceId: 'inv-a',
      sourceKind: InvoiceLineSourceKind.OrderItem,
      sourceItemId: 'own',
      quantity: 2,
      toInvoiceId: 'inv-b',
      toClientId: undefined,
    });
  });

  it('refuses a quantity above the chosen source', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    const qty = within(dialog).getByRole('spinbutton', { name: 'Počet kusů k přesunu' });
    fireEvent.change(qty, { target: { value: '99' } });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }));
    fireEvent.click(screen.getByRole('option', { name: 'Faktura 1 — 0 ks' }));

    expect(within(dialog).getByRole('button', { name: 'Přesunout' })).toBeDisabled();
    expect(moveMutate).not.toHaveBeenCalled();
  });

  it('opens with a target preselected and ready to submit', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Přesunout' })).toBeEnabled();
    // The default must be another invoice of the source's own client — never a silent
    // cross-billing to somebody else.
    expect(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }))
      .toHaveTextContent('+ nová faktura 2');
  });

  it('submits the preselected target without touching the dropdown', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate).toHaveBeenCalledTimes(1);
    expect(moveMutate.mock.calls[0][0]).toMatchObject({
      fromInvoiceId: 'inv-a',
      toClientId: CLIENT_A,
      toInvoiceId: undefined,
      quantity: 5,
    });
  });

  it('offers every other invoice plus a new one per client, ordered by route', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Cílová faktura' }));

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    // Group headings are rendered as disabled options; the selectable ones are the targets.
    expect(options.filter((o) => !o.hasAttribute('aria-disabled')).map((o) => o.textContent)).toEqual([
      '+ nová faktura 2',           // a second invoice for Klient A (the orderer)
      'Faktura 1 — 0 ks',           // Klient B's existing invoice
      '+ nová faktura 2',           // or a fresh one for Klient B
      'Soukromé (nefakturovat)',    // or no invoice at all
    ]);
    // The invoice being moved from is never a target.
    expect(screen.queryByRole('option', { name: /inv-a/ })).not.toBeInTheDocument();
  });
});

describe('private pieces', () => {
  beforeEach(() => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ id: 'inv-a', lines: [line({ quantity: 6, priceWithVat: 100 })] })],
      privateLines: [line({ id: 'line-priv', sourceItemId: 'item-1', quantity: 4, priceWithVat: 100 })],
    });
  });

  it('labels the excluded pieces and bills them to nobody', () => {
    renderSection();

    // One label for the block, not one per row — the rows sit directly under it.
    expect(screen.getByText('Soukromé · nefakturováno')).toBeInTheDocument();
    expect(screen.queryByText('soukromé')).not.toBeInTheDocument();
    // 6 of 10 pieces are billed; the private ones carry no value.
    expect(screen.getByText('fakturováno · 6 ks')).toBeInTheDocument();
    // Still called out inside the band. The band header no longer repeats it —
    // the header carries the client and the destination, nothing else.
    expect(screen.getByText('4 ks soukromě')).toBeInTheDocument();
  });

  it('says everything is split when nothing is private', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [], invoices: [invoice({ lines: [line({ quantity: 10 })] })],
    });

    renderSection();

    expect(screen.getByText('vše rozděleno · 10 ks')).toBeInTheDocument();
    expect(screen.queryByText('Soukromé · nefakturováno')).not.toBeInTheDocument();
  });

  it('marks pieces private through the move dialog', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }));
    fireEvent.click(screen.getByRole('option', { name: 'Soukromé (nefakturovat)' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate.mock.calls[0][0]).toMatchObject({
      fromInvoiceId: 'inv-a',
      toPrivate: true,
      toInvoiceId: undefined,
      toClientId: undefined,
      quantity: 6,
    });
  });

  it('takes pieces back out of private with no origin invoice', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Vrátit kusy na fakturu' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('ze soukromých kusů')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate.mock.calls[0][0]).toMatchObject({
      fromInvoiceId: undefined,
      toInvoiceId: 'inv-a',
      toPrivate: undefined,
      quantity: 4,
    });
  });

  it('does not offer keeping them private when they already are', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Vrátit kusy na fakturu' }));

    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Cílová faktura' }));

    expect(screen.queryByRole('option', { name: 'Soukromé (nefakturovat)' })).not.toBeInTheDocument();
  });

  it('offers no move buttons at all when the split is read-only', () => {
    renderSection(false);

    expect(screen.getByText('Soukromé · nefakturováno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vrátit kusy na fakturu' })).not.toBeInTheDocument();
  });
});

describe('add and delete', () => {
  it('adds an invoice for the band client', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: /Faktura$/ }));

    expect(addMutate).toHaveBeenCalledWith(CLIENT_A, expect.anything());
  });

  it('warns that a populated invoice returns its pieces before deleting', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true, adjustments: [],
      invoices: [invoice({ sequence: 1, lines: [line({ quantity: 6 })] }), invoice({ id: 'inv-2', sequence: 2, lines: [line({ quantity: 2 })] })],
    });
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Smazat fakturu' }));

    expect(screen.getByText(/Faktura obsahuje 2 ks/)).toBeInTheDocument();
  });
});

describe('query states', () => {
  it('shows a spinner while loading', () => {
    invoicesResponse = undefined;
    queryState = { isLoading: true, isError: false };

    renderSection();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not crash when the query resolves without data', () => {
    // Regression: totals were computed in a useMemo above the `if (!data)` guard, so this
    // threw "Cannot read properties of undefined (reading 'invoices')".
    invoicesResponse = undefined;
    queryState = { isLoading: false, isError: false };

    expect(() => renderSection()).not.toThrow();
    expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument();
  });

  it('reports a failed load instead of rendering nothing', () => {
    invoicesResponse = undefined;
    queryState = { isLoading: false, isError: true, error: new Error('Nelze se připojit') };

    renderSection();

    // An invisible section would read as "nothing to invoice", which is a different claim.
    expect(screen.getByText('Fakturace')).toBeInTheDocument();
    expect(screen.queryByText(/vše rozděleno/)).not.toBeInTheDocument();
  });
});

describe('delivery address', () => {
  const stop = (over: Record<string, unknown> = {}) => ({
    id: 'st1', order: 1, clientId: CLIENT_A,
    selectedAddressKind: 'Official',
    officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
    ...over,
  } as unknown as OutgoingShipmentStopDto);

  it('shows where the band delivers, and keeps it visible when the band is collapsed', async () => {
    renderSection(true, [stop()]);

    expect(screen.getByText(/Hlavní 1/)).toBeInTheDocument();

    // The collapsed header is what the office scans, so the address has to
    // survive the collapse — it sits outside the Collapse for this reason.
    fireEvent.click(screen.getAllByRole('button', { name: 'Sbalit' })[0]);
    await waitFor(() => expect(screen.getByText(/Hlavní 1/)).toBeInTheDocument());
  });

  it('names the delivery place beside the address', () => {
    renderSection(true, [stop({
      selectedAddressKind: 'DeliveryPlace',
      deliveryPlace: { id: 'p1', name: 'Letní zahrádka', address: { latitude: 50.7, longitude: 15.05 } },
    })]);

    expect(screen.getByText('Letní zahrádka')).toBeInTheDocument();
  });

  // Two separate queries back this screen; they can briefly disagree.
  it('shows no address rather than a wrong one when no stop matches', () => {
    renderSection(true, [stop({ order: 99, clientId: 'someone-else' })]);

    expect(screen.queryByText(/Hlavní 1/)).not.toBeInTheDocument();
  });
});

describe('order notes', () => {
  const stopWithNotes = (texts: string[]) => ({
    id: 'st1', order: 1, clientId: CLIENT_A,
    selectedAddressKind: 'Official',
    officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
    notes: texts.map((t) => ({ id: t, text: t, dateCreated: new Date() })),
  } as unknown as OutgoingShipmentStopDto);

  it("shows the order's notes in the expanded band", () => {
    renderSection(true, [stopWithNotes(['Dovézt dopoledne', 'Faktura na jméno provozovny'])]);

    expect(screen.getByTestId('band-notes')).toBeInTheDocument();
    expect(screen.getByText('Dovézt dopoledne')).toBeInTheDocument();
    expect(screen.getByText('Faktura na jméno provozovny')).toBeInTheDocument();
  });

  // An empty container would read as "no instructions" — a claim the section
  // has no business making.
  it('renders no note block when the order has none', () => {
    renderSection(true, [stopWithNotes([])]);
    expect(screen.queryByTestId('band-notes')).not.toBeInTheDocument();
  });

  it("keeps the operator's line breaks", () => {
    renderSection(true, [stopWithNotes(['Dovézt dopoledne,\nzavolat 30 min předem'])]);

    const note = screen.getByText(/zavolat 30 min předem/);
    expect(note).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('hides the notes with the band when it is collapsed', async () => {
    renderSection(true, [stopWithNotes(['Dovézt dopoledne'])]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Sbalit' })[0]);
    await waitForElementToBeRemoved(() => screen.queryByText('Dovézt dopoledne'));
  });
});

describe('vratky', () => {
  const stopWithReturns = (returns: { name: string; quantity: number; note?: string }[]) => ({
    id: 'st1', order: 1, clientId: CLIENT_A,
    selectedAddressKind: 'Official',
    officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
    returns: returns.map((r) => ({ id: r.name, ...r })),
  } as unknown as OutgoingShipmentStopDto);

  it("shows the order's vratky in the expanded band", () => {
    renderSection(true, [stopWithReturns([
      { name: 'Sud 50 l', quantity: 4, note: 'Vadný ventil' },
      { name: 'Přepravka', quantity: 2 },
    ])]);

    const card = screen.getByTestId('band-returns');
    // Headed, so a list of goods under the invoice table cannot be misread as
    // more things being billed.
    expect(within(card).getByText('Vrací')).toBeInTheDocument();
    expect(within(card).getByText('Sud 50 l')).toBeInTheDocument();
    expect(within(card).getByText('4×')).toBeInTheDocument();
    expect(within(card).getByText('Vadný ventil')).toBeInTheDocument();
    expect(within(card).getByText('Přepravka')).toBeInTheDocument();
  });

  it('sits below the products table, not above it', () => {
    renderSection(true, [stopWithReturns([{ name: 'Sud 50 l', quantity: 4 }])]);

    const products = screen.getByText('Produkt');
    const returns = screen.getByTestId('band-returns');

    // DOCUMENT_POSITION_FOLLOWING: the returns block comes after the table head.
    expect(products.compareDocumentPosition(returns) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no vratky block when the order has none', () => {
    renderSection(true, [stopWithReturns([])]);
    expect(screen.queryByTestId('band-returns')).not.toBeInTheDocument();
  });

  it('hides the vratky with the band when it is collapsed', async () => {
    renderSection(true, [stopWithReturns([{ name: 'Sud 50 l', quantity: 4 }])]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Sbalit' })[0]);
    await waitForElementToBeRemoved(() => screen.queryByTestId('band-returns'));
  });
});
