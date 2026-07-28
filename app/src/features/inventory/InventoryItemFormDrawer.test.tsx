// The product picker in "Naskladnit" must not offer what is already stocked:
// the API keeps one row per product and rejects a second one.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  InventorySectionDto,
  InventoryItemListItemDto,
  ProductKind,
  ProductListItemDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { InventoryItemFormDrawer } from './InventoryItemFormDrawer';

let productsResponse: { data?: ProductListItemDto[]; isLoading: boolean };
let inventoryResponse: { data?: InventorySectionDto[]; isLoading: boolean };

vi.mock('src/hooks/useProducts', () => ({ useProducts: () => productsResponse }));
vi.mock('src/hooks/useInventory', () => ({
  useInventory: () => inventoryResponse,
  useCreateInventoryItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateInventoryItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useBreweries', () => ({ useBreweryColors: () => () => '#F08C00' }));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const product = (id: string, name: string) => new ProductListItemDto({
  id, name, kind: ProductKind.Keg, packageSize: 50, breweryId: 'b1', breweryName: 'Svijany',
});

const products = [
  product('p-rytir', 'Svijanský Rytíř'),
  product('p-maz', 'Svijanský Máz'),
  product('p-kníže', 'Svijanské Kníže'),
];

const stocked = (...items: InventoryItemListItemDto[]) => [
  new InventorySectionDto({ id: 'b1', name: 'Svijany', items }),
];

function openPicker() {
  render(
    <MuiThemeProvider theme={theme}>
      <InventoryItemFormDrawer open onClose={() => {}} />
    </MuiThemeProvider>,
  );
  fireEvent.click(screen.getByTitle('Open'));
  return screen.getByRole('listbox');
}

describe('InventoryItemFormDrawer', () => {
  beforeEach(() => {
    productsResponse = { data: products, isLoading: false };
    inventoryResponse = { data: [], isLoading: false };
  });

  it('offers every product when nothing is stocked', () => {
    const listbox = openPicker();

    expect(within(listbox).getByText('Svijanský Rytíř')).toBeInTheDocument();
    expect(within(listbox).getByText('Svijanský Máz')).toBeInTheDocument();
    expect(within(listbox).getByText('Svijanské Kníže')).toBeInTheDocument();
  });

  it('hides the products already in the inventory', () => {
    inventoryResponse = {
      data: stocked(
        new InventoryItemListItemDto({ id: 'i1', productId: 'p-rytir', name: 'Svijanský Rytíř', quantity: 10 }),
      ),
      isLoading: false,
    };

    const listbox = openPicker();

    expect(within(listbox).queryByText('Svijanský Rytíř')).not.toBeInTheDocument();
    expect(within(listbox).getByText('Svijanský Máz')).toBeInTheDocument();
  });

  it('hides nothing for manual items, which have no product behind them', () => {
    // Deliberately named after a real product: a manual row is free-text and
    // says nothing about the catalogue, so matching on name would wrongly hide
    // a product nobody has stocked.
    inventoryResponse = {
      data: stocked(new InventoryItemListItemDto({ id: 'i2', name: 'Svijanský Rytíř', quantity: 200 })),
      isLoading: false,
    };

    const listbox = openPicker();

    expect(within(listbox).getByText('Svijanský Rytíř')).toBeInTheDocument();
    expect(within(listbox).getByText('Svijanský Máz')).toBeInTheDocument();
  });

  it('survives an inventory list that has not loaded yet', () => {
    inventoryResponse = { data: undefined, isLoading: true };

    const listbox = openPicker();

    expect(within(listbox).getByText('Svijanský Rytíř')).toBeInTheDocument();
  });

  it('says so when every product is already stocked', () => {
    inventoryResponse = {
      data: stocked(...products.map((p, i) => new InventoryItemListItemDto({
        id: `i${i}`, productId: p.id, name: p.name, quantity: 1,
      }))),
      isLoading: false,
    };

    render(
      <MuiThemeProvider theme={theme}>
        <InventoryItemFormDrawer open onClose={() => {}} />
      </MuiThemeProvider>,
    );
    fireEvent.click(screen.getByTitle('Open'));

    expect(screen.getByText('Nic nenalezeno')).toBeInTheDocument();
  });
});
