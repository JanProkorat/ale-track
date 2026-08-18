// What only ProductPricesPanel decides: whether the add button and each row's
// edit/delete actions show up when `editable`, the brewery grouping header,
// and the Rozdíl pill's three outcomes (lower/higher/equal against the ceník
// price). The query can also be loading or failed — the mock below can
// express both, since a mock that always hands back a happy response cannot
// catch a crash on a missing one.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { ClientProductPriceDto, ProductKind } from 'src/generated/api-client';

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'brewery-1' ? '#F08C00' : undefined),
}));

// The form drawer stays mounted (closed) even with no price being edited, so
// its product picker's hook needs a usable — if empty — answer.
vi.mock('src/hooks/useProducts', () => ({
  useProducts: () => ({ data: [], isLoading: false }),
}));

const saveMutateAsync = vi.fn().mockResolvedValue(undefined);
const deleteMutateAsync = vi.fn().mockResolvedValue(undefined);
const replaceMutateAsync = vi.fn().mockResolvedValue(undefined);
const refetch = vi.fn();
let queryState: { data: ClientProductPriceDto[] | undefined; isLoading: boolean; isError: boolean; error?: unknown } =
  { data: [], isLoading: false, isError: false };

// The bulk-edit drawer (Task 10) is always mounted, just closed, alongside the
// add/edit drawer — so its hooks need a usable answer here too.
vi.mock('src/hooks/useClientProductPrices', () => ({
  useClientProductPrices: () => ({ ...queryState, refetch }),
  useSaveClientProductPrice: () => ({ mutateAsync: saveMutateAsync, isPending: false }),
  useDeleteClientProductPrice: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
  useReplaceClientProductPrices: () => ({ mutateAsync: replaceMutateAsync, isPending: false }),
}));

const { ProductPricesPanel } = await import('./ProductPricesPanel');
const { computePriceDiff } = await import('./productPriceDiff');

function price(over: Partial<ClientProductPriceDto> = {}): ClientProductPriceDto {
  return new ClientProductPriceDto({
    productId: `product-${Math.random().toString(36).slice(2, 8)}`,
    productName: 'Ležák 12°',
    kind: ProductKind.Keg,
    packageSize: 30,
    breweryId: 'brewery-1',
    breweryName: 'Pivovar Kohout',
    priceWithVat: 900,
    listPriceWithVat: 1000,
    setOn: new Date('2026-01-01'),
    ...over,
  });
}

function renderPanel(editable: boolean, clientName?: string) {
  return render(
    <MuiThemeProvider theme={theme}>
      <ProductPricesPanel clientId="client-1" clientName={clientName} editable={editable} />
    </MuiThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  saveMutateAsync.mockResolvedValue(undefined);
  deleteMutateAsync.mockResolvedValue(undefined);
  queryState = { data: [], isLoading: false, isError: false };
});

describe('computePriceDiff', () => {
  it('reports "lower" when the client pays less than the ceník price', () => {
    expect(computePriceDiff(900, 1000)).toEqual({ amount: 100, direction: 'lower' });
  });

  it('reports "higher" when the client pays more than the ceník price', () => {
    expect(computePriceDiff(1100, 1000)).toEqual({ amount: 100, direction: 'higher' });
  });

  it('reports "equal" when the client price matches the ceník price exactly', () => {
    expect(computePriceDiff(1000, 1000)).toEqual({ amount: 0, direction: 'equal' });
  });
});

describe('ProductPricesPanel editable gating', () => {
  it('hides the add button, the bulk-edit button and every row action when not editable', () => {
    queryState = { data: [price()], isLoading: false, isError: false };
    renderPanel(false);

    expect(screen.queryByRole('button', { name: /Přidat cenu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hromadná úprava cen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upravit cenu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vrátit na ceník' })).not.toBeInTheDocument();
    // The row itself is still shown — only the actions are gated.
    expect(screen.getByText('Ležák 12°')).toBeInTheDocument();
  });

  it('shows the add button, the bulk-edit button and per-row edit/delete actions when editable', () => {
    queryState = { data: [price()], isLoading: false, isError: false };
    renderPanel(true);

    expect(screen.getByRole('button', { name: /Přidat cenu/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hromadná úprava cen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upravit cenu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vrátit na ceník' })).toBeInTheDocument();
  });
});

describe('ProductPricesPanel row rendering', () => {
  it('renders the client price, the ceník price and a "lower" difference pill', () => {
    queryState = { data: [price({ priceWithVat: 900, listPriceWithVat: 1000 })], isLoading: false, isError: false };
    renderPanel(true);

    expect(screen.getByText('900 Kč')).toBeInTheDocument();
    expect(screen.getByText('1000 Kč')).toBeInTheDocument();
    expect(screen.getByText('o 100 Kč nižší')).toBeInTheDocument();
  });

  it('renders a "higher" difference pill when the client pays more than the ceník', () => {
    queryState = { data: [price({ priceWithVat: 1200, listPriceWithVat: 1000 })], isLoading: false, isError: false };
    renderPanel(true);

    expect(screen.getByText('o 200 Kč vyšší')).toBeInTheDocument();
  });

  it('renders a plain "shodná s ceníkem" note, not a pill, when the prices match', () => {
    queryState = { data: [price({ priceWithVat: 1000, listPriceWithVat: 1000 })], isLoading: false, isError: false };
    renderPanel(true);

    expect(screen.getByText('shodná s ceníkem')).toBeInTheDocument();
    expect(screen.queryByText(/nižší|vyšší/)).not.toBeInTheDocument();
  });

  it('groups rows under their brewery with a count', () => {
    queryState = {
      data: [
        price({ breweryId: 'brewery-1', breweryName: 'Pivovar Kohout', productName: 'Ležák 12°' }),
        price({ breweryId: 'brewery-1', breweryName: 'Pivovar Kohout', productName: 'Desítka' }),
      ],
      isLoading: false,
      isError: false,
    };
    renderPanel(true);

    expect(screen.getByText('Pivovar Kohout')).toBeInTheDocument();
    expect(screen.getByText('2 ceny')).toBeInTheDocument();
  });
});

describe('ProductPricesPanel empty state', () => {
  it('shows the empty-state hint pointing at the add button when editable', () => {
    queryState = { data: [], isLoading: false, isError: false };
    renderPanel(true);
    expect(screen.getByText('Žádné vlastní ceny')).toBeInTheDocument();
    expect(screen.getByText(/Vlastní cenu přidáte tlačítkem výše/)).toBeInTheDocument();
  });

  it('omits the add-button hint when not editable', () => {
    queryState = { data: [], isLoading: false, isError: false };
    renderPanel(false);
    expect(screen.getByText('Žádné vlastní ceny')).toBeInTheDocument();
    expect(screen.queryByText(/Vlastní cenu přidáte tlačítkem výše/)).not.toBeInTheDocument();
  });
});

describe('ProductPricesPanel query states', () => {
  it('shows a spinner while loading, not the empty state or any row', () => {
    queryState = { data: undefined, isLoading: true, isError: false };
    renderPanel(true);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Žádné vlastní ceny')).not.toBeInTheDocument();
  });

  it('shows an error alert with a retry action on failure', () => {
    queryState = { data: undefined, isLoading: false, isError: true, error: new Error('Nelze se připojit') };
    renderPanel(true);
    expect(screen.getByText('Nelze se připojit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});

describe('ProductPricesPanel price drawer', () => {
  it('shows the client name in the drawer so it is clear whose price this is', () => {
    queryState = { data: [], isLoading: false, isError: false };
    renderPanel(true, 'Hospoda U Netopýra');

    fireEvent.click(screen.getByRole('button', { name: /Přidat cenu/ }));

    expect(screen.getByText('Hospoda U Netopýra')).toBeInTheDocument();
  });

  it('still shows the client name when editing an existing price', () => {
    const target = price({ productId: 'product-1', productName: 'Ležák 12°' });
    queryState = { data: [target], isLoading: false, isError: false };
    renderPanel(true, 'Hospoda U Netopýra');

    fireEvent.click(screen.getByRole('button', { name: 'Upravit cenu' }));

    expect(screen.getByText('Hospoda U Netopýra')).toBeInTheDocument();
  });

  it('opens the bulk catalog editor from the toolbar button', () => {
    queryState = { data: [], isLoading: false, isError: false };
    renderPanel(true, 'Hospoda U Netopýra');

    fireEvent.click(screen.getByRole('button', { name: /Hromadná úprava cen/ }));

    expect(screen.getByLabelText('Změna proti ceníku (%)')).toBeInTheDocument();
  });
});

describe('ProductPricesPanel delete flow', () => {
  it('asks for confirmation with "Vrátit na ceník" before calling the mutation', async () => {
    const target = price({ productId: 'product-1', productName: 'Ležák 12°', listPriceWithVat: 1000 });
    queryState = { data: [target], isLoading: false, isError: false };
    renderPanel(true);

    fireEvent.click(screen.getByRole('button', { name: 'Vrátit na ceník' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/ceníkovou cenou/)).toBeInTheDocument();
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vrátit na ceník' }));

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith({ clientId: 'client-1', productId: 'product-1' }));
  });
});
