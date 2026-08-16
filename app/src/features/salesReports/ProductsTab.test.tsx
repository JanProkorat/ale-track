import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import {
  GarageSalesProductsReportDto,
  ProductKind,
  ProductSalesRowDto,
  StockCoverageRowDto,
  type IGarageSalesProductsReportDto,
} from 'src/generated/api-client';
import { ProductsTab } from './ProductsTab';

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => `${czk ?? 0} Kč` }),
}));

function renderTab(data: Partial<IGarageSalesProductsReportDto>) {
  return render(
    <ThemeProvider theme={theme}>
      <ProductsTab
        data={
          new GarageSalesProductsReportDto({
            topProducts: [],
            byKind: [],
            discountTotal: 0,
            discountedRevenueShare: 0,
            stockCoverage: [],
            ...data,
          })
        }
      />
    </ThemeProvider>
  );
}

const stockRow = (over: Partial<StockCoverageRowDto>) =>
  new StockCoverageRowDto({
    inventoryItemId: '11111111-1111-1111-1111-111111111111',
    name: 'Ležák 12°',
    quantity: 10,
    unitsSold: 31,
    daysOfCover: 10,
    ...over,
  });

describe('ProductsTab', () => {
  it('lists sold products with their discount and revenue', () => {
    renderTab({
      topProducts: [
        new ProductSalesRowDto({ productId: undefined, name: 'Ležák 12°', kind: ProductKind.Keg, units: 3, litres: 150, revenue: 4500, discountTotal: 300 }),
      ],
      discountTotal: 300,
      discountedRevenueShare: 0.0625,
    });

    expect(screen.getAllByText('Ležák 12°').length).toBeGreaterThan(0);
    expect(screen.getByText('6,3 % z ceníkové ceny')).toBeInTheDocument();
  });

  // The distinction the whole stock table exists for: never sold is not a long cover.
  it('renders an em dash for stock that never sold', () => {
    renderTab({ stockCoverage: [stockRow({ unitsSold: 0, daysOfCover: undefined })] });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0 dní')).not.toBeInTheDocument();
  });

  it('renders days of cover for stock that did sell', () => {
    renderTab({ stockCoverage: [stockRow({})] });

    expect(screen.getByText('10 dní')).toBeInTheDocument();
  });

  it('counts never-sold rows in the KPI row', () => {
    renderTab({
      stockCoverage: [
        stockRow({ unitsSold: 0, daysOfCover: undefined }),
        stockRow({ inventoryItemId: '22222222-2222-2222-2222-222222222222', name: 'Vánoční speciál', unitsSold: 0, daysOfCover: undefined }),
        stockRow({ inventoryItemId: '33333333-3333-3333-3333-333333333333', name: 'Světlé 10°' }),
      ],
    });

    expect(screen.getByText('Bez prodeje')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the empty-state when nothing sold and nothing is in stock', () => {
    renderTab({});

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
  });

  // Stock still on the shelf is worth seeing even in a period with no sales at all.
  it('still shows stock coverage when nothing sold in the period', () => {
    renderTab({ stockCoverage: [stockRow({ unitsSold: 0, daysOfCover: undefined })] });

    expect(screen.queryByText('Za zvolené období nejsou žádná data.')).not.toBeInTheDocument();
    expect(screen.getByText('Ležáky na skladě')).toBeInTheDocument();
    expect(screen.getByText('Za zvolené období se nic neprodalo.')).toBeInTheDocument();
  });

  it('labels a free-form line with no packaging rather than rendering a raw enum', () => {
    renderTab({
      topProducts: [
        new ProductSalesRowDto({ productId: undefined, name: 'Vratná basa', kind: undefined, units: 5, litres: 0, revenue: 750, discountTotal: 0 }),
      ],
    });

    expect(screen.getAllByText('Vratná basa').length).toBeGreaterThan(0);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
