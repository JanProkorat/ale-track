import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import {
  BreweryProductListItemDto, ProductContainer, ProductKind, ProductSaleUnit, ProductType,
} from 'src/generated/api-client';
import { ProductFormDrawer } from './ProductFormDrawer';

const updateMutate = vi.fn();

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/hooks/useBreweryProducts', () => ({
  useCreateProducts: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

const NOTE = /nepromítne do vystavených faktur/i;

function renderDrawer(product?: BreweryProductListItemDto) {
  return render(
    <MuiThemeProvider theme={theme}>
      <ProductFormDrawer open breweryId="brewery-1" product={product} onClose={vi.fn()} />
    </MuiThemeProvider>,
  );
}

describe('ProductFormDrawer', () => {
  it('says an edit will not reach issued invoices or past reports', () => {
    renderDrawer(new BreweryProductListItemDto({
      id: 'product-1',
      name: 'Albrecht 12°',
      kind: ProductKind.Keg,
      type: ProductType.PaleLager,
      packageSize: 30,
      priceWithVat: 1290,
    }));

    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('shows no such note when creating a product', () => {
    renderDrawer();

    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('spells out what one sellable unit is', () => {
    // The old form had a single "Balení" field holding litres per container, so a 2 l can and
    // a 20 × 0,5 l basa were indistinguishable on screen.
    renderDrawer(new BreweryProductListItemDto({
      id: 'product-1',
      name: 'Svijanská Desítka',
      kind: ProductKind.Bottle,
      container: ProductContainer.Bottle,
      saleUnit: ProductSaleUnit.Crate,
      unitsPerPackage: 20,
      type: ProductType.PaleDraftBeer,
      packageSize: 0.5,
      priceWithVat: 318,
    }));

    expect(screen.getByText('Basa 20×0,5 l')).toBeInTheDocument();
  });

  it('keeps a jug a jug when only the price is edited', async () => {
    // The trap this guards: the API sends the enum by name, so loading it back through a
    // numeric-keyed picker could land on Bottle/Crate and silently turn a 2 l džbán into a
    // basa on the next save, without anyone touching the packaging fields.
    updateMutate.mockClear();
    renderDrawer(new BreweryProductListItemDto({
      id: 'product-1',
      name: 'Svijanský Kvasničák – 2L',
      kind: ProductKind.Other,
      // The wire form on purpose: the backend serializes enums by name, so this is what a
      // loaded product really carries, even though the generated type says enum. A picker
      // keyed on the numeric member cannot match "Jug" without going through containerValue.
      container: 'Jug' as unknown as ProductContainer,
      saleUnit: 'Single' as unknown as ProductSaleUnit,
      unitsPerPackage: 1,
      type: ProductType.PaleStrong,
      packageSize: 2,
      priceWithVat: 490,
      // Required by the form's validation, so the submit path needs them present.
      priceForUnitWithVat: 490,
      priceForUnitWithoutVat: 404.96,
    }));

    expect(screen.getByText('Džbán 2 l')).toBeInTheDocument();

    // fireEvent.submit on the form, not a click on the submit button: happy-dom does not
    // reliably turn that click into a submit event.
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data).toMatchObject({
      container: ProductContainer.Jug,
      saleUnit: ProductSaleUnit.Single,
      unitsPerPackage: 1,
    });
  });
});
