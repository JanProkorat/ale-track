import { Box, Card, Stack } from '@mui/material';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { ChartCard } from 'src/features/reports/ChartCard';
import { bandAxisWidth } from 'src/features/reports/reportModel';
import { useReportPalette } from 'src/features/reports/reportPalette';
import { useCurrency } from 'src/providers/CurrencyProvider';
import {
  type GarageSalesProductsReportDto,
  type ProductSalesRowDto,
  type StockCoverageRowDto,
} from 'src/generated/api-client';
import { num, fmtLiters } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { discountShare, fmtDaysOfCover } from './salesReportModel';

const TOP_N = 10;

/**
 * Zboží — what moved off the shelf, what it was discounted by, and what is not moving.
 *
 * Stock coverage is an approximation, and says so: `InventoryItem.Quantity` is a live value
 * with no ledger behind it, so the column relates today's shelf to the window's sales rate.
 * Rows that never sold carry a dash rather than a number — see `fmtDaysOfCover`.
 */
export function ProductsTab({ data }: { data: GarageSalesProductsReportDto }) {
  const palette = useReportPalette();
  const { formatMoney } = useCurrency();

  const products = data.topProducts ?? [];
  const byKind = data.byKind ?? [];
  const stock = data.stockCoverage ?? [];

  const top = products.slice(0, TOP_N);
  const productNames = top.map((p) => p.name || '—');
  const neverSold = stock.filter((s) => s.daysOfCover == null).length;

  const productColumns: Column<ProductSalesRowDto>[] = [
    { key: 'name', header: 'Zboží', render: (r) => r.name },
    { key: 'kind', header: 'Balení', hideOnMobile: true, render: (r) => (r.kind != null ? kindLabel(r.kind) : '—') },
    { key: 'units', header: 'Kusů', align: 'right', render: (r) => num(r.units ?? 0) },
    { key: 'litres', header: 'Objem', align: 'right', hideOnMobile: true, render: (r) => fmtLiters(r.litres ?? 0) },
    { key: 'discount', header: 'Sleva', align: 'right', render: (r) => formatMoney(r.discountTotal ?? 0) },
    { key: 'revenue', header: 'Tržba', align: 'right', render: (r) => formatMoney(r.revenue ?? 0) },
  ];

  const stockColumns: Column<StockCoverageRowDto>[] = [
    { key: 'name', header: 'Zboží', render: (r) => r.name },
    { key: 'quantity', header: 'Na skladě', align: 'right', render: (r) => `${num(r.quantity ?? 0)} ks` },
    { key: 'sold', header: 'Prodáno', align: 'right', render: (r) => `${num(r.unitsSold ?? 0)} ks` },
    { key: 'cover', header: 'Vystačí na', align: 'right', render: (r) => fmtDaysOfCover(r.daysOfCover) },
  ];

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard icon={<SportsBarOutlinedIcon />} tone="amber" label="Druhů zboží prodáno" value={num(products.length)} />
        <StatCard
          icon={<LocalOfferOutlinedIcon />}
          tone="info"
          label="Slevy celkem"
          value={formatMoney(data.discountTotal ?? 0)}
          hint={`${discountShare(data.discountedRevenueShare ?? 0)} z ceníkové ceny`}
        />
        <StatCard icon={<Inventory2OutlinedIcon />} tone="grey" label="Položek skladem" value={num(stock.length)} />
        <StatCard
          icon={<HourglassEmptyOutlinedIcon />}
          tone={neverSold > 0 ? 'crit' : 'ok'}
          label="Bez prodeje"
          value={num(neverSold)}
          hint="za zvolené období"
        />
      </Box>

      {products.length === 0 && stock.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' } }}>
            <ChartCard icon={<SportsBarOutlinedIcon />} title={`Nejprodávanější zboží (top ${TOP_N})`} fill>
              {/* +60 rather than +40: the x-axis label costs an extra 20px of axis height,
                  which would otherwise be taken out of the bars. */}
              <Box sx={{ width: '100%', height: 60 + Math.max(top.length, 1) * 40 }}>
                <BarChart
                  layout="horizontal"
                  series={[
                    {
                      data: top.map((p) => p.revenue ?? 0),
                      valueFormatter: (v) => formatMoney(v ?? 0),
                    },
                  ]}
                  yAxis={[{ scaleType: 'band', data: productNames, width: bandAxisWidth(productNames, 170) }]}
                  xAxis={[{ label: 'Tržba', valueFormatter: (v: number) => num(v) }]}
                  colors={[palette[0]]}
                  margin={{ right: 24 }}
                  hideLegend
                />
              </Box>
            </ChartCard>

            <ChartCard icon={<Inventory2OutlinedIcon />} title="Podle balení" fill>
              <Box sx={{ width: '100%', height: 260 }}>
                <PieChart
                  series={[
                    {
                      // Coloured by packaging identity, never by rank — a filter change must
                      // not repaint every slice.
                      data: byKind.map((k, index) => ({
                        id: k.kind != null ? kindLabel(k.kind) : 'Ostatní',
                        value: k.revenue ?? 0,
                        label: k.kind != null ? kindLabel(k.kind) : 'Ostatní',
                        color: palette[index % palette.length],
                      })),
                      innerRadius: 52,
                      outerRadius: 96,
                      valueFormatter: (slice) => formatMoney(slice.value),
                    },
                  ]}
                />
              </Box>
            </ChartCard>
          </Box>

          <ChartCard icon={<SportsBarOutlinedIcon />} title="Všechno prodané zboží" padded={products.length === 0}>
            {products.length === 0 ? (
              <EmptyState title="Za zvolené období se nic neprodalo." />
            ) : (
              <DataTable columns={productColumns} rows={products} getRowKey={(r) => r.name ?? ''} dense />
            )}
          </ChartCard>

          <ChartCard
            icon={<HourglassEmptyOutlinedIcon />}
            title="Ležáky na skladě"
            padded={stock.length === 0}
          >
            {stock.length === 0 ? (
              <EmptyState title="Sklad je prázdný." />
            ) : (
              <DataTable columns={stockColumns} rows={stock} getRowKey={(r) => String(r.inventoryItemId)} dense />
            )}
          </ChartCard>
        </Stack>
      )}
    </>
  );
}
