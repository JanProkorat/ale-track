// The catalog's size chip. A tray's chip has to name the count as well as the volume: Svijanský
// Máz ships as a 12-can and a 24-can tray of the same 0,5 l can, and the volume alone drew the
// product as two rows nobody could tell apart.

import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  ProductContainer, ProductKind, ProductListItemDto, ProductSaleUnit,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { ProductRow, VariantCard } from './ProductCatalog';

// The price beside each chip reads the active currency; the chip itself is what these tests are
// about, so the provider is stubbed the way SaleCatalog.test.tsx stubs it.
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number) => `${v ?? 0} Kč` }),
}));

function renderInTheme(ui: ReactElement) {
  return render(<MuiThemeProvider theme={theme}>{ui}</MuiThemeProvider>);
}

function tray(id: string, unitsPerPackage: number) {
  return new ProductListItemDto({
    id,
    name: 'Svijanský Máz',
    kind: ProductKind.Can,
    container: ProductContainer.Can,
    saleUnit: ProductSaleUnit.Tray,
    packageSize: 0.5,
    unitsPerPackage,
    priceWithVat: 525.6,
  });
}

describe('catalog size chips', () => {
  it('tells two trays of the same can apart by their count', () => {
    renderInTheme(
      <VariantCard
        group={{ name: 'Svijanský Máz', items: [tray('p-12', 12), tray('p-24', 24)] }}
        historyBadge={false}
        quantities={new Map()}
        onAdd={() => {}}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('12×0,5 l')).toBeInTheDocument();
    expect(screen.getByText('24×0,5 l')).toBeInTheDocument();
  });

  it('leaves a lone container as the bare volume', () => {
    renderInTheme(
      <ProductRow
        product={new ProductListItemDto({
          id: 'p-keg',
          name: 'Svijanská Desítka',
          kind: ProductKind.Keg,
          container: ProductContainer.Keg,
          saleUnit: ProductSaleUnit.Single,
          packageSize: 30,
          unitsPerPackage: 1,
          priceWithVat: 1290,
        })}
        qty={0}
        historyBadge={false}
        onAdd={() => {}}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('30 l')).toBeInTheDocument();
  });
});
