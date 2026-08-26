// The order editor's third catalog tab, "Další zboží" — goods bought off a supplier's
// price list. Covers the picker, that a picked good joins the same cart as the beer,
// the totals it contributes, the write payload, and that a loaded order's lines come
// back with their ids so the backend patches rather than replaces them.

// fireEvent rather than user-event, matching the sibling editor test — user-event is
// not a dependency of this project.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientInfoDto, OrderDto, OrderItemDto, OrderSupplierGoodItemDto,
  SupplierChargeKind, SupplierDto, SupplierGoodDto, SupplierGoodPriceDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const updateMutate = vi.fn();
const createMutate = vi.fn();
let orderResponse: OrderDto | undefined;
let suppliersList: { id: string; name: string }[] = [];
let supplierDetails = new Map<string, SupplierDto>();
let suppliersLoading = false;

const allProducts = { data: [] as unknown[], isLoading: false };

vi.mock('src/hooks/useOrders', () => ({
  useOrder: () => ({ data: orderResponse, isLoading: false, isError: false }),
  useClientProductHistory: () => ({ data: { recent: [], breweries: [] }, isLoading: false }),
  useCreateOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

// The editor reads the client's open ledger points above the cart, so the hook is mocked like
// every other resource — and the mock can say "nothing open", which is the ordinary case.
vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: [{ id: 'client-a', name: 'Hospoda A' }], isLoading: false }),
  useClient: () => ({ data: { officialAddress: undefined, contactAddress: undefined, name: 'Hospoda A' }, isLoading: false }),
}));

vi.mock('src/hooks/useBreweries', () => ({
  useBreweries: () => ({ data: [], isLoading: false }),
}));

// Read by the catalog to build "Procházet dle pivovaru" when no client is chosen yet —
// the client-history endpoint is disabled until then. Mocked because the real hook needs
// a QueryClient, which would crash the editor on render.
vi.mock('src/hooks/useProducts', () => ({
  useProducts: () => allProducts,
}));

// The picker's own data source. Expressed as loading / empty / populated so the tab's
// spinner and empty states are reachable, not just the happy path.
vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: suppliersList, isLoading: suppliersLoading }),
  useSuppliersMany: () => ({ bySupplier: supplierDetails, loading: new Set<string>() }),
}));

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: [], isLoading: false }),
  useCreateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const { OrderEditor } = await import('./OrderEditor');

function price(kind: SupplierChargeKind, withVat: number): SupplierGoodPriceDto {
  return new SupplierGoodPriceDto({ kind, priceWithVat: withVat });
}

/** Two suppliers with three goods between them — enough for grouping and search. */
function seedSuppliers() {
  suppliersList = [{ id: 's-linde', name: 'Linde Gas' }, { id: 's-obaly', name: 'Obaly Morava' }];
  supplierDetails = new Map([
    ['s-linde', new SupplierDto({
      id: 's-linde',
      name: 'Linde Gas',
      goods: [
        new SupplierGoodDto({ id: 'g-co2', name: 'CO₂ láhev', size: '10 kg', prices: [price(SupplierChargeKind.Fill, 450)] }),
        new SupplierGoodDto({ id: 'g-n2', name: 'Dusík láhev', size: '50 l', prices: [price(SupplierChargeKind.Fill, 700)] }),
      ],
    })],
    ['s-obaly', new SupplierDto({
      id: 's-obaly',
      name: 'Obaly Morava',
      goods: [
        new SupplierGoodDto({ id: 'g-keg', name: 'KEG sud nerez', prices: [price(SupplierChargeKind.Purchase, 1800)] }),
      ],
    })],
  ]);
}

function order(supplierGoodItems: OrderSupplierGoodItemDto[] = []): OrderDto {
  return new OrderDto({
    id: 'order-1',
    client: new ClientInfoDto({ id: 'client-a', name: 'Hospoda A' }),
    orderItems: [
      new OrderItemDto({ id: 'item-1', orderId: 'order-1', productId: 'prod-1', productName: 'Albrecht 12°', quantity: 2, unitPriceWithVat: 1000 }),
    ],
    supplierGoodItems,
  });
}

function renderEditor(mode: 'create' | 'edit' = 'edit') {
  // A data router, not MemoryRouter — the unsaved-changes guard uses useBlocker.
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <OrderEditor mode={mode} orderId="order-1" onDone={vi.fn()} onCancel={vi.fn()} />
          </LocalizationProvider>
        </MuiThemeProvider>
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

function cartCard(): HTMLElement {
  return screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
}

function catalogCard(): HTMLElement {
  return screen.getByText('Katalog produktů').closest('.MuiCard-root') as HTMLElement;
}

/** Switches to the "Další zboží" tab. */
function openSupplierTab() {
  fireEvent.click(screen.getByRole('button', { name: /Další zboží/ }));
}

/** The Přidat button inside the row whose good is named `goodName`. */
function addButtonFor(goodName: string): HTMLElement {
  const row = within(catalogCard()).getByText(goodName).closest('div[class*="MuiBox"]')?.parentElement as HTMLElement;
  return within(row).getByRole('button', { name: 'Přidat' });
}

beforeEach(() => {
  updateMutate.mockReset().mockResolvedValue(undefined);
  createMutate.mockReset().mockResolvedValue('new-id');
  orderResponse = order();
  suppliersLoading = false;
  seedSuppliers();
});

describe('OrderEditor — Další zboží tab', () => {
  it('lists suppliers with their goods, prices and charge kinds', async () => {
    renderEditor();
    await waitFor(() => expect(screen.getByText('Albrecht 12°')).toBeInTheDocument());
    openSupplierTab();

    const catalog = within(catalogCard());
    // Named more than once by design: once as the panel heading, once per good row —
    // the row keeps its supplier chip so it still reads correctly when the search
    // filter has scattered goods across panels. Matches the prototype's oeGoodRow.
    expect(catalog.getAllByText('Linde Gas').length).toBeGreaterThan(0);
    expect(catalog.getAllByText('Obaly Morava').length).toBeGreaterThan(0);
    expect(catalog.getByText('CO₂ láhev')).toBeInTheDocument();
    expect(catalog.getByText('KEG sud nerez')).toBeInTheDocument();
    // Priced off the Plnění row, and labelled with what it charges for.
    expect(catalog.getByText('450 Kč')).toBeInTheDocument();
    expect(catalog.getAllByText('Plnění').length).toBeGreaterThan(0);
    expect(catalog.getByText('Nákup')).toBeInTheDocument();
  });

  it('shows a spinner while the suppliers are loading', async () => {
    suppliersLoading = true;
    suppliersList = [];
    supplierDetails = new Map();
    renderEditor();
    await waitFor(() => expect(screen.getByText('Albrecht 12°')).toBeInTheDocument());
    openSupplierTab();

    expect(within(catalogCard()).getByRole('progressbar')).toBeInTheDocument();
  });

  it('reports an empty price list rather than an empty panel', async () => {
    suppliersList = [{ id: 's-empty', name: 'Zatím nic' }];
    supplierDetails = new Map([['s-empty', new SupplierDto({ id: 's-empty', name: 'Zatím nic', goods: [] })]]);
    renderEditor();
    await waitFor(() => expect(screen.getByText('Albrecht 12°')).toBeInTheDocument());
    openSupplierTab();

    expect(within(catalogCard()).getByText('Žádné zboží dodavatelů')).toBeInTheDocument();
  });

  it('filters by good name, folding the subscript so "co2" finds CO₂', async () => {
    renderEditor();
    await waitFor(() => expect(screen.getByText('Albrecht 12°')).toBeInTheDocument());
    openSupplierTab();

    fireEvent.change(within(catalogCard()).getByPlaceholderText('Hledat zboží nebo dodavatele…'), { target: { value: 'co2' } });

    await waitFor(() => expect(within(catalogCard()).queryByText('KEG sud nerez')).not.toBeInTheDocument());
    expect(within(catalogCard()).getByText('CO₂ láhev')).toBeInTheDocument();
  });

  it('adds a picked good to the same cart as the beer, and counts it in the totals', async () => {
    renderEditor();
    await waitFor(() => expect(screen.getByText('Albrecht 12°')).toBeInTheDocument());
    openSupplierTab();

    fireEvent.click(addButtonFor('CO₂ láhev'));

    const cart = within(cartCard());
    // Both lines are in the one cart.
    await waitFor(() => expect(cart.getByText('CO₂ láhev')).toBeInTheDocument());
    expect(cart.getByText('Albrecht 12°')).toBeInTheDocument();
    // 2 beers + 1 bottle.
    expect(cart.getByText('3 ks')).toBeInTheDocument();
  });

  it('sends the picked good on save, with no id for a newly added line', async () => {
    renderEditor();
    await waitFor(() => expect(screen.getByText('Albrecht 12°')).toBeInTheDocument());
    openSupplierTab();
    fireEvent.click(addButtonFor('CO₂ láhev'));
    await waitFor(() => expect(within(cartCard()).getByText('CO₂ láhev')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Uložit změny/ }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const sent = updateMutate.mock.calls[0][0].data;
    expect(sent.supplierGoodItems).toHaveLength(1);
    expect(sent.supplierGoodItems[0].supplierGoodId).toBe('g-co2');
    expect(sent.supplierGoodItems[0].quantity).toBe(1);
    expect(sent.supplierGoodItems[0].id).toBeUndefined();
    // The beer line is untouched by any of this.
    expect(sent.orderItems).toHaveLength(1);
  });

  it('loads an existing order\'s good lines into the cart and re-sends them with their ids', async () => {
    orderResponse = order([
      new OrderSupplierGoodItemDto({
        id: 'line-1',
        supplierGoodId: 'g-co2',
        quantity: 3,
        goodName: 'CO₂ láhev',
        goodSize: '10 kg',
        supplierName: 'Linde Gas',
        unitPriceWithVat: 450,
        chargeKind: SupplierChargeKind.Fill,
      }),
    ]);
    renderEditor();

    const cart = within(cartCard());
    await waitFor(() => expect(cart.getByText('CO₂ láhev')).toBeInTheDocument());
    // 2 beers + 3 bottles.
    expect(cart.getByText('5 ks')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Uložit změny/ }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const sent = updateMutate.mock.calls[0][0].data;
    expect(sent.supplierGoodItems).toHaveLength(1);
    // The id has to survive: without it the backend inserts a new row instead of patching.
    expect(sent.supplierGoodItems[0].id).toBe('line-1');
    expect(sent.supplierGoodItems[0].quantity).toBe(3);
  });

  it('renders a loaded line from the order\'s own names when the price lists are unavailable', async () => {
    suppliersList = [];
    supplierDetails = new Map();
    orderResponse = order([
      new OrderSupplierGoodItemDto({
        id: 'line-1',
        supplierGoodId: 'g-gone',
        quantity: 1,
        goodName: 'Zrušená láhev',
        supplierName: 'Linde Gas',
        unitPriceWithVat: 999,
      }),
    ]);
    renderEditor();

    const cart = within(cartCard());
    await waitFor(() => expect(cart.getByText('Zrušená láhev')).toBeInTheDocument());
    expect(cart.getByText(/Linde Gas/)).toBeInTheDocument();
  });

  it('lets a good line be removed from the cart', async () => {
    orderResponse = order([
      new OrderSupplierGoodItemDto({ id: 'line-1', supplierGoodId: 'g-co2', quantity: 1, goodName: 'CO₂ láhev', supplierName: 'Linde Gas', unitPriceWithVat: 450 }),
    ]);
    renderEditor();

    const cart = within(cartCard());
    await waitFor(() => expect(cart.getByText('CO₂ láhev')).toBeInTheDocument());

    const line = cart.getByText('CO₂ láhev').closest('div[class*="MuiBox"]')?.parentElement?.parentElement as HTMLElement;
    fireEvent.click(within(line).getByRole('button', { name: 'Odebrat' }));

    await waitFor(() => expect(cart.queryByText('CO₂ láhev')).not.toBeInTheDocument());
    // The beer line stays.
    expect(cart.getByText('Albrecht 12°')).toBeInTheDocument();
  });
});
