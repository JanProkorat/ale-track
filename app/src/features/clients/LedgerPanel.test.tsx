// The client profile's Změny a dluhy tab, and the order screen's card of the same list.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

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

vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ledgerState,
  useSetClientLedgerEntryResolution: () => ({ mutateAsync: resolveMock, isPending: false }),
  useSaveClientLedgerEntries: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => ({ data: [] }) }));

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
      <LedgerPanel clientId="client-a" clientName="U Zeleného stromu" editable />
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

beforeEach(() => {
  ledgerState.data = [];
  ledgerState.isLoading = false;
  ledgerState.isError = false;
  resolveMock.mockReset().mockResolvedValue('ok');
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
    expect(open.getByText('zařazeno')).toBeInTheDocument();
    expect(open.queryByRole('button', { name: 'Vyřešit' })).not.toBeInTheDocument();
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

    expect(within(section('Nedořešeno')).getByText(/bez objednávky/)).toBeInTheDocument();
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

  // What makes it worth reading is the part that happened elsewhere — this order's own
  // deviations are already struck through above it.
  it('lists the whole open list and badges the rows from this order', () => {
    renderCard([
      entry({ productName: 'Ležák 12', orderId: ORDER }),
      entry({ productName: 'Světlé 10', orderId: OTHER_ORDER }),
    ], ORDER);

    expect(screen.getByText(/Ležák 12/)).toBeInTheDocument();
    expect(screen.getByText(/Světlé 10/)).toBeInTheDocument();
    expect(screen.getAllByText('z této objednávky')).toHaveLength(1);
  });

  it('words a shortfall as pieces missing', () => {
    renderCard([entry({ plannedQuantity: 10, actualQuantity: 7 })]);

    expect(screen.getByText('Ležák 12 — chybí 3 ks')).toBeInTheDocument();
  });

  it('offers no manual close on an assigned row', () => {
    renderCard([entry({ resolvedByOrderId: OTHER_ORDER })]);

    expect(screen.getByText('zařazeno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vyřešit' })).not.toBeInTheDocument();
  });
});
