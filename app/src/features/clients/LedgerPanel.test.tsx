// The client profile's Změny a dluhy tab, and the order screen's card of the same list.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { orderNumber } from 'src/lib/format';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

// A resource-hook mock that can also say "loading" and "failed" — a mock that always answers
// happily cannot catch a crash on missing data.
const ledgerState: { data?: ClientLedgerEntryDto[]; isLoading: boolean; isError: boolean; error?: unknown } = {
  data: [],
  isLoading: false,
  isError: false,
};

const resolveMock = vi.fn();
const openOrderMock = vi.fn();
// The order screen's card promises rather than closes, so it drives a different mutation.
const assignMock = vi.fn();

vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ledgerState,
  useSetClientLedgerEntryResolution: () => ({ mutateAsync: resolveMock, isPending: false }),
  useSetClientLedgerEntryAssignment: () => ({ mutateAsync: assignMock, isPending: false }),
  useSaveClientLedgerEntries: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// The recording drawer this panel opens reads the client's catalog for its product picker.
vi.mock('src/hooks/useOrders', () => ({
  useClientProductHistory: () => ({ data: undefined, isLoading: false }),
}));
// The catalog marks each brewery with its colour; the hook rides on the brewery list.
vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'b-1' ? '#F08C00' : undefined),
}));
// The recording drawer's second catalog: the suppliers' price lists.
vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: [], isLoading: false, isError: false }),
  useSuppliersMany: () => ({ bySupplier: new Map() }),
}));

const { LedgerPanel } = await import('./LedgerPanel');
const { ClientOpenItemsCard } = await import('./ClientOpenItemsCard');

const ORDER = '33333333-3333-3333-3333-333333333333';
const OTHER_ORDER = '44444444-4444-4444-4444-444444444444';

function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: `e-${Math.random()}`,
    target: ClientLedgerEntryTarget.ProductQuantity,
    requiresFollowUp: true,
    createdAt: '2026-08-24T10:00:00Z',
    productName: 'Ležák 12',
    plannedQuantity: 10,
    actualQuantity: 7,
    orderId: ORDER,
    ...over,
  });
}

function renderPanel() {
  return render(
    <MuiThemeProvider theme={theme}>
      <LedgerPanel
        clientId="client-a"
        clientName="U Zeleného stromu"
        editable
        onOpenOrder={openOrderMock}
      />
    </MuiThemeProvider>,
  );
}

function renderCard(entries: ClientLedgerEntryDto[], currentOrderId?: string) {
  return render(
    <MuiThemeProvider theme={theme}>
      <ClientOpenItemsCard
        entries={entries}
        clientId="client-a"
        currentOrderId={currentOrderId}
        editable
      />
    </MuiThemeProvider>,
  );
}

function section(title: string): HTMLElement {
  return screen.getByText(title).closest('.MuiCard-root') as HTMLElement;
}

/** Historie leads collapsed, so a test reading it has to open it first. */
function openHistory() {
  fireEvent.click(within(section('Historie')).getByRole('button', { expanded: false }));
}

beforeEach(() => {
  ledgerState.data = [];
  ledgerState.isLoading = false;
  ledgerState.isError = false;
  resolveMock.mockReset().mockResolvedValue('ok');
  openOrderMock.mockReset();
  assignMock.mockReset().mockResolvedValue('ok');
});

describe('LedgerPanel', () => {
  it('separates what is open from what is settled', () => {
    ledgerState.data = [
      entry({ productName: 'Ležák 12' }),
      entry({ productName: 'Světlé 10', resolvedAt: new Date('2026-08-20T09:00:00Z') }),
    ];
    renderPanel();

    expect(within(section('Nedořešeno')).getByText(/Ležák 12/)).toBeInTheDocument();
    expect(within(section('Nedořešeno')).queryByText(/Světlé 10/)).not.toBeInTheDocument();
  });

  // Netting them would show a client with two open disputes as square.
  it('sums money in both directions separately', () => {
    ledgerState.data = [
      entry({ target: ClientLedgerEntryTarget.Money, amount: 500, plannedQuantity: undefined, actualQuantity: undefined }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: -300, plannedQuantity: undefined, actualQuantity: undefined }),
    ];
    renderPanel();

    const open = within(section('Nedořešeno'));
    expect(open.getAllByText('Klient dluží').length).toBeGreaterThan(0);
    expect(open.getByText('500 Kč')).toBeInTheDocument();
    expect(open.getByText('300 Kč')).toBeInTheDocument();
  });

  // The row says what happened at the door; only the totals above it read as a balance.
  it('names a money entry as the client being short at handover', () => {
    ledgerState.data = [entry({
      target: ClientLedgerEntryTarget.Money,
      amount: 100,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })];
    renderPanel();

    expect(within(section('Nedořešeno')).getByText('Neměl na zaplacení 100 Kč')).toBeInTheDocument();
  });

  it('keeps the other direction as a debt of ours', () => {
    ledgerState.data = [entry({
      target: ClientLedgerEntryTarget.Money,
      amount: -100,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })];
    renderPanel();

    expect(within(section('Nedořešeno')).getByText('Dlužíme klientovi 100 Kč')).toBeInTheDocument();
  });

  it('says so when nothing is open', () => {
    renderPanel();

    expect(screen.getByText('Nic nedořešeného')).toBeInTheDocument();
  });

  // An entry another order carries closes itself when that order arrives; a manual close here
  // would quietly bypass the link.
  it('offers no manual close on an entry another order is carrying', () => {
    ledgerState.data = [entry({ resolvedByOrderId: OTHER_ORDER })];
    renderPanel();

    const open = within(section('Nedořešeno'));
    expect(open.getByText('v řešení')).toBeInTheDocument();
    expect(open.queryByRole('button', { name: 'Vyřešit' })).not.toBeInTheDocument();
  });

  // "v řešení" is only useful with the where: the order carrying it is named and reachable.
  it('links the order that is going to settle it', () => {
    ledgerState.data = [entry({ resolvedByOrderId: OTHER_ORDER })];
    renderPanel();

    const link = within(section('Nedořešeno'))
      .getByRole('button', { name: `vyřeší ${orderNumber(OTHER_ORDER)}` });
    fireEvent.click(link);

    expect(openOrderMock).toHaveBeenCalledWith(OTHER_ORDER);
  });

  it('marks a standalone debt as having no order behind it', () => {
    ledgerState.data = [entry({
      orderId: undefined,
      target: ClientLedgerEntryTarget.Money,
      amount: 2400,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })];
    renderPanel();

    expect(within(section('Nedořešeno')).getByText('Bez objednávky')).toBeInTheDocument();
  });

  // Grouped, so two disputed deliveries do not read as one pile — and the number is on the
  // group header once instead of on every row of it.
  it('groups the open points by order, one header per order', () => {
    ledgerState.data = [
      entry({ productName: 'Ležák 12', orderId: ORDER }),
      entry({ productName: 'Světlé 10', orderId: ORDER, createdAt: new Date('2026-08-25T10:00:00Z') }),
      entry({ productName: 'Řezané', orderId: OTHER_ORDER }),
    ];
    renderPanel();

    const open = within(section('Nedořešeno'));
    expect(open.getAllByRole('button', { name: `Objednávka ${orderNumber(ORDER)}` })).toHaveLength(1);
    expect(open.getAllByRole('button', { name: `Objednávka ${orderNumber(OTHER_ORDER)}` })).toHaveLength(1);
  });

  // Which run these goods go out on is the question the header is read for; the order's own
  // promised date is not it.
  it('dates a group from the run carrying the order', () => {
    ledgerState.data = [entry({
      orderId: ORDER,
      shipmentDeliveryDate: new Date('2026-08-26T06:30:00Z'),
    })];
    renderPanel();

    expect(within(section('Nedořešeno')).getByText(/vývoz/)).toBeInTheDocument();
  });

  it('says nothing about a run when no shipment carries the order', () => {
    ledgerState.data = [entry({ orderId: ORDER })];
    renderPanel();

    expect(within(section('Nedořešeno')).queryByText(/vývoz/)).not.toBeInTheDocument();
  });

  // "vyřešeno" says a point is done; the history is also asked which delivery did it, so the
  // order is named there in the past tense and stays reachable.
  it('links the order that settled a point in the history', () => {
    ledgerState.data = [entry({
      resolvedByOrderId: OTHER_ORDER,
      resolvedAt: new Date('2026-08-28T09:00:00Z'),
    })];
    renderPanel();
    openHistory();

    const history = within(section('Historie'));
    expect(history.getByText('vyřešeno')).toBeInTheDocument();
    fireEvent.click(history.getByRole('button', { name: `vyřešila ${orderNumber(OTHER_ORDER)}` }));

    expect(openOrderMock).toHaveBeenCalledWith(OTHER_ORDER);
  });

  // Settled by hand on this profile: there is no order behind it, and inventing one would be
  // worse than saying nothing.
  it('names no order for a point settled by hand', () => {
    ledgerState.data = [entry({ resolvedAt: new Date('2026-08-28T09:00:00Z') })];
    renderPanel();
    openHistory();

    const history = within(section('Historie'));
    expect(history.getByText('vyřešeno')).toBeInTheDocument();
    expect(history.queryByRole('button', { name: /vyřešila/ })).not.toBeInTheDocument();
  });

  it('does not crash while the ledger is loading', () => {
    ledgerState.data = undefined;
    ledgerState.isLoading = true;

    expect(() => renderPanel()).not.toThrow();
  });

  it('does not crash when the ledger cannot be read', () => {
    ledgerState.data = undefined;
    ledgerState.isError = true;
    ledgerState.error = new Error('nope');

    expect(() => renderPanel()).not.toThrow();
  });
});

describe('ClientOpenItemsCard', () => {
  // With nothing open the card has nothing to say, and an empty card on every order would be
  // worse than no card.
  it('renders nothing when the client has no open points', () => {
    const { container } = renderCard([entry({ resolvedAt: new Date('2026-08-20T09:00:00Z') })]);

    expect(container).toBeEmptyDOMElement();
  });

  // What the card is for: what this delivery has to put right. This order's own deviations are
  // the struck-through rows above it and its money is in the Peníze card, so repeating them here
  // buried the part that is actually news.
  it('lists what is open from elsewhere and leaves this order out', () => {
    renderCard([
      entry({ productName: 'Ležák 12', orderId: ORDER }),
      entry({ productName: 'Světlé 10', orderId: OTHER_ORDER }),
    ], ORDER);

    expect(screen.getByText(/Světlé 10/)).toBeInTheDocument();
    expect(screen.queryByText(/Ležák 12/)).not.toBeInTheDocument();
  });

  // A debt attached to no order is exactly what the next delivery is meant to clear.
  it('keeps a standalone debt, which belongs to no order at all', () => {
    renderCard([entry({ productName: 'Světlé 10', orderId: undefined })], ORDER);

    expect(screen.getByText(/Světlé 10/)).toBeInTheDocument();
    expect(screen.getByText(/bez objednávky/)).toBeInTheDocument();
  });

  it('renders nothing when everything open belongs to this order', () => {
    const { container } = renderCard([entry({ orderId: ORDER })], ORDER);

    expect(container).toBeEmptyDOMElement();
  });

  it('words a shortfall as pieces missing', () => {
    renderCard([entry({ plannedQuantity: 10, actualQuantity: 7 })]);

    expect(screen.getByText('Ležák 12 — nevyloženo 3 ks')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------------
  // The tick is a promise, not a close. Settling on the click would leave the debt settled even
  // if this order were cancelled — the failure the whole feature exists to prevent — so the row
  // is only linked to the order, and the server closes it when the run arrives.
  // ---------------------------------------------------------------------------------

  it('hands the entry to this order rather than settling it', async () => {
    const owed = entry({ orderId: OTHER_ORDER });
    renderCard([owed], ORDER);

    fireEvent.click(screen.getByRole('button', { name: 'Vyřeší tato objednávka' }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith({
      id: owed.id,
      clientId: 'client-a',
      data: expect.objectContaining({ orderId: ORDER }),
    }));
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('takes its own promise back', async () => {
    const owed = entry({ orderId: OTHER_ORDER, resolvedByOrderId: ORDER });
    renderCard([owed], ORDER);

    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith({
      id: owed.id,
      clientId: 'client-a',
      data: expect.objectContaining({ orderId: undefined }),
    }));
  });

  // Another order's promise closes itself when that order arrives; undoing it from here would
  // quietly take a debt off an order that is still going to deliver against it.
  it('leaves an entry another order is carrying alone', () => {
    renderCard([entry({ orderId: OTHER_ORDER, resolvedByOrderId: '55555555-5555-5555-5555-555555555555' })], ORDER);

    expect(screen.getByText('zařazeno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vyřeší tato objednávka' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vyřadit z objednávky' })).not.toBeInTheDocument();
  });

  // Nothing to promise with no order in view.
  it('offers no promise when it is not rendered against an order', () => {
    renderCard([entry({ orderId: OTHER_ORDER })]);

    expect(screen.queryByRole('button', { name: 'Vyřeší tato objednávka' })).not.toBeInTheDocument();
  });
});
