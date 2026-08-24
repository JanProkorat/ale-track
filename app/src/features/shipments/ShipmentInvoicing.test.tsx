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
  AddressDto,
  ClientDto,
  Country,
  InvoiceAdjustmentKind,
  InvoiceLineSourceKind,
  LinkedClientDto,
  ProductKind,
  ShipmentInvoiceBillingRecipientDto,
  ShipmentInvoiceConfirmationDto,
  ShipmentInvoiceDto,
  ShipmentInvoiceLineDto,
  ShipmentInvoicesDto,
  type OutgoingShipmentStopDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const moveMutate = vi.fn();
const addMutate = vi.fn();
const deleteMutate = vi.fn();
const setRecipientsMutate = vi.fn();
const setReadinessMutate = vi.fn();
/** Client detail per id — the billing-recipient dropdown reads its options off it. */
let clientDetails: Record<string, ClientDto> = {};
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
  useSetInvoiceBillingRecipients: () => ({ mutate: setRecipientsMutate, isPending: false }),
  useSetInvoiceReadiness: () => ({ mutate: setReadinessMutate, isPending: false }),
}));

vi.mock('src/hooks/useClients', () => ({
  useClient: (id: string | undefined) => ({ data: id ? clientDetails[id] : undefined }),
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
  clientDetails = {};
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

  it("shows the client's trading name in the band header when it has one", () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ clientName: 'Luděk Pachl', clientBusinessName: 'Pachl s.r.o.', lines: [line({ quantity: 3 })] }),
      ],
    });

    renderSection();

    expect(screen.getByText(/Pachl s\.r\.o\./)).toBeInTheDocument();
  });

  it('shows the client name alone when there is no trading name', () => {
    renderSection();

    expect(screen.getByText('Klient A')).toBeInTheDocument();
    expect(screen.queryByText(/Klient A ·/)).not.toBeInTheDocument();
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

describe('invoice parties', () => {
  it('shows a payer invoice as expanded party rows and collapses one on click', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1,
          lines: [
            line({ name: 'Albrecht 12°', quantity: 3, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ name: 'Lager 50', quantity: 5, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
          ],
        }),
      ],
    });

    renderSection();

    // Both sub-clients show as party headers, already expanded — their product rows are
    // visible without a click.
    expect(screen.getByText('Pub B')).toBeInTheDocument();
    expect(screen.getByText('Pub C')).toBeInTheDocument();
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
    expect(screen.getByText('Lager 50')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pub B'));

    expect(screen.queryByText('Albrecht 12°')).not.toBeInTheDocument();
    expect(screen.getByText('Lager 50')).toBeInTheDocument();
  });

  it('counts the other clients on the band header, using the Czech paucal for 2', async () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1,
          lines: [
            line({ quantity: 3, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ quantity: 5, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
          ],
        }),
      ],
    });

    renderSection();

    expect(await screen.findByText('2 jiní klienti')).toBeInTheDocument();
  });

  it('keeps the Czech paucal for an other-client count of 4', async () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1,
          lines: [
            line({ quantity: 1, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ quantity: 1, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
            line({ quantity: 1, orderingClientId: 'pub-d', orderingClientName: 'Pub D' }),
            line({ quantity: 1, orderingClientId: 'pub-e', orderingClientName: 'Pub E' }),
          ],
        }),
      ],
    });

    renderSection();

    expect(await screen.findByText('4 jiní klienti')).toBeInTheDocument();
  });

  // A client can hold two invoices on a run, and a payer can hold its own possibly-empty
  // invoice alongside one billing another client — both existing rules have to keep working
  // once party rows are in the mix.
  it('shows party rows alongside the per-invoice header, and the empty-invoice row', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          id: 'inv-1', clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, sequence: 1,
          lines: [
            line({ name: 'Albrecht 12°', quantity: 3, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ name: 'Lager 50', quantity: 5, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
          ],
        }),
        invoice({ id: 'inv-2', clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, sequence: 2, lines: [] }),
      ],
    });

    renderSection();

    expect(screen.getByText('Faktura 1')).toBeInTheDocument();
    expect(screen.getByText('Faktura 2')).toBeInTheDocument();
    expect(screen.getByText('Pub B')).toBeInTheDocument();
    expect(screen.getByText('Pub C')).toBeInTheDocument();
    expect(screen.getByText(/Zatím bez položek/)).toBeInTheDocument();
  });

  it('moves a party row using its own source line, not the whole invoice', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          id: 'inv-a', clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1,
          lines: [
            line({ id: 'l-pubb', sourceItemId: 'pubb-item', quantity: 3, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ id: 'l-pubc', sourceItemId: 'pubc-item', quantity: 5, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
          ],
        }),
        invoice({ id: 'inv-b', clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, lines: [] }),
      ],
    });

    renderSection();
    // Both party rows are already expanded by default, so both move actions are on screen
    // without opening anything first. Parties sort alphabetically by client name (see
    // `invoiceParties`), so Pub B's button is the first of the two.
    fireEvent.click(screen.getAllByRole('button', { name: 'Přesunout kusy na jinou fakturu' })[0]);

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }));
    fireEvent.click(screen.getByRole('option', { name: 'Faktura 1 — 0 ks' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate.mock.calls[0][0]).toMatchObject({
      fromInvoiceId: 'inv-a',
      sourceItemId: 'pubb-item',
      quantity: 3,
    });
  });

  it('re-collapses an opened party when "Sbalit vše" is pressed, not just the bands', async () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1,
          lines: [
            line({ name: 'Albrecht 12°', quantity: 3, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ name: 'Lager 50', quantity: 5, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
          ],
        }),
        invoice({
          clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2,
          lines: [line({ name: 'Pilsner 10°', quantity: 1, orderingClientId: CLIENT_B })],
        }),
      ],
    });

    renderSection();

    // Parties are expanded by default, so the product row is already visible.
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();

    // Collapse-all closes every band, hiding the still-open party along with it.
    fireEvent.click(screen.getByRole('button', { name: /Sbalit vše/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Rozbalit vše/ })).toBeInTheDocument());

    // Reopen just Klient A's band — not through "Rozbalit vše" — and check the party came
    // back collapsed too. Before the fix, `setAll` rebuilt `collapsed` from band ids only,
    // so the already-open party key was dropped from the set and read back as open.
    fireEvent.click(screen.getAllByRole('button', { name: 'Rozbalit' })[0]);
    await waitFor(() => expect(screen.getByText('Pub B')).toBeInTheDocument());
    expect(screen.queryByText('Albrecht 12°')).not.toBeInTheDocument();
  });

  it('leaves an opened party open when the invoices query refetches', () => {
    // Every invoicing mutation invalidates the invoice query, so an equal-but-fresh DTO
    // arrives and the party memo recomputes. A seeding effect used to re-collapse a party
    // the user had opened, because it re-seeded off `collapsed` rather than off "have we
    // ever seen this key". That seeding is gone now that parties start expanded, so this
    // passes trivially — but keep it anyway: it is the guard against anyone reintroducing
    // auto-collapse-on-refetch later.
    const build = () => new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        // A stable invoice id, as a real refetch returns: the party key is `<invoiceId>:<clientId>`.
        invoice({
          id: 'inv-stable', clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1,
          lines: [
            line({ name: 'Albrecht 12°', quantity: 3, orderingClientId: 'pub-b', orderingClientName: 'Pub B' }),
            line({ name: 'Lager 50', quantity: 5, orderingClientId: 'pub-c', orderingClientName: 'Pub C' }),
          ],
        }),
      ],
    });

    invoicesResponse = build();
    const { rerender } = renderSection();

    // Already open by default — no click needed to get here.
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();

    invoicesResponse = build();
    rerender(
      <MuiThemeProvider theme={theme}>
        <ShipmentInvoicing shipmentId="ship-1" editable stops={[]} />
      </MuiThemeProvider>,
    );

    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
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

  // Two distinct orderers on one invoice split into party rows (see 'invoice parties'),
  // so the cross-billed piece now sits behind its own party header rather than as an
  // inline chip on a merged row — but that party header is expanded by default.
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

    // Expanded by default — the chip is visible without opening the party.
    expect(screen.getByText('z obj. Klient B')).toBeInTheDocument();
    expect(screen.getByText('1 položka fakturována jinému klientovi')).toBeInTheDocument();
    expect(screen.getByText('1× přefakturováno')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Klient B'));

    expect(screen.queryByText('z obj. Klient B')).not.toBeInTheDocument();
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

describe('supplier goods', () => {
  /** A line off a supplier's price list: no product, no kind, no package size, no price. */
  function supplierLine(over: Partial<ShipmentInvoiceLineDto> = {}): ShipmentInvoiceLineDto {
    return line({
      sourceKind: InvoiceLineSourceKind.SupplierGoodItem,
      sourceItemId: 'sg-1',
      productId: undefined,
      name: 'CO₂ láhev 10 kg',
      kind: undefined,
      packageSize: undefined,
      // Priced off the good's own list, so the row values like any other.
      priceWithVat: 450,
      quantity: 2,
      ...over,
    });
  }

  it('marks the row as a supplier good, since it has no kind or package to show', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ lines: [supplierLine()] })],
    });

    renderSection();

    const row = screen.getByText('CO₂ láhev 10 kg').closest('tr') as HTMLElement;
    expect(within(row).getByText('zboží dodavatele')).toBeInTheDocument();
    expect(within(row).getByText('2 ks')).toBeInTheDocument();
    // Valued like any other row — 2 × 450 — rather than showing the no-price dash.
    expect(within(row).getByText('900 Kč')).toBeInTheDocument();
  });

  it('does not mark an ordinary product row', () => {
    renderSection();

    const row = screen.getByText('Albrecht 12°').closest('tr') as HTMLElement;
    expect(within(row).queryByText('zboží dodavatele')).toBeNull();
  });

  // The move is the same control every other row has; what it must carry is this row's own source
  // kind, or the server would look the id up among order items and 404.
  it('moves like any other row, sending its own source kind', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({ id: 'inv-a', lines: [supplierLine()] }),
        invoice({ id: 'inv-b', clientId: CLIENT_B, clientName: 'Klient B', stopOrder: 2, lines: [] }),
      ],
    });

    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }));
    fireEvent.click(screen.getByRole('option', { name: 'Faktura 1 — 0 ks' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate.mock.calls[0][0]).toMatchObject({
      fromInvoiceId: 'inv-a',
      sourceKind: InvoiceLineSourceKind.SupplierGoodItem,
      sourceItemId: 'sg-1',
      toInvoiceId: 'inv-b',
    });
  });

  it('can be taken off invoicing altogether, like the rest', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ id: 'inv-a', lines: [supplierLine()] })],
    });

    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout kusy na jinou fakturu' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cílová faktura' }));
    fireEvent.click(screen.getByRole('option', { name: 'Soukromé (nefakturovat)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));

    expect(moveMutate.mock.calls[0][0]).toMatchObject({
      sourceKind: InvoiceLineSourceKind.SupplierGoodItem,
      sourceItemId: 'sg-1',
      toPrivate: true,
    });
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
  // Both lines order through the same client on purpose — a merged row spanning two
  // *different* orderers is now split into party rows before it ever reaches this dialog
  // (see the 'invoice parties' describe block), so a same-client, mixed-source merge (an
  // order plus a stock top-up) is what still exercises the origin picker here.
  beforeEach(() => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          id: 'inv-a', clientId: CLIENT_A, clientName: 'Klient A', stopOrder: 1, sequence: 1,
          lines: [
            line({ id: 'l-own', sourceItemId: 'own', quantity: 5 }),
            line({ id: 'l-stock', sourceItemId: 'stock', quantity: 3, isFromStock: true }),
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
    fireEvent.click(screen.getByRole('option', { name: 'ze skladu — 3 ks' }));

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

describe("a payer's band: each sub-client's own order", () => {
  const PAYER = 'client-payer';

  /** A stop for one sub-client, carrying its own notes and vratky. */
  const subStop = (
    id: string,
    order: number,
    clientId: string,
    notes: string[],
    returns: { name: string; quantity: number }[],
  ) => ({
    id, order, clientId,
    selectedAddressKind: 'Official',
    officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
    notes: notes.map((t) => ({ id: `${id}-${t}`, text: t, dateCreated: new Date() })),
    returns: returns.map((r) => ({ id: `${id}-${r.name}`, ...r })),
  } as unknown as OutgoingShipmentStopDto);

  /** One invoice, issued to the payer, billing two sub-clients' goods. */
  function payerBand() {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          clientId: PAYER,
          clientName: 'O Hübner',
          stopOrder: undefined,
          lines: [
            line({ quantity: 5, orderingClientId: CLIENT_A, orderingClientName: 'Andreas Hohmann' }),
            line({ quantity: 4, orderingClientId: CLIENT_B, orderingClientName: 'Chorvatka' }),
          ],
        }),
      ],
    });

    return [
      subStop('st-a', 1, CLIENT_A, ['Platí za pivo 822 EUR'], []),
      subStop('st-b', 2, CLIENT_B, [], [{ name: 'Sud 30l KEG', quantity: 4 }]),
    ];
  }

  /// The payer takes no delivery of its own, so reading the band's own stop found nothing at all —
  /// which is how every sub-client's note and vratka went missing from this screen.
  it("shows each sub-client's notes and vratky, named", () => {
    renderSection(true, payerBand());

    // Named, because two clients' orders are on this one band and a bare note or vratka could
    // belong to either.
    const hohmann = screen.getByTestId(`party-details-${CLIENT_A}`);
    expect(within(hohmann).getByText('Andreas Hohmann')).toBeInTheDocument();
    expect(within(hohmann).getByText('Platí za pivo 822 EUR')).toBeInTheDocument();

    const chorvatka = screen.getByTestId(`party-details-${CLIENT_B}`);
    expect(within(chorvatka).getByText('Chorvatka')).toBeInTheDocument();
    expect(within(chorvatka).getByText('Sud 30l KEG')).toBeInTheDocument();
  });

  // A client with neither note nor vratka has nothing to show, and an empty block headed by its
  // name would read as "no instructions".
  it('leaves out a sub-client with neither', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [
        invoice({
          clientId: PAYER,
          clientName: 'O Hübner',
          stopOrder: undefined,
          lines: [
            line({ quantity: 5, orderingClientId: CLIENT_A, orderingClientName: 'Andreas Hohmann' }),
            line({ quantity: 4, orderingClientId: CLIENT_B, orderingClientName: 'Chorvatka' }),
          ],
        }),
      ],
    });

    renderSection(true, [subStop('st-a', 1, CLIENT_A, ['Platí za pivo 822 EUR'], [])]);

    expect(screen.getByTestId(`party-details-${CLIENT_A}`)).toBeInTheDocument();
    // Chorvatka has neither, so it gets no block — an empty one under its name would read as "no
    // instructions".
    expect(screen.queryByTestId(`party-details-${CLIENT_B}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('band-returns')).not.toBeInTheDocument();
  });

  // One client, one order: naming it above its own note repeats the band header.
  it('does not name the client on an ordinary band', () => {
    renderSection(true, [subStop('st-a', 1, CLIENT_A, ['Dovézt dopoledne'], [])]);

    expect(screen.getByText('Dovézt dopoledne')).toBeInTheDocument();
    expect(screen.getAllByText('Klient A')).toHaveLength(1);
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

describe('fakturační adresy sub-klientů', () => {
  const SUB_A = 'sub-a';
  const SUB_B = 'sub-b';
  const SUB_NO_ADDRESS = 'sub-none';

  const address = (streetName: string, city: string) =>
    new AddressDto({ streetName, streetNumber: '1', zip: '11000', city, country: Country.Czechia });

  const sub = (id: string, name: string, officialAddress?: AddressDto) =>
    new LinkedClientDto({ id, name, officialAddress });

  /** Klient A pays for two sub-clients with an address and one without. */
  function payerWithSubClients() {
    clientDetails[CLIENT_A] = new ClientDto({
      id: CLIENT_A,
      name: 'Klient A',
      invoicedClients: [
        sub(SUB_A, 'Hospoda U Lípy', address('Nádražní', 'Praha')),
        sub(SUB_B, 'Pivnice Na Rohu', address('Dlouhá', 'Brno')),
        sub(SUB_NO_ADDRESS, 'Bez adresy'),
      ],
    });
  }

  function withSavedRecipients(...recipients: { clientId: string; clientName: string; addr: AddressDto }[]) {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({
        lines: [line({ quantity: 10 })],
        billingRecipients: recipients.map((r) =>
          new ShipmentInvoiceBillingRecipientDto({
            clientId: r.clientId, clientName: r.clientName, address: r.addr,
          })),
      })],
    });
  }

  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /fakturační adres/i }));

  it('shows no chip when the payer has no sub-clients at all', () => {
    renderSection();
    expect(screen.queryByText(/fakturační adres/i)).not.toBeInTheDocument();
  });

  it('shows no chip when every sub-client lacks an official address', () => {
    clientDetails[CLIENT_A] = new ClientDto({
      id: CLIENT_A,
      name: 'Klient A',
      invoicedClients: [sub(SUB_NO_ADDRESS, 'Bez adresy')],
    });

    renderSection();

    expect(screen.queryByText(/fakturační adres/i)).not.toBeInTheDocument();
  });

  it('reads "Fakturační adresy" with nothing chosen', () => {
    payerWithSubClients();
    renderSection();

    expect(screen.getByRole('button', { name: 'Fakturační adresy' })).toBeInTheDocument();
  });

  it('declines the count as "1 fakturační adresa" for one chosen address', () => {
    payerWithSubClients();
    withSavedRecipients({ clientId: SUB_A, clientName: 'Hospoda U Lípy', addr: address('Nádražní', 'Praha') });

    renderSection();

    expect(screen.getByRole('button', { name: '1 fakturační adresa' })).toBeInTheDocument();
  });

  it('declines the count as "2 fakturační adresy" for a 2-4 count', () => {
    payerWithSubClients();
    withSavedRecipients(
      { clientId: SUB_A, clientName: 'Hospoda U Lípy', addr: address('Nádražní', 'Praha') },
      { clientId: SUB_B, clientName: 'Pivnice Na Rohu', addr: address('Dlouhá', 'Brno') },
    );

    renderSection();

    expect(screen.getByRole('button', { name: '2 fakturační adresy' })).toBeInTheDocument();
  });

  it('lists every sub-client with an address and never one without, once opened', () => {
    payerWithSubClients();
    renderSection();

    openMenu();
    const menu = screen.getByRole('menu');

    // Both offered even though neither has goods on this shipment — a payer may owe
    // an address for something billed elsewhere.
    expect(within(menu).getByText('Hospoda U Lípy')).toBeInTheDocument();
    expect(within(menu).getByText('Pivnice Na Rohu')).toBeInTheDocument();
    // The address is what the office is actually choosing between.
    expect(within(menu).getByText('Nádražní 1, 11000 Praha')).toBeInTheDocument();
    // Offering it would only earn a 400 from the endpoint.
    expect(within(menu).queryByText('Bez adresy')).not.toBeInTheDocument();
  });

  it('saves the whole selection through the invoice when a row is ticked', () => {
    payerWithSubClients();
    const inv = invoice({ lines: [line({ quantity: 10 })] });
    invoicesResponse = new ShipmentInvoicesDto({ isEditable: true, adjustments: [], invoices: [inv] });

    renderSection();
    openMenu();
    fireEvent.click(within(screen.getByRole('menu')).getByText('Pivnice Na Rohu'));

    expect(setRecipientsMutate).toHaveBeenCalledWith(
      { invoiceId: inv.id, clientIds: [SUB_B] },
      expect.anything(),
    );
  });

  it('opens with the saved recipients already ticked', () => {
    payerWithSubClients();
    withSavedRecipients({ clientId: SUB_A, clientName: 'Hospoda U Lípy', addr: address('Nádražní', 'Praha') });

    renderSection();
    openMenu();

    const checkbox = within(screen.getByRole('menu')).getByRole('checkbox', { name: 'Hospoda U Lípy' });
    expect(checkbox).toBeChecked();
  });

  it('shows the "Fakturovat na" line once something is chosen, none when nothing is', () => {
    payerWithSubClients();
    withSavedRecipients({ clientId: SUB_A, clientName: 'Hospoda U Lípy', addr: address('Nádražní', 'Praha') });

    renderSection();

    expect(screen.getByText('Fakturovat na: Hospoda U Lípy')).toBeInTheDocument();
  });

  it('renders no "Fakturovat na" line when nothing is chosen', () => {
    payerWithSubClients();
    renderSection();

    expect(screen.queryByText(/Fakturovat na/)).not.toBeInTheDocument();
  });

  it('with canEdit false the chip shows state but does not open', () => {
    payerWithSubClients();
    withSavedRecipients({ clientId: SUB_A, clientName: 'Hospoda U Lípy', addr: address('Nádražní', 'Praha') });

    renderSection(false);

    // A plain span carrying the count, not a button — nothing to click.
    expect(screen.queryByRole('button', { name: '1 fakturační adresa' })).not.toBeInTheDocument();
    const chip = screen.getByText('1 fakturační adresa');

    fireEvent.click(chip);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders no chip at all when read-only and nothing was ever chosen', () => {
    payerWithSubClients();

    renderSection(false);

    // Read-only and empty: a chip here could never be filled in, so it is pure clutter.
    expect(screen.queryByText(/fakturační adres/i)).not.toBeInTheDocument();
  });
});

describe('marking a row finished', () => {
  function confirmation(clientId: string, number: number, isReady = true) {
    return new ShipmentInvoiceConfirmationDto({ clientId, number, isReady });
  }

  it('shows the row\'s own number on the badge, not the stop it is on', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ stopOrder: 4, lines: [line({ quantity: 10 })] })],
      confirmations: [confirmation(CLIENT_A, 2)],
    });

    renderSection();

    // The number the office writes onto the invoice — the route position it used to show has
    // moved to the address line, which needs a stop to render at all.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('4')).not.toBeInTheDocument();
  });

  it('shows a dash while the row has never been marked', () => {
    renderSection();

    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('marks the row ready through the endpoint, keyed on the client', () => {
    renderSection();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hotovo – Klient A' }));

    expect(setReadinessMutate).toHaveBeenCalledTimes(1);
    expect(setReadinessMutate.mock.calls[0][0]).toEqual({ clientId: CLIENT_A, isReady: true });
  });

  it('un-marks a row that is already ready', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ lines: [line({ quantity: 10 })] })],
      confirmations: [confirmation(CLIENT_A, 1)],
    });

    renderSection();

    const checkbox = screen.getByRole('checkbox', { name: 'Hotovo – Klient A' });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    expect(setReadinessMutate.mock.calls[0][0]).toEqual({ clientId: CLIENT_A, isReady: false });
  });

  it('offers no tick to a viewer who cannot edit, and reports a ready row as a chip', () => {
    invoicesResponse = new ShipmentInvoicesDto({
      isEditable: true,
      adjustments: [],
      invoices: [invoice({ lines: [line({ quantity: 10 })] })],
      confirmations: [confirmation(CLIENT_A, 1)],
    });

    renderSection(false);

    expect(screen.queryByRole('checkbox', { name: 'Hotovo – Klient A' })).not.toBeInTheDocument();
    expect(screen.getByText('Hotovo')).toBeInTheDocument();
  });

  it('says nothing about an unmarked row to a viewer who cannot edit', () => {
    renderSection(false);

    expect(screen.queryByText('Hotovo')).not.toBeInTheDocument();
  });
});
