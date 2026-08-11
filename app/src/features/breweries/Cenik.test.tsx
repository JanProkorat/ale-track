import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import {
  BreweryProductListItemDto, ProductContainer, ProductKind, ProductSaleUnit, ProductType,
} from 'src/generated/api-client';
import { Cenik } from './Cenik';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number) => (v == null ? '—' : `${v} Kč`) }),
}));
vi.mock('src/hooks/useBreweryProducts', () => ({
  useUpdateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewPriceList: () => ({ mutateAsync: vi.fn() }),
  useApplyPriceList: () => ({ mutateAsync: vi.fn() }),
}));

function can(name: string, units: number, priceWithVat: number, volume = 0.5) {
  return new BreweryProductListItemDto({
    id: `${name}-${units}-${volume}`,
    name,
    kind: ProductKind.Can,
    container: ProductContainer.Can,
    saleUnit: ProductSaleUnit.Tray,
    unitsPerPackage: units,
    type: ProductType.PaleDraftBeer,
    packageSize: volume,
    priceWithVat,
  });
}

function keg(name: string, volume: number, priceWithVat: number) {
  return new BreweryProductListItemDto({
    id: `${name}-keg-${volume}`,
    name,
    kind: ProductKind.Keg,
    container: ProductContainer.Keg,
    saleUnit: ProductSaleUnit.Single,
    unitsPerPackage: 1,
    type: ProductType.PaleDraftBeer,
    packageSize: volume,
    priceWithVat,
  });
}

function renderCenik(products: BreweryProductListItemDto[]) {
  return render(
    <MuiThemeProvider theme={theme}>
      <Cenik
        products={products}
        editable={false}
        breweryId="brewery-1"
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />
    </MuiThemeProvider>,
  );
}

function rowFor(name: string) {
  return screen.getByText(name).closest('tr')!;
}

describe('Cenik columns', () => {
  it('separates two tray sizes that share a container volume', () => {
    // The real catalogue: Svijany sells 0,5 l cans as a tray of 24, and the nealko range as a tray
    // of 12. Keyed on volume alone, both land under one "0,5 l" column and their package prices
    // read as the same quantity of beer.
    renderCenik([
      can('Shine', 12, 256.8),
      can('Svijanská Desítka', 24, 501.6),
    ]);

    expect(screen.getByText('12×0,5 l')).toBeInTheDocument();
    expect(screen.getByText('24×0,5 l')).toBeInTheDocument();
  });

  it('puts each product under its own pack size and leaves the other column empty', () => {
    renderCenik([
      can('Shine', 12, 256.8),
      can('Svijanská Desítka', 24, 501.6),
    ]);

    // Columns sort by volume then units, so 12× comes before 24×.
    const shine = within(rowFor('Shine')).getAllByRole('cell');
    expect(shine[1]).toHaveTextContent('256.8 Kč');
    expect(shine[2]).toHaveTextContent('—');

    const desitka = within(rowFor('Svijanská Desítka')).getAllByRole('cell');
    expect(desitka[1]).toHaveTextContent('—');
    expect(desitka[2]).toHaveTextContent('501.6 Kč');
  });

  it('leaves a single-container unit labelled by volume alone', () => {
    // A keg holds one container, so "1×30 l" would be noise.
    renderCenik([keg('Svijanská Desítka', 30, 1116), keg('Svijanská Desítka', 50, 1860)]);

    expect(screen.getByText('30 l')).toBeInTheDocument();
    expect(screen.getByText('50 l')).toBeInTheDocument();
    expect(screen.queryByText('1×30 l')).not.toBeInTheDocument();
  });

  it('keeps one row per product family across its pack sizes', () => {
    renderCenik([
      can('Svijany 450', 24, 549.6),
      can('Svijany 450', 24, 525.6, 0.33),
    ]);

    expect(screen.getAllByText('Svijany 450')).toHaveLength(1);
    const row = within(rowFor('Svijany 450')).getAllByRole('cell');
    expect(row[1]).toHaveTextContent('525.6 Kč');
    expect(row[2]).toHaveTextContent('549.6 Kč');
  });
});
