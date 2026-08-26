// The open-points preview above the cart, and the shortfall it has to say out loud.

import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

const { ClientOpenItemsPreview } = await import('./ClientOpenItemsPreview');
const { isSettleable, owedPieces } = await import('./ledgerModel');

const PRODUCT = '11111111-1111-1111-1111-111111111111';
const OTHER_ORDER = '22222222-2222-2222-2222-222222222222';

function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: `e-${Math.random()}`,
    target: ClientLedgerEntryTarget.ProductQuantity,
    productId: PRODUCT,
    productName: 'Ležák 12',
    plannedQuantity: 10,
    actualQuantity: 7,
    requiresFollowUp: true,
    createdAt: '2026-08-24T10:00:00Z',
    ...over,
  });
}

function renderPreview(
  entries: ClientLedgerEntryDto[],
  inCart: Array<[string, number]> = [],
  onAdd = vi.fn(),
) {
  const result = render(
    <MuiThemeProvider theme={theme}>
      <ClientOpenItemsPreview
        entries={entries}
        inCartByEntryId={new Map(inCart)}
        onAddToOrder={onAdd}
      />
    </MuiThemeProvider>,
  );
  return { ...result, onAdd };
}

describe('ClientOpenItemsPreview', () => {
  it('renders nothing when the client has no open points', () => {
    const { container } = renderPreview([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers to top up a quantity that is owed', () => {
    const owedEntry = entry();
    const { onAdd } = renderPreview([owedEntry]);

    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    expect(onAdd).toHaveBeenCalledWith(owedEntry);
  });

  it('says how much is owed', () => {
    renderPreview([entry({ plannedQuantity: 10, actualQuantity: 7 })]);

    expect(screen.getByText(/dluh 3 ks/)).toBeInTheDocument();
  });

  // Resolution is binary: a debt of three settled with two closes whole and loses the third.
  // The cost cannot be prevented, only made visible.
  it('shows the shortfall while the cart does not cover the debt', () => {
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 2]]);

    expect(screen.getByText(/dluh 3 ks · přidáno 2 ks/)).toBeInTheDocument();
    expect(screen.getByText('chybí 1 ks')).toBeInTheDocument();
  });

  it('says so once the cart covers the debt', () => {
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 3]]);

    expect(screen.getByText('dorovnáno')).toBeInTheDocument();
    expect(screen.queryByText(/chybí/)).not.toBeInTheDocument();
  });

  // No delivery event can close it, so it is settled on the client's profile instead.
  it('offers no action on a money row', () => {
    renderPreview([entry({
      target: ClientLedgerEntryTarget.Money,
      amount: 2400,
      productId: undefined,
      productName: undefined,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })]);

    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Klient dluží 2400 Kč/)).toBeInTheDocument();
  });

  it('offers no action on a row another order is already bringing', () => {
    renderPreview([entry({ resolvedByOrderId: OTHER_ORDER })]);

    expect(screen.getByText('zařazeno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
  });

  it('offers no action when the client had more than planned rather than less', () => {
    renderPreview([entry({ plannedQuantity: 10, actualQuantity: 12 })]);

    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
  });

  it('sums money in both directions separately', () => {
    renderPreview([
      entry({ target: ClientLedgerEntryTarget.Money, amount: 500, plannedQuantity: undefined, actualQuantity: undefined, productId: undefined }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: -300, plannedQuantity: undefined, actualQuantity: undefined, productId: undefined }),
    ]);

    expect(screen.getByText('500 Kč')).toBeInTheDocument();
    expect(screen.getByText('300 Kč')).toBeInTheDocument();
  });
});

describe('owedPieces', () => {
  it('counts what is missing', () => {
    expect(owedPieces(entry({ plannedQuantity: 10, actualQuantity: 7 }))).toBe(3);
  });

  it('is zero when more arrived than planned', () => {
    expect(owedPieces(entry({ plannedQuantity: 10, actualQuantity: 12 }))).toBe(0);
  });
});

describe('isSettleable', () => {
  it('needs a product to add to the cart', () => {
    expect(isSettleable(entry({ productId: undefined }))).toBe(false);
  });

  it('rejects a settled entry', () => {
    expect(isSettleable(entry({ resolvedAt: new Date('2026-08-26T09:00:00Z') }))).toBe(false);
  });
});
