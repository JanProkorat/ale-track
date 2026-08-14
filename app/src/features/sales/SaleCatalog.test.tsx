// The catalog's two tabs. The history tab is the reason the client matters: re-adding a regular's
// usual crate should land at the amount and price they last paid, not at today's ceník.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  InventoryItemListItemDto,
  InventorySectionDto,
  ProductKind,
  ProductType,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SaleCatalog } from './SaleCatalog';
import { type StockRow } from './saleCatalogModel';

vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'b1' ? '#F08C00' : undefined),
}));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number) => `${v ?? 0} Kč` }),
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

const sections = [
  new InventorySectionDto({
    id: 'b1',
    name: 'Svijany',
    items: [
      stockItem('in-maz', 'Svijanský Máz', 9),
      stockItem('in-maz-50', 'Svijanský Máz', 4, { packageSize: 50, priceWithVat: 1850 }),
      // Distinct price so a test can tell this row's price cell from the others'.
      stockItem('in-rytir', 'Svijanský Rytíř', 2, { platoDegree: 13, priceWithVat: 1350 }),
    ],
  } as never),
];

let added: { row: StockRow; price?: number; quantity?: number }[] = [];

function renderCatalog(overrides: Partial<Parameters<typeof SaleCatalog>[0]> = {}) {
  added = [];
  return render(
    <MuiThemeProvider theme={theme}>
      <SaleCatalog
        sections={sections}
        history={[]}
        showHistory={false}
        qtyOf={() => 0}
        onAdd={(row, price, quantity) => added.push({ row, price, quantity })}
        onChange={() => {}}
        {...overrides}
      />
    </MuiThemeProvider>
  );
}

beforeEach(() => {
  added = [];
});

describe('SaleCatalog browse tab', () => {
  it('clusters same-name size variants into one card', () => {
    renderCatalog();

    expect(screen.getByText('2 velikosti')).toBeInTheDocument();
    expect(screen.getByLabelText('Přidat Svijanský Máz 30 l')).toBeInTheDocument();
    expect(screen.getByLabelText('Přidat Svijanský Máz 50 l')).toBeInTheDocument();
  });

  it('adds a picked row with no price or amount suggestion — the ceník applies', () => {
    renderCatalog();
    fireEvent.click(screen.getByLabelText('Přidat Svijanský Rytíř'));

    expect(added).toHaveLength(1);
    expect(added[0].row.id).toBe('in-rytir');
    expect(added[0].price).toBeUndefined();
    expect(added[0].quantity).toBeUndefined();
  });

  it('puts the price in the same place for a single item and a size variant', () => {
    renderCatalog();

    // A size-variant row (Svijany-style multi-size group) and a single-item row must agree, or the
    // catalog reads as two different tables.
    //
    // Asserted as shared parentage with the stepper rather than as DOM order: the price sitting
    // inside the name/chips block still *follows* the stock text in document order, so an order-only
    // check passes while the price renders left-aligned. Being a sibling of the stepper in the row's
    // flex container is what actually puts it in the right-hand column.
    const variantPrice = screen.getByText('1850 Kč');
    const variantStepper = screen.getByLabelText('Přidat Svijanský Máz 50 l');
    expect(variantPrice.parentElement).toBe(variantStepper.parentElement);

    const singlePrice = screen.getByText('1350 Kč');
    const singleStepper = screen.getByLabelText('Přidat Svijanský Rytíř');
    expect(singlePrice.parentElement).toBe(singleStepper.parentElement);

    // And the price must not be buried in the block that carries the name and chips.
    expect(screen.getByText('Svijanský Rytíř').parentElement).not.toContainElement(singlePrice);
  });

  it('groups items under a collapsible brewery panel, badged with its item count', () => {
    renderCatalog();

    const header = screen.getByRole('button', { expanded: true });
    expect(header).toHaveTextContent('Svijany');
    expect(header).toHaveTextContent('3');
  });

  it('folds a brewery away and back on the header', async () => {
    renderCatalog();
    expect(screen.getByText('Svijanský Rytíř')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { expanded: true }));
    // Collapse keeps its children mounted while they animate out, so removal is awaited rather
    // than asserted synchronously — the trap app/CLAUDE.md documents.
    await waitForElementToBeRemoved(() => screen.queryByText('Svijanský Rytíř'));

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Svijanský Rytíř')).toBeInTheDocument();
  });

  it('slides the panel shut rather than snapping it away', async () => {
    renderCatalog();
    const header = screen.getByRole('button', { expanded: true });

    fireEvent.click(header);

    // Still in the DOM on the tick after the toggle: that gap between click and removal is the
    // animation. An instant unmount would have removed it already and fail here.
    expect(screen.getByText('Svijanský Rytíř')).toBeInTheDocument();
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await waitForElementToBeRemoved(() => screen.queryByText('Svijanský Rytíř'));
  });

  it('offers a labelled Přidat button rather than a bare icon', () => {
    renderCatalog();

    const add = screen.getByLabelText('Přidat Svijanský Rytíř');
    expect(add).toHaveTextContent('Přidat');
  });

  it('filters by the search field', () => {
    renderCatalog();
    fireEvent.change(screen.getByPlaceholderText('Hledat ve skladu…'), { target: { value: 'rytíř' } });

    expect(screen.getByText('Svijanský Rytíř')).toBeInTheDocument();
    expect(screen.queryByText('2 velikosti')).not.toBeInTheDocument();
  });

  it('says so when the shelf is empty', () => {
    renderCatalog({ sections: [] });
    expect(screen.getByText('Na skladě není nic k prodeji.')).toBeInTheDocument();
  });

  it('distinguishes an empty shelf from an unmatched search', () => {
    renderCatalog();
    fireEvent.change(screen.getByPlaceholderText('Hledat ve skladu…'), { target: { value: 'zzz' } });

    expect(screen.getByText('Nic neodpovídá hledanému výrazu.')).toBeInTheDocument();
    expect(screen.queryByText('Na skladě není nic k prodeji.')).not.toBeInTheDocument();
  });
});

describe('SaleCatalog history tab', () => {
  const history = [
    { inventoryItemId: 'in-maz', lastSoldDate: '2026-08-02', lastUnitPriceWithVat: 1200, lastQuantity: 4 },
  ];

  it('is not offered without a client', () => {
    renderCatalog({ history, showHistory: false });
    expect(screen.queryByText('Dříve prodané')).not.toBeInTheDocument();
  });

  it('is offered with a client, badged with how many items are remembered', () => {
    renderCatalog({ history, showHistory: true });

    expect(screen.getByText('Dříve prodané')).toBeInTheDocument();
    expect(screen.getByText('Procházet sklad')).toBeInTheDocument();
  });

  it('carries last time’s price and amount into the added line', () => {
    renderCatalog({ history, showHistory: true });
    fireEvent.click(screen.getByText('Dříve prodané'));

    fireEvent.click(screen.getByLabelText('Přidat Svijanský Máz'));

    expect(added).toHaveLength(1);
    expect(added[0].row.id).toBe('in-maz');
    expect(added[0].price).toBe(1200);
    expect(added[0].quantity).toBe(4);
  });

  it('shows when the item was last bought', () => {
    renderCatalog({ history, showHistory: true });
    fireEvent.click(screen.getByText('Dříve prodané'));

    expect(screen.getByText(/dříve prodáno · naposled/)).toBeInTheDocument();
  });

  it('explains an empty history rather than showing a blank tab', () => {
    renderCatalog({ history: [], showHistory: true });
    fireEvent.click(screen.getByText('Dříve prodané'));

    expect(screen.getByText('Tento klient u pultu zatím nic nekoupil.')).toBeInTheDocument();
  });

  it('omits a remembered item that is no longer in stock', () => {
    renderCatalog({
      history: [{ inventoryItemId: 'in-gone', lastUnitPriceWithVat: 100 }],
      showHistory: true,
    });
    fireEvent.click(screen.getByText('Dříve prodané'));

    expect(screen.getByText('Tento klient u pultu zatím nic nekoupil.')).toBeInTheDocument();
  });

  it('falls back to browse when the buyer switches to a walk-in mid-edit', () => {
    const { rerender } = renderCatalog({ history, showHistory: true });
    fireEvent.click(screen.getByText('Dříve prodané'));
    expect(screen.getByText(/dříve prodáno/)).toBeInTheDocument();

    rerender(
      <MuiThemeProvider theme={theme}>
        <SaleCatalog
          sections={sections}
          history={history}
          showHistory={false}
          qtyOf={() => 0}
          onAdd={() => {}}
          onChange={() => {}}
        />
      </MuiThemeProvider>
    );

    expect(screen.queryByText(/dříve prodáno/)).not.toBeInTheDocument();
    expect(screen.getByText('2 velikosti')).toBeInTheDocument();
  });
});
