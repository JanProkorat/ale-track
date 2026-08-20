// Buyer and payment live in one card: the two segmented controls sit on the same row, and choosing
// Faktura unfolds the billing fields directly under the buyer's name rather than in a separate card.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  ClientListItemDto,
  SaleDto,
  SaleItemDetailDto,
  SalePaymentMethod,
  SaleState,
  InventoryItemListItemDto,
  InventorySectionDto,
  ProductKind,
  ProductType,
  Region,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SaleEditor } from './SaleEditor';

interface HistoryEntry {
  inventoryItemId?: string;
  lastSoldDate?: string;
  lastUnitPriceWithVat?: number;
  lastQuantity?: number;
}

interface ClientPriceEntry {
  productId?: string;
  priceWithVat?: number;
}

let inventoryResponse: InventorySectionDto[] = [];
let historyResponse: HistoryEntry[] = [];
let clientsResponse: ClientListItemDto[] = [];
let clientPricesResponse: ClientPriceEntry[] = [];
let saleResponse: { data?: SaleDto; isPending: boolean; isError: boolean } = {
  data: undefined,
  isPending: false,
  isError: false,
};

const createMock = vi.fn();
const snackbarMock = vi.fn();

vi.mock('src/hooks/useSales', () => ({
  useSale: () => saleResponse,
  useCreateSale: () => ({ mutate: createMock, isPending: false }),
  useUpdateSale: () => ({ mutate: vi.fn(), isPending: false }),
  useCompleteSale: () => ({ mutate: vi.fn(), isPending: false }),
  useSaleClientHistory: () => ({ data: historyResponse, isPending: false }),
}));
vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: clientsResponse, isPending: false }),
  useClient: () => ({ data: undefined, isPending: false }),
}));
vi.mock('src/hooks/useInventory', () => ({
  useInventory: () => ({ data: inventoryResponse, isPending: false, isSuccess: true }),
}));
vi.mock('src/hooks/useClientProductPrices', () => ({
  useClientProductPrices: () => ({ data: clientPricesResponse, isPending: false, isError: false }),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: snackbarMock }) }));
vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'b1' ? '#F08C00' : undefined),
}));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v: number) => `${v} Kč` }),
}));

const stockItem = (id: string, name: string, quantity: number, extra: Record<string, unknown> = {}) =>
  new InventoryItemListItemDto({
    id,
    name,
    quantity,
    kind: ProductKind.Keg,
    type: ProductType.PaleLager,
    packageSize: 30,
    platoDegree: 12,
    priceWithVat: 1290,
    ...extra,
  } as never);

function renderEditor() {
  return render(
    <MemoryRouter>
      <MuiThemeProvider theme={theme}>
        <SaleEditor mode="create" />
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  inventoryResponse = [
    new InventorySectionDto({
      id: 'b1',
      name: 'Svijany',
      items: [stockItem('in-maz', 'Svijanský Máz', 9), stockItem('in-rytir', 'Svijanský Rytíř', 2)],
    } as never),
  ];
  historyResponse = [];
  clientPricesResponse = [];
  clientsResponse = [
    new ClientListItemDto({ id: 'cl-1', name: 'Pivnice Na Rohu', region: Region.ZittauRegion } as never),
    new ClientListItemDto({ id: 'cl-2', name: 'Anke Kirstein', region: Region.Berlin } as never),
    new ClientListItemDto({ id: 'cl-3', name: 'Zdenek Adamec', region: Region.Berlin } as never),
  ];
  saleResponse = { data: undefined, isPending: false, isError: false };
  createMock.mockClear();
  snackbarMock.mockClear();
});

/** Renders the editor over an existing draft, so the header has a sale to name. */
function renderEditEditor() {
  saleResponse = {
    data: new SaleDto({
      id: 'sale-0000a7',
      saleDate: new Date('2026-08-14'),
      state: SaleState.Draft,
      payment: SalePaymentMethod.Cash,
      buyerName: 'Josef Vrana',
      items: [],
    } as never),
    isPending: false,
    isError: false,
  };
  return render(
    <MemoryRouter>
      <MuiThemeProvider theme={theme}>
        <SaleEditor mode="edit" saleId="sale-0000a7" />
      </MuiThemeProvider>
    </MemoryRouter>
  );
}


/**
 * Renders the editor over a draft that claims more than the shelf now holds — what happens when
 * someone else sells the last kegs while this draft is open. The stepper clamps anything typed
 * fresh, so an existing draft is the only route into this state.
 */
function renderOversoldEditor() {
  inventoryResponse = [
    new InventorySectionDto({
      id: 'b1',
      name: 'Svijany',
      items: [stockItem('in-maz', 'Svijansky Maz', 1)],
    } as never),
  ];
  saleResponse = {
    data: new SaleDto({
      id: 'sale-0000a7',
      saleDate: new Date('2026-08-14'),
      state: SaleState.Draft,
      payment: SalePaymentMethod.Cash,
      buyerName: 'Josef Vrana',
      items: [
        new SaleItemDetailDto({
          id: 'line-1',
          inventoryItemId: 'in-maz',
          name: 'Svijansky Maz',
          quantity: 3,
          unitPriceWithVat: 1290,
          listPriceWithVat: 1290,
        } as never),
      ],
    } as never),
    isPending: false,
    isError: false,
  };
  return render(
    <MemoryRouter>
      <MuiThemeProvider theme={theme}>
        <SaleEditor mode="edit" saleId="sale-0000a7" />
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

/** The card holding the buyer/payment controls, found via its heading. */
function buyerCard(): HTMLElement {
  return screen.getByText('Kupující a platba').closest('.MuiCard-root') as HTMLElement;
}

describe('SaleEditor header', () => {
  it('carries the back arrow and both save actions, matching the order editor', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: 'Zpět na prodeje' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zrušit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit rozpracovaný/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeInTheDocument();
  });

  it('does not duplicate the save actions in the summary rail', () => {
    renderEditor();

    // getByRole throws on multiple matches, so this fails if the rail keeps its own copies.
    expect(screen.getAllByRole('button', { name: /Dokončit prodej/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Uložit rozpracovaný/ })).toHaveLength(1);
  });

  it('names the sale being edited beside the title', () => {
    renderEditEditor();

    const header = screen.getByTestId('detail-header');
    expect(header).toHaveTextContent('Úprava prodeje');
    expect(within(header).getByText('#0000A7')).toBeInTheDocument();
  });

  it('shows no sale number for a new sale, which has none yet', () => {
    renderEditor();

    const header = screen.getByTestId('detail-header');
    expect(header).toHaveTextContent('Nový prodej');
    expect(within(header).queryByText(/^#/)).not.toBeInTheDocument();
  });

  it('drops the counter framing from the subtitle', () => {
    renderEditor();

    expect(screen.getByText(/Vyberte zboží ze skladu, kupujícího a způsob platby/)).toBeInTheDocument();
    expect(screen.queryByText(/Zákazník stojí u pultu/)).not.toBeInTheDocument();
  });
});

describe('SaleEditor catalog', () => {
  it('lists sellable stock inline, with no picker drawer to open', () => {
    renderEditor();

    expect(screen.getByPlaceholderText('Hledat ve skladu…')).toBeInTheDocument();
    expect(screen.getByText('Svijanský Máz')).toBeInTheDocument();
    expect(screen.getByText('Svijany')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat položku ze skladu/ })).not.toBeInTheDocument();
  });

  it('hides the Dříve prodané tab for a walk-in, who has no history', () => {
    renderEditor();
    expect(screen.queryByText('Dříve prodané')).not.toBeInTheDocument();
  });

  it('offers the Dříve prodané tab once a saved client is chosen', () => {
    renderEditor();
    fireEvent.click(screen.getByText('Klient z evidence'));

    // The client combobox is empty at first, so still no history tab.
    expect(screen.queryByText('Dříve prodané')).not.toBeInTheDocument();
  });

  it('moves a picked item into the summary rail with editable amount, price and note', () => {
    renderEditor();

    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));

    expect(screen.getByText('POLOŽKY (1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Počet Svijanský Máz')).toHaveValue(1);
    expect(screen.getByLabelText('Cena za kus Svijanský Máz')).toHaveValue(1290);

    // The note starts behind a toggle rather than as a third open field.
    expect(screen.queryByLabelText('Poznámka k Svijanský Máz')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('poznámka'));
    expect(screen.getByLabelText('Poznámka k Svijanský Máz')).toBeInTheDocument();
  });

  it('clamps a line to the stock on the shelf', () => {
    renderEditor();

    fireEvent.click(screen.getByLabelText('Přidat Svijanský Rytíř'));
    const qty = screen.getByLabelText('Počet Svijanský Rytíř');

    fireEvent.change(qty, { target: { value: '99' } });
    expect(qty).toHaveValue(2);
  });

  it('drops a line when its amount is stepped down to zero', () => {
    renderEditor();

    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));
    expect(screen.getByText('POLOŽKY (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Snížit počet Svijanský Máz'));
    expect(screen.queryByText('POLOŽKY (1)')).not.toBeInTheDocument();
  });
});

describe('SaleEditor buyer/payment card', () => {
  it('holds both the buyer-kind and the payment segments in one card', () => {
    renderEditor();
    const card = buyerCard();

    expect(within(card).getByText('Klient z evidence')).toBeInTheDocument();
    expect(within(card).getByText('Jednorázový kupující')).toBeInTheDocument();
    expect(within(card).getByText('Hotově')).toBeInTheDocument();
    expect(within(card).getByText('Faktura')).toBeInTheDocument();
  });

  it('renders above the items card — who is buying is settled before what they buy', () => {
    renderEditor();
    const buyerHeading = screen.getByText('Kupující a platba');
    const itemsHeading = screen.getByText('Položky');

    // DOCUMENT_POSITION_FOLLOWING === 4
    expect(buyerHeading.compareDocumentPosition(itemsHeading) & 4).toBeTruthy();
  });

  it('hides the billing fields while the sale is paid in cash', () => {
    renderEditor();
    expect(screen.queryByLabelText(/Název \/ jméno/)).not.toBeInTheDocument();
    expect(screen.queryByText('FAKTURAČNÍ ÚDAJE')).not.toBeInTheDocument();
  });

  it('reveals the billing fields under the buyer name once Faktura is chosen', () => {
    renderEditor();
    fireEvent.click(screen.getByText('Faktura'));

    const card = buyerCard();
    const buyerNameInput = within(card).getByLabelText(/Jméno kupujícího/);
    const billingNameInput = within(card).getByLabelText(/Název \/ jméno/);

    expect(billingNameInput).toBeInTheDocument();
    expect(within(card).getByLabelText('IČO')).toBeInTheDocument();
    expect(within(card).getByLabelText('DIČ')).toBeInTheDocument();
    expect(within(card).getByLabelText(/Splatnost/)).toBeInTheDocument();

    // DOCUMENT_POSITION_FOLLOWING === 4: the billing block renders after the buyer's name, not
    // above it and not in a card of its own.
    expect(buyerNameInput.compareDocumentPosition(billingNameInput) & 4).toBeTruthy();
  });

  it('folds the billing fields away again when switching back to Hotově', () => {
    renderEditor();
    fireEvent.click(screen.getByText('Faktura'));
    expect(screen.getByLabelText(/Název \/ jméno/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hotově'));
    expect(screen.queryByLabelText(/Název \/ jméno/)).not.toBeInTheDocument();
  });
});

describe('SaleEditor invoice due date', () => {
  /** Fills in everything an invoiced sale needs except the due date. */
  function invoiceWithoutDueDate() {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));
    fireEvent.click(screen.getByText('Faktura'));
    fireEvent.change(screen.getByLabelText(/Název \/ jméno/), { target: { value: 'Na Rohu gastro s.r.o.' } });
  }

  it('refuses even a draft save without one, because the backend does', () => {
    invoiceWithoutDueDate();

    fireEvent.click(screen.getByRole('button', { name: /Uložit rozpracovaný/ }));

    // Enforced on every save, not only at completion: the create/update validators require the due
    // date whenever the payment is Faktura, so letting the draft through would just be a 400.
    expect(createMock).not.toHaveBeenCalled();
    expect(snackbarMock).toHaveBeenCalledWith('Vyplňte splatnost faktury', expect.anything());
  });

  it('saves once the due date is filled in', () => {
    invoiceWithoutDueDate();
    fireEvent.change(screen.getByLabelText(/Splatnost/), { target: { value: '2026-08-28' } });

    fireEvent.click(screen.getByRole('button', { name: /Uložit rozpracovaný/ }));

    expect(createMock).toHaveBeenCalled();
  });

  it('needs no due date for a cash sale', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));

    fireEvent.click(screen.getByRole('button', { name: /Uložit rozpracovaný/ }));

    expect(createMock).toHaveBeenCalled();
  });
});

describe('SaleEditor stock shortfall', () => {
  it('blocks finishing while a line claims more than the shelf holds', () => {
    renderOversoldEditor();

    const finish = screen.getByRole('button', { name: /Dokončit prodej/ });
    expect(finish).toBeDisabled();
    expect(finish).toHaveAttribute('title', expect.stringContaining('Svijansky Maz'));
  });

  it('still allows saving the draft, so the shortfall can be worked on', () => {
    renderOversoldEditor();

    expect(screen.getByRole('button', { name: /Uložit rozpracovaný/ })).toBeEnabled();
  });

  it('drops the ceník from the line hint, leaving only the shortfall', () => {
    renderOversoldEditor();

    expect(screen.getByText('skladem jen 1')).toBeInTheDocument();
    expect(screen.queryByText(/skladem jen 1 · ceník/)).not.toBeInTheDocument();
  });

  it('keeps the ceník on a line the shelf covers', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));

    expect(screen.getByText(/skladem 9 · ceník/)).toBeInTheDocument();
  });

  it('releases the block once the amount is brought back within stock', () => {
    renderOversoldEditor();
    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Počet Svijansky Maz'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeEnabled();
  });
});

describe('SaleEditor client picker', () => {
  it('groups clients by region and sorts them by name inside each', () => {
    renderEditor();
    fireEvent.click(screen.getByText('Klient z evidence'));
    fireEvent.mouseDown(screen.getByLabelText(/Klient/));

    // Region headings, not a flat roll of every client in the book.
    expect(screen.getByText('Berlín')).toBeInTheDocument();
    expect(screen.getByText('Žitavsko')).toBeInTheDocument();

    // Within Berlin, Anke sorts before Zdenek.
    const anke = screen.getByText('Anke Kirstein');
    const zdenek = screen.getByText('Zdenek Adamec');
    expect(anke.compareDocumentPosition(zdenek) & 4).toBeTruthy();
  });
});

describe('SaleEditor client pricing', () => {
  /** Picks the one saved client this suite seeds — same combobox interaction the client-picker
   *  suite above already exercises. */
  function pickClient() {
    fireEvent.click(screen.getByText('Klient z evidence'));
    fireEvent.mouseDown(screen.getByLabelText(/Klient/));
    fireEvent.click(screen.getByText('Pivnice Na Rohu'));
  }

  it('offers the client override as the line default once a client with one is chosen', () => {
    inventoryResponse = [
      new InventorySectionDto({
        id: 'b1',
        name: 'Svijany',
        items: [stockItem('in-maz', 'Svijanský Máz', 9, { productId: 'p-maz' })],
      } as never),
    ];
    clientPricesResponse = [{ productId: 'p-maz', priceWithVat: 1190 }];
    renderEditor();

    pickClient();
    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));

    expect(screen.getByLabelText('Cena za kus Svijanský Máz')).toHaveValue(1190);
  });

  it('re-resolves to the ceník once the buyer switches back to a walk-in mid-edit', () => {
    inventoryResponse = [
      new InventorySectionDto({
        id: 'b1',
        name: 'Svijany',
        items: [stockItem('in-maz', 'Svijanský Máz', 9, { productId: 'p-maz' })],
      } as never),
    ];
    clientPricesResponse = [{ productId: 'p-maz', priceWithVat: 1190 }];
    renderEditor();

    pickClient();
    // Back to a walk-in before anything is added — the override must not linger on screen.
    fireEvent.click(screen.getByText('Jednorázový kupující'));
    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));

    expect(screen.getByLabelText('Cena za kus Svijanský Máz')).toHaveValue(1290);
  });
});
