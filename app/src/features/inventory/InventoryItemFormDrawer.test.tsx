// The product picker in "Naskladnit" must not offer what is already stocked:
// the API keeps one row per product and rejects a second one.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
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
// Hoisted rather than created per render, so a test can read what was actually sent.
const updateMutate = vi.fn();

vi.mock('src/hooks/useProducts', () => ({ useProducts: () => productsResponse }));
vi.mock('src/hooks/useInventory', () => ({
  useInventory: () => inventoryResponse,
  useCreateInventoryItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateInventoryItem: () => ({ mutateAsync: updateMutate, isPending: false }),
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

/**
 * Editing a stock row: quantity and note are the point, and the row's identity has to survive it.
 */
describe('InventoryItemFormDrawer — editing', () => {
  beforeEach(() => {
    productsResponse = { data: products, isLoading: false };
    inventoryResponse = { data: [], isLoading: false };
    updateMutate.mockClear();
  });

  function renderEditing(item: InventoryItemListItemDto) {
    render(
      <MuiThemeProvider theme={theme}>
        <InventoryItemFormDrawer open item={item} onClose={() => {}} />
      </MuiThemeProvider>,
    );
  }

  async function save() {
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    // The submit is async through react-hook-form's resolver.
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    return updateMutate.mock.calls[0][0].data;
  }

  /** A good's row cannot be repointed at a product, so the picker must not be offered at all. */
  it('offers no product picker for a supplier good row', () => {
    renderEditing(new InventoryItemListItemDto({
      id: 'g1', supplierGoodId: 'sg1', name: 'CO₂ láhev', size: '10 kg', quantity: 3,
    }));

    expect(screen.queryByTitle('Open')).not.toBeInTheDocument();
  });

  /**
   * The name belongs to the ceník entry. Echoing the displayed one back would store a copy that
   * goes stale the moment the good is renamed — the very thing the reference exists to avoid.
   */
  it('does not send a name back for a supplier good row', async () => {
    renderEditing(new InventoryItemListItemDto({
      id: 'g1', supplierGoodId: 'sg1', name: 'CO₂ láhev', size: '10 kg', quantity: 3,
    }));

    fireEvent.change(screen.getByLabelText('Množství'), { target: { value: '5' } });
    const sent = await save();

    expect(sent.quantity).toBe(5);
    expect(sent.name).toBeUndefined();
    expect(sent.productId).toBeUndefined();
  });

  it('does not send a name back for a product row either', async () => {
    renderEditing(new InventoryItemListItemDto({
      id: 'p1', productId: 'p-rytir', name: 'Svijanský Rytíř', quantity: 8,
    }));

    const sent = await save();

    expect(sent.productId).toBe('p-rytir');
    expect(sent.name).toBeUndefined();
  });

  /** A hand-written row owns its name, so that one has to keep being sent. */
  it('keeps sending the name of a hand-written row', async () => {
    renderEditing(new InventoryItemListItemDto({
      id: 'm1', name: 'Ucho soudku', quantity: 4,
    }));

    const sent = await save();

    expect(sent.name).toBe('Ucho soudku');
  });
});
