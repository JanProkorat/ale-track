// What only BulkClientPricesDrawer decides: seeding the draft from the
// client's existing prices, the percentage fill (from the ceník price, never
// the client's), that search narrows the display without touching what gets
// saved, the row marks, and that the replace mutation always gets the
// complete desired list. The product-list and price-list queries can each be
// loading or failed — the mocks below express both, since a mock that always
// hands back a happy response cannot catch a crash on a missing one.

import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { ClientProductPriceDto, ProductKind, ProductListItemDto } from 'src/generated/api-client';

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'brewery-1' ? '#F08C00' : undefined),
}));

let productsState: { data: ProductListItemDto[] | undefined; isLoading: boolean; isError: boolean; error?: unknown } =
  { data: [], isLoading: false, isError: false };

vi.mock('src/hooks/useProducts', () => ({
  useProducts: () => productsState,
}));

let pricesState: { data: ClientProductPriceDto[] | undefined; isLoading: boolean; isError: boolean; error?: unknown } =
  { data: [], isLoading: false, isError: false };

const replaceMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('src/hooks/useClientProductPrices', () => ({
  useClientProductPrices: () => pricesState,
  useReplaceClientProductPrices: () => ({ mutateAsync: replaceMutateAsync, isPending: false }),
}));

const { BulkClientPricesDrawer } = await import('./BulkClientPricesDrawer');

function product(over: Partial<ProductListItemDto> = {}): ProductListItemDto {
  return new ProductListItemDto({
    id: `product-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Ležák 12°',
    kind: ProductKind.Keg,
    packageSize: 30,
    priceWithVat: 1000,
    breweryId: 'brewery-1',
    breweryName: 'Pivovar Kohout',
    ...over,
  });
}

function clientPrice(over: Partial<ClientProductPriceDto> = {}): ClientProductPriceDto {
  return new ClientProductPriceDto({
    productId: 'product-1',
    priceWithVat: 900,
    ...over,
  });
}

function renderDrawer(clientName?: string) {
  return render(
    <MuiThemeProvider theme={theme}>
      <BulkClientPricesDrawer open clientId="client-1" clientName={clientName} onClose={vi.fn()} />
    </MuiThemeProvider>,
  );
}

function rowInput(productName: string): HTMLElement {
  const row = screen.getByText(productName).closest('tr');
  return within(row as HTMLElement).getByPlaceholderText('ceník');
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Uložit ceny' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  replaceMutateAsync.mockResolvedValue(undefined);
  productsState = { data: [], isLoading: false, isError: false };
  pricesState = { data: [], isLoading: false, isError: false };
});

describe('BulkClientPricesDrawer query states', () => {
  it('shows a spinner while the catalog is loading, not the table', () => {
    productsState = { data: undefined, isLoading: true, isError: false };
    renderDrawer();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a spinner while the client prices are loading', () => {
    productsState = { data: [product()], isLoading: false, isError: false };
    pricesState = { data: undefined, isLoading: true, isError: false };
    renderDrawer();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an error state and disables saving when the catalog fails to load', () => {
    productsState = { data: undefined, isLoading: false, isError: true, error: new Error('boom') };
    renderDrawer();
    expect(screen.getByRole('button', { name: 'Uložit ceny' })).toBeDisabled();
  });
});

describe('BulkClientPricesDrawer save payload', () => {
  it('saves exactly the amount typed into one row, with no percentage involved', () => {
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '850' } });
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({
      clientId: 'client-1',
      data: [{ productId: 'product-1', priceWithVat: 850 }],
    });
  });

  it('sends the whole catalog after a percentage fill', () => {
    productsState = {
      data: [
        product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 }),
        product({ id: 'product-2', name: 'Desítka', priceWithVat: 500 }),
      ],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(screen.getByLabelText('Změna proti ceníku (%)'), { target: { value: '-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přepočítat náhled' }));
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({
      clientId: 'client-1',
      data: expect.arrayContaining([
        { productId: 'product-1', priceWithVat: 900 },
        { productId: 'product-2', priceWithVat: 450 },
      ]),
    });
    const call = replaceMutateAsync.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
  });

  it('reverts the client entirely when Vyprázdnit vše is saved', () => {
    productsState = {
      data: [
        product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 }),
        product({ id: 'product-2', name: 'Desítka', priceWithVat: 500 }),
      ],
      isLoading: false,
      isError: false,
    };
    pricesState = {
      data: [
        clientPrice({ productId: 'product-1', priceWithVat: 900 }),
        clientPrice({ productId: 'product-2', priceWithVat: 480 }),
      ],
      isLoading: false,
      isError: false,
    };
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Vyprázdnit vše' }));
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({ clientId: 'client-1', data: [] });
  });

  it('clearing one row removes only that price and leaves the client\'s other price alone', () => {
    productsState = {
      data: [
        product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 }),
        product({ id: 'product-2', name: 'Desítka', priceWithVat: 500 }),
      ],
      isLoading: false,
      isError: false,
    };
    pricesState = {
      data: [
        clientPrice({ productId: 'product-1', priceWithVat: 900 }),
        clientPrice({ productId: 'product-2', priceWithVat: 480 }),
      ],
      isLoading: false,
      isError: false,
    };
    renderDrawer();

    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '' } });
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({
      clientId: 'client-1',
      data: [{ productId: 'product-2', priceWithVat: 480 }],
    });
  });

  it('keeps a price typed into a row that search then hides in the saved payload', () => {
    productsState = {
      data: [
        product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 }),
        product({ id: 'product-2', name: 'Desítka', priceWithVat: 500 }),
      ],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(rowInput('Desítka'), { target: { value: '444' } });
    fireEvent.change(screen.getByLabelText('Hledat produkt'), { target: { value: 'Ležák' } });

    expect(screen.queryByText('Desítka')).not.toBeInTheDocument();

    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({
      clientId: 'client-1',
      data: [{ productId: 'product-2', priceWithVat: 444 }],
    });
  });

  it('does not write a non-positive or unparseable amount', () => {
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '0' } });
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({ clientId: 'client-1', data: [] });
  });

  it('fills the percentage from the ceník price, not the client\'s current price', () => {
    // Ceník 1000, client already pays 900. A -10% fill from the ceník lands on
    // 900 (1000 * 0.9) — a fill that (wrongly) based itself on the client's
    // current price instead would land on 810 (900 * 0.9). The two happen to
    // be distinguishable here on purpose, so a regression to the wrong base
    // fails loudly instead of coincidentally matching.
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [clientPrice({ productId: 'product-1', priceWithVat: 900 })], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(screen.getByLabelText('Změna proti ceníku (%)'), { target: { value: '-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přepočítat náhled' }));
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({
      clientId: 'client-1',
      data: [{ productId: 'product-1', priceWithVat: 900 }],
    });
  });

  it('applying the percentage fill twice in a row is idempotent, not compounding', () => {
    // The property under test: fillFromPercent always starts from the ceník,
    // never from whatever is already in the draft. An implementation that
    // recomputed from the current draft instead would compound the second
    // click (1290 -> 1226 -> 1165), which this catches.
    productsState = {
      data: [
        product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1290 }),
        product({ id: 'product-2', name: 'Desítka', priceWithVat: 480 }),
      ],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(screen.getByLabelText('Změna proti ceníku (%)'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přepočítat náhled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Přepočítat náhled' }));
    save();

    expect(replaceMutateAsync).toHaveBeenCalledWith({
      clientId: 'client-1',
      data: expect.arrayContaining([
        { productId: 'product-1', priceWithVat: 1226 },
        { productId: 'product-2', priceWithVat: 456 },
      ]),
    });
    const call = replaceMutateAsync.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
  });

  // A test used to live here asserting that a percentage fill preserves a
  // soft-deleted product's client price in the draft. It constructed
  // `pricesState.data` with an entry for a product absent from the catalog —
  // but GetClientProductPricesEndpoint filters `!p.Product.IsDeleted`, so the
  // real endpoint can never return such a row, and the draft is never seeded
  // with it in the first place. The scenario that matters — the row surviving
  // a bulk save the operator never saw it in — is a backend guarantee now:
  // see ReplaceClientProductPricesEndpointTests (backend) for the real guard.
});

describe('BulkClientPricesDrawer background refetch', () => {
  it('does not wipe a typed draft when the price-list query resolves to a new-but-equivalent array', () => {
    // Regression this guards: NSwag DTOs are class instances, so TanStack's
    // structural sharing never recognises a byte-identical refetch as "the
    // same" array. Re-seeding on every `pricesQuery.data` change (rather than
    // once per open) would discard whatever was just typed the moment a
    // background refetch — a reconnect, a retry, an invalidation fired from
    // elsewhere — resolves.
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [clientPrice({ productId: 'product-1', priceWithVat: 900 })], isLoading: false, isError: false };
    const { rerender } = renderDrawer();

    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '850' } });
    expect(rowInput('Ležák 12°')).toHaveValue(850);

    // A brand-new array of brand-new DTO instances carrying the same data —
    // exactly what a background refetch hands back.
    pricesState = { data: [clientPrice({ productId: 'product-1', priceWithVat: 900 })], isLoading: false, isError: false };
    rerender(
      <MuiThemeProvider theme={theme}>
        <BulkClientPricesDrawer open clientId="client-1" onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(rowInput('Ležák 12°')).toHaveValue(850);
  });
});

describe('BulkClientPricesDrawer row marks', () => {
  it('marks a freshly-priced row as "nová" when the client had no price for it', () => {
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    expect(screen.queryByText('nová')).not.toBeInTheDocument();
    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '950' } });
    expect(screen.getByText('nová')).toBeInTheDocument();
  });

  it('marks a row priced above what the client pays today', () => {
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [clientPrice({ productId: 'product-1', priceWithVat: 900 })], isLoading: false, isError: false };
    renderDrawer();

    expect(screen.queryByText('vyšší než dnes')).not.toBeInTheDocument();
    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '950' } });
    expect(screen.getByText('vyšší než dnes')).toBeInTheDocument();
  });

  it('marks a cleared row as reverting to the ceník', () => {
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [clientPrice({ productId: 'product-1', priceWithVat: 900 })], isLoading: false, isError: false };
    renderDrawer();

    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '' } });
    expect(screen.getByText('vrátí se na ceník')).toBeInTheDocument();
  });
});

describe('BulkClientPricesDrawer misc', () => {
  it('shows the client name as the drawer subtitle', () => {
    productsState = { data: [], isLoading: false, isError: false };
    renderDrawer('Hospoda U Netopýra');
    expect(screen.getByText('Hospoda U Netopýra')).toBeInTheDocument();
  });

  it('reports the running count of custom prices to save', () => {
    productsState = {
      data: [product({ id: 'product-1', name: 'Ležák 12°', priceWithVat: 1000 })],
      isLoading: false,
      isError: false,
    };
    pricesState = { data: [], isLoading: false, isError: false };
    renderDrawer();

    expect(screen.getByText('Žádné vlastní ceny — klient platí ceník')).toBeInTheDocument();
    fireEvent.change(rowInput('Ležák 12°'), { target: { value: '950' } });
    expect(screen.getByText('1 vlastní cena k uložení')).toBeInTheDocument();
  });
});
