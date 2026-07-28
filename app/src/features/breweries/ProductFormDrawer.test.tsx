import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { BreweryProductListItemDto, ProductKind, ProductType } from 'src/generated/api-client';
import { ProductFormDrawer } from './ProductFormDrawer';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/hooks/useBreweryProducts', () => ({
  useCreateProducts: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
});
