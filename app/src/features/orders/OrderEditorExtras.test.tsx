// Vratky and poznámky editing in the order editor. Both are owned by the order,
// so this is the only place they can be created or changed. Covers the row CRUD,
// the note round-trip, blank-row dropping on save, and that editing either one
// alone marks the form dirty.

// fireEvent rather than user-event, matching ShipmentInvoicing.test.tsx —
// user-event is not a dependency of this project.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderDto, OrderState, OrderReturnDto, OrderNoteDto, OrderCustomExtraItemDto, OrderItemDto, ClientInfoDto, ProductListItemDto, ProductKind, ProductType } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const updateMutate = vi.fn();
const createMutate = vi.fn();
let orderResponse: OrderDto | undefined;
let historyResponse: unknown = [];

let allProducts: { data: unknown[] | undefined; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('src/hooks/useOrders', () => ({
  useOrder: () => ({ data: orderResponse, isLoading: false, isError: false }),
  useClientProductHistory: () => ({ data: historyResponse, isLoading: false }),
  useCreateOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

vi.mock('src/hooks/useClients', () => ({
  // Carries a trading name because that is what separates two clients of the same name;
  // the editor shows it both in the picker and on the chosen-client card.
  useClients: () => ({
    data: [{ id: 'client-a', name: 'Hospoda A', businessName: 'Hospoda A gastro s.r.o.' }],
    isLoading: false,
  }),
  // Read by OrderDeliveryAddressField, rendered in the client card for
  // every client selection this file exercises.
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

// Read by the catalog's "Další zboží" tab. Mocked empty: this file exercises vratky,
// poznámky and položky navíc, none of which touch the supplier picker — but the real
// hooks need a QueryClient, so leaving them unmocked crashes the editor on render.
vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: [], isLoading: false }),
  useSuppliersMany: () => ({ bySupplier: new Map(), loading: new Set() }),
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

function order(returns: OrderReturnDto[], notes: OrderNoteDto[] = [], customExtraItems: OrderCustomExtraItemDto[] = []): OrderDto {
  return new OrderDto({
    id: 'order-1',
    client: new ClientInfoDto({ id: 'client-a', name: 'Hospoda A' }),
    // Saving requires a non-empty cart, so every fixture carries one item.
    orderItems: [
      new OrderItemDto({ id: 'item-1', orderId: 'order-1', productId: 'prod-1', productName: 'Albrecht 12°', quantity: 2 }),
    ],
    returns,
    notes,
    customExtraItems,
  });
}

function renderEditor(mode: 'create' | 'edit' = 'edit') {
  // A data router, not MemoryRouter — the editor's unsaved-changes guard uses
  // useBlocker, which only works inside one.
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

/** The Vratky card, located by its heading. */
function returnsCard(): HTMLElement {
  return screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement;
}

function nameInputs(): HTMLInputElement[] {
  return within(returnsCard()).getAllByPlaceholderText('Např. prázdné sudy 50 l') as HTMLInputElement[];
}

/** The Poznámky card, located by its heading. */
function notesCard(): HTMLElement {
  return screen.getByText('Poznámky').closest('.MuiCard-root') as HTMLElement;
}

function noteInputs(): HTMLTextAreaElement[] {
  return within(notesCard()).getAllByPlaceholderText('Např. dovézt dopoledne…') as HTMLTextAreaElement[];
}

/** The Položky navíc card, located by its heading. */
function extrasCard(): HTMLElement {
  return screen.getByText('Položky navíc').closest('.MuiCard-root') as HTMLElement;
}

function extraInputs(): HTMLInputElement[] {
  return within(extrasCard()).getAllByPlaceholderText('Např. tácky') as HTMLInputElement[];
}

function extraNoteInputs(): HTMLInputElement[] {
  return within(extrasCard()).getAllByPlaceholderText('Poznámka (nepovinné)') as HTMLInputElement[];
}

/** The Košík card, located by its heading. */
function cartCard(): HTMLElement {
  return screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
}

function cartNoteInput(): HTMLInputElement {
  return within(cartCard()).getByPlaceholderText('Poznámka k položce (nepovinné)') as HTMLInputElement;
}

beforeEach(() => {
  updateMutate.mockReset().mockResolvedValue(undefined);
  createMutate.mockReset().mockResolvedValue('new-id');
  orderResponse = order([]);
  historyResponse = [];
});

/**
 * Reported: two clients may share a name and differ only in their trading name, and the
 * editor showed the name alone — in the picker's rows *and* on the card that replaces the
 * picker once one is chosen. Either one alone leaves you unable to tell which of the pair
 * the order is going to.
 */
describe('OrderEditor — the chosen client', () => {
  it('names the trading entity beside the client', () => {
    renderEditor();

    expect(screen.getByText('Hospoda A')).toBeInTheDocument();
    expect(screen.getByText('Hospoda A gastro s.r.o.')).toBeInTheDocument();
  });
});

describe('OrderEditor — vratky a poznámky', () => {
  it('shows the empty state until a row is added', () => {
    renderEditor();

    expect(within(returnsCard()).getByText(/Žádné vratky/)).toBeInTheDocument();

    fireEvent.click(within(returnsCard()).getByRole('button', { name: 'Přidat' }));

    expect(within(returnsCard()).queryByText(/Žádné vratky/)).not.toBeInTheDocument();
    expect(nameInputs()).toHaveLength(1);
  });

  it('loads existing returns including their note', () => {
    orderResponse = order([
      new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4, note: 'Vadný ventil' }),
    ]);

    renderEditor();

    expect(nameInputs()[0].value).toBe('Sud 50 l');
    expect((within(returnsCard()).getByPlaceholderText('Poznámka (nepovinné)') as HTMLInputElement).value)
      .toBe('Vadný ventil');
  });

  it('removes a row', () => {
    orderResponse = order([
      new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4 }),
      new OrderReturnDto({ id: 'ret-2', name: 'Přepravka', quantity: 2 }),
    ]);

    renderEditor();
    expect(nameInputs()).toHaveLength(2);

    fireEvent.click(within(returnsCard()).getAllByRole('button', { name: 'Odebrat vratku' })[0]);

    const remaining = nameInputs();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].value).toBe('Přepravka');
  });

  it('sends edited rows with their id and note, and drops blank rows', async () => {
    orderResponse = order([
      new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4, note: 'Původní' }),
    ]);

    renderEditor();

    fireEvent.change(nameInputs()[0], { target: { value: 'Sud 30 l' } });
    fireEvent.change(within(returnsCard()).getByPlaceholderText('Poznámka (nepovinné)'), {
      target: { value: 'Upravená' },
    });

    // A scratch row the user never filled in must not reach the API.
    fireEvent.click(within(returnsCard()).getByRole('button', { name: 'Přidat' }));

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const { returns } = updateMutate.mock.calls[0][0].data;
    expect(returns).toHaveLength(1);
    expect(returns[0].id).toBe('ret-1');
    expect(returns[0].name).toBe('Sud 30 l');
    expect(returns[0].note).toBe('Upravená');
  });

  it('sends a newly added row without an id', async () => {
    renderEditor();

    fireEvent.click(within(returnsCard()).getByRole('button', { name: 'Přidat' }));
    fireEvent.change(nameInputs()[0], { target: { value: 'Láhev 0,5 l' } });

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const { returns } = updateMutate.mock.calls[0][0].data;
    expect(returns).toHaveLength(1);
    expect(returns[0].id).toBeUndefined();
    expect(returns[0].name).toBe('Láhev 0,5 l');
    expect(returns[0].quantity).toBe(1);
    // An empty note is omitted rather than sent as ''.
    expect(returns[0].note).toBeUndefined();
  });

  it('round-trips any number of notes, dropping blank ones', async () => {
    orderResponse = order([], [new OrderNoteDto({ id: 'n1', text: 'Dovézt dopoledne' })]);

    renderEditor();

    const notes = notesCard();
    expect((within(notes).getAllByPlaceholderText('Např. dovézt dopoledne…')[0] as HTMLInputElement).value)
      .toBe('Dovézt dopoledne');

    // A second, filled note and a third left blank.
    fireEvent.click(within(notes).getByRole('button', { name: 'Přidat' }));
    fireEvent.change(noteInputs()[1], { target: { value: 'Volat na vrátnici' } });
    fireEvent.click(within(notes).getByRole('button', { name: 'Přidat' }));

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const sent = updateMutate.mock.calls[0][0].data.notes;
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ id: 'n1', text: 'Dovézt dopoledne' });
    expect(sent[1].id).toBeUndefined();
    expect(sent[1].text).toBe('Volat na vrátnici');
  });

  it('removes a note', () => {
    orderResponse = order([], [
      new OrderNoteDto({ id: 'n1', text: 'První' }),
      new OrderNoteDto({ id: 'n2', text: 'Druhá' }),
    ]);

    renderEditor();
    expect(noteInputs()).toHaveLength(2);

    fireEvent.click(within(notesCard()).getAllByRole('button', { name: 'Odebrat poznámku' })[0]);

    expect(noteInputs()).toHaveLength(1);
    expect(noteInputs()[0].value).toBe('Druhá');
  });

  it('marks the form dirty when only a note changed', () => {
    orderResponse = order([], [new OrderNoteDto({ id: 'n1', text: 'Dovézt dopoledne' })]);

    renderEditor();

    const save = screen.getByRole('button', { name: /Uložit/i });
    fireEvent.change(noteInputs()[0], { target: { value: 'Dovézt odpoledne' } });

    expect(save).not.toBeDisabled();
  });

  it('round-trips custom extras, dropping blank rows', async () => {
    orderResponse = order([], [], [new OrderCustomExtraItemDto({ id: 'x1', description: 'Tácky', quantity: 100 })]);

    renderEditor();
    expect(extraInputs()[0].value).toBe('Tácky');

    fireEvent.click(within(extrasCard()).getByRole('button', { name: 'Přidat' }));
    fireEvent.change(extraInputs()[1], { target: { value: 'Sklo' } });
    // A third row left blank must not reach the API.
    fireEvent.click(within(extrasCard()).getByRole('button', { name: 'Přidat' }));

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const sent = updateMutate.mock.calls[0][0].data.customExtraItems;
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ id: 'x1', description: 'Tácky', quantity: 100 });
    expect(sent[1].id).toBeUndefined();
    expect(sent[1].description).toBe('Sklo');
  });

  it('removes a custom extra and marks the form dirty when only one changed', () => {
    orderResponse = order([], [], [
      new OrderCustomExtraItemDto({ id: 'x1', description: 'Tácky', quantity: 100 }),
      new OrderCustomExtraItemDto({ id: 'x2', description: 'Sklo', quantity: 6 }),
    ]);

    renderEditor();
    const save = screen.getByRole('button', { name: /Uložit/i });

    fireEvent.click(within(extrasCard()).getAllByRole('button', { name: 'Odebrat položku navíc' })[0]);

    expect(extraInputs()).toHaveLength(1);
    expect(extraInputs()[0].value).toBe('Sklo');
    expect(save).not.toBeDisabled();
  });

  it('loads, edits and round-trips a custom extra note', async () => {
    orderResponse = order([], [], [
      new OrderCustomExtraItemDto({ id: 'x1', description: 'Tácky', quantity: 100, note: 'Původní' }),
    ]);

    renderEditor();
    expect(extraNoteInputs()[0].value).toBe('Původní');

    const save = screen.getByRole('button', { name: /Uložit/i });
    fireEvent.change(extraNoteInputs()[0], { target: { value: 'S logem, ne generické' } });

    // The unsaved-changes baseline covers extra notes, so this alone is enough.
    expect(save).not.toBeDisabled();

    fireEvent.click(save);
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const sent = updateMutate.mock.calls[0][0].data.customExtraItems;
    expect(sent).toHaveLength(1);
    expect(sent[0].note).toBe('S logem, ne generické');
  });

  it('omits a blank custom extra note rather than sending an empty string', async () => {
    renderEditor();

    fireEvent.click(within(extrasCard()).getByRole('button', { name: 'Přidat' }));
    fireEvent.change(extraInputs()[0], { target: { value: 'Sklo' } });

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    expect(updateMutate.mock.calls[0][0].data.customExtraItems[0].note).toBeUndefined();
  });
});

describe('OrderEditor — poznámka u položky košíku', () => {
  it('hides the note field until the note button is pressed', () => {
    renderEditor();

    expect(within(cartCard()).queryByPlaceholderText('Poznámka k položce (nepovinné)')).not.toBeInTheDocument();

    fireEvent.click(within(cartCard()).getByRole('button', { name: 'Přidat poznámku' }));

    expect(cartNoteInput()).toBeInTheDocument();
  });

  it('shows a loaded note without needing the button', () => {
    orderResponse = new OrderDto({
      id: 'order-1',
      client: new ClientInfoDto({ id: 'client-a', name: 'Hospoda A' }),
      orderItems: [
        new OrderItemDto({
          id: 'item-1',
          orderId: 'order-1',
          productId: 'prod-1',
          productName: 'Albrecht 12°',
          quantity: 2,
          note: 'Nechat u zadního vchodu',
        }),
      ],
      returns: [],
      notes: [],
      customExtraItems: [],
    });

    renderEditor();

    expect(cartNoteInput().value).toBe('Nechat u zadního vchodu');
  });

  it('sends the note with its order item and marks the form dirty', async () => {
    renderEditor();

    const save = screen.getByRole('button', { name: /Uložit/i });
    fireEvent.click(within(cartCard()).getByRole('button', { name: 'Přidat poznámku' }));
    fireEvent.change(cartNoteInput(), { target: { value: 'Vyložit u rampy' } });

    expect(save).not.toBeDisabled();

    fireEvent.click(save);
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const items = updateMutate.mock.calls[0][0].data.orderItems;
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('prod-1');
    expect(items[0].note).toBe('Vyložit u rampy');
  });

  it('omits an untouched note rather than sending an empty string', async () => {
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    expect(updateMutate.mock.calls[0][0].data.orderItems[0].note).toBeUndefined();
  });
});

// Reported: the "Dříve objednané" tab did not read in the same order as the
// browse tab. It rendered the history endpoint's flat `recent` array as it came;
// the fix runs it through inDisplayOrder, which orderCatalogModel.test.ts covers
// in isolation. This test guards the wiring — that `recent` actually goes through
// it — which a unit test on the helper cannot see.
describe('OrderEditor — pořadí v „Dříve objednané“', () => {
  it('renders previously-ordered products in catalog order', () => {
    historyResponse = {
      // Deliberately out of order, and with a soft drink first.
      recent: [
        new ProductListItemDto({ id: 'p-lim', name: 'Limonáda', type: ProductType.Lemonade }),
        new ProductListItemDto({ id: 'p-12', name: 'Dvanáctka', type: ProductType.PaleLager, platoDegree: 12 }),
        new ProductListItemDto({ id: 'p-10', name: 'Desítka', type: ProductType.PaleDraftBeer, platoDegree: 10 }),
      ],
      breweries: [],
    };

    renderEditor();

    const catalog = screen.getByText('Katalog produktů').closest('.MuiCard-root') as HTMLElement;
    const rendered = ['Desítka', 'Dvanáctka', 'Limonáda']
      .map((name) => within(catalog).getByText(name));

    // Compare by document position: degree order first, soft drink last.
    expect(rendered[0].compareDocumentPosition(rendered[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rendered[1].compareDocumentPosition(rendered[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('OrderEditor — vratky a poznámky, pokračování', () => {
  it('marks the form dirty when only a return changed', () => {
    orderResponse = order([new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4 })]);

    renderEditor();

    // The unsaved-changes baseline covers returns, so editing one alone is enough
    // to enable the save button.
    const save = screen.getByRole('button', { name: /Uložit/i });
    fireEvent.change(nameInputs()[0], { target: { value: 'Sud 30 l' } });

    expect(save).not.toBeDisabled();
  });
});

// Reported: editing an order that is already in planning shows no Vratky card.
describe('order state', () => {
  it('offers Vratky on a Planning order that has none yet', () => {
    orderResponse = new OrderDto({
      id: 'order-1',
      state: OrderState.Planning,
      client: new ClientInfoDto({ id: 'client-a', name: 'Hospoda A' }),
      orderItems: [
        new OrderItemDto({ id: 'item-1', orderId: 'order-1', productId: 'prod-1', productName: 'Albrecht 12°', quantity: 2 }),
      ],
      returns: [],
      notes: [],
      customExtraItems: [],
    });

    renderEditor('edit');

    expect(screen.getByText('Vratky')).toBeInTheDocument();
    expect(within(returnsCard()).getByRole('button', { name: 'Přidat' })).toBeInTheDocument();
  });
});

/**
 * Reported: on the "Procházet dle pivovaru" tab only the "Vše" reset showed, with no kind
 * buttons beside it. The counts Map was keyed by the raw wire value while KIND_TABS held
 * the numeric enum members, so against real data — where the API serializes enums as
 * strings (JsonStringEnumConverter) — every lookup missed and all five buttons were
 * filtered out. Both wire forms must bucket the same, so this runs each.
 */
describe('OrderEditor — filtr dle druhu v katalogu', () => {
  const catalogWith = (kind: unknown) => ({
    recent: [],
    breweries: [
      {
        breweryId: 'b-1',
        breweryName: 'Svijany',
        kinds: [
          {
            kind,
            packageSizes: [
              {
                packageSize: 30,
                items: [
                  new ProductListItemDto({ id: 'p-1', name: 'Svijanský Máz', type: ProductType.PaleLager }),
                  new ProductListItemDto({ id: 'p-2', name: 'Svijanská Desítka', type: ProductType.PaleDraftBeer }),
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  /** The string form the real API sends, and the numeric form demo data sends. */
  for (const [label, kind] of [['string', 'Keg'], ['numeric', 1]] as const) {
    it(`shows the kind filter with its count for the ${label} wire form`, () => {
      historyResponse = catalogWith(kind);

      renderEditor();
      fireEvent.click(screen.getByRole('button', { name: /Procházet dle pivovaru/ }));

      const sudy = screen.getByRole('button', { name: /^Sud/ });
      expect(sudy).toBeInTheDocument();
      expect(sudy).toHaveTextContent('2');
    });
  }

  /** Every kind stays on the row whether or not this client's catalog has any, so the
   * filter's width does not shift with the data. A kind with none reads 0. */
  it('lists every kind, including the ones with nothing in them', () => {
    historyResponse = catalogWith('Keg');

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Procházet dle pivovaru/ }));

    expect(screen.getByRole('button', { name: /^Sud/ })).toHaveTextContent('2');
    for (const label of ['Basa', 'Plechovka', 'Multipack', 'Ostatní']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toHaveTextContent('0');
    }
  });

  it('narrows the list to the picked kind', () => {
    historyResponse = catalogWith('Keg');

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Procházet dle pivovaru/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Sud/ }));

    // Still listed — picking the kind those products are in must not empty the catalog,
    // which is what comparing a string wire value against a numeric filter did.
    expect(screen.getByText('Svijanský Máz')).toBeInTheDocument();
    expect(screen.queryByText('Žádné produkty v této kategorii')).not.toBeInTheDocument();
  });
});

/**
 * Reported: a new order showed "Vyberte klienta" in place of the whole catalog, so no
 * product could be picked until a client was stored. Only "Dříve objednané" is about the
 * client; the catalog and the suppliers' price lists are not, so the gate now sits on that
 * one tab. Browsing without a client reads the plain product list, since the
 * client-history endpoint stays disabled until there is one.
 */
describe('OrderEditor — katalog bez vybraného klienta', () => {
  beforeEach(() => {
    allProducts = {
      data: [
        new ProductListItemDto({
          id: 'p-maz',
          name: 'Svijanský Máz',
          kind: ProductKind.Keg,
          packageSize: 50,
          breweryId: 'b-1',
          breweryName: 'Svijany',
          type: ProductType.PaleLager,
          platoDegree: 11,
          priceWithVat: 2140,
        }),
      ],
      isLoading: false,
    };
    // Disabled without a client, so it resolves to nothing.
    historyResponse = undefined;
  });

  /** The cart card, so a product name found there is not the catalog's own copy of it. */
  function cart() {
    return within(screen.getByText('Košík').closest('.MuiPaper-root') as HTMLElement);
  }

  /** The catalog card — "Přidat" also names the Vratky card's add-a-row button. */
  function catalog() {
    return within(screen.getByText('Katalog produktů').closest('.MuiPaper-root') as HTMLElement);
  }

  /**
   * Reported: every line added before a client was picked read "—" and 0 Kč. The catalog
   * became client-independent but the cart's name/price lookup did not — it was built out
   * of the client-history query alone, which stays disabled until there is a client, so
   * nothing added this way could be resolved. Asserting the catalog renders (above) never
   * touched it.
   */
  it('names and prices a line added with no client chosen', () => {
    renderEditor('create');
    fireEvent.click(screen.getByRole('button', { name: /Procházet dle pivovaru/ }));
    fireEvent.click(catalog().getByRole('button', { name: 'Přidat' }));

    expect(cart().getByText('Svijanský Máz')).toBeInTheDocument();
    expect(cart().queryByText('—')).not.toBeInTheDocument();
    // The line's own money and the cart total, both off the same lookup.
    expect(cart().getByText(/Sud · 50 l · 2140 Kč/)).toBeInTheDocument();
    expect(cart().getByText('Celkem s DPH').parentElement?.textContent).toContain('2140 Kč');
  });

  it('browses the catalog with no client chosen', () => {
    renderEditor('create');
    fireEvent.click(screen.getByRole('button', { name: /Procházet dle pivovaru/ }));

    expect(screen.getByText('Svijany')).toBeInTheDocument();
    expect(screen.getByText('Svijanský Máz')).toBeInTheDocument();
    expect(screen.queryByText('Vyberte klienta')).not.toBeInTheDocument();
  });

  it('still asks for a client on the "Dříve objednané" tab', () => {
    renderEditor('create');

    // That tab is the default, so the prompt is what a new order opens on.
    expect(screen.getByText('Vyberte klienta')).toBeInTheDocument();
  });

  it('opens the suppliers tab with no client chosen', () => {
    renderEditor('create');
    fireEvent.click(screen.getByRole('button', { name: /Další zboží/ }));

    expect(screen.queryByText('Vyberte klienta')).not.toBeInTheDocument();
  });
});
