import { useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SegControl } from 'src/components/common/SegControl';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import {
  useGarageSalesBuyers,
  useGarageSalesProducts,
  useGarageSalesRevenue,
} from 'src/hooks/useSalesReports';
import {
  PERIOD_OPTIONS,
  apiGranularity,
  periodRange,
  type ReportPeriod,
  type VolumeGranularity,
} from 'src/features/reports/reportModel';
import {
  SALES_PERIOD_LABEL,
  SALES_TAB_OPTIONS,
  type SalesReportTab,
} from './salesReportModel';
import { RevenueTab } from './RevenueTab';
import { ProductsTab } from './ProductsTab';
import { BuyersTab } from './BuyersTab';

/**
 * Reporty prodejny — one page, three tabs, a shared period preset.
 *
 * Same shape as the shipment Reporty page: only the active tab's query runs, and the tabs
 * take loaded data as a plain prop rather than calling a hook on data that may be missing.
 * The period presets are imported from that screen instead of being duplicated, so both
 * report pages always offer the same windows.
 */
export function SalesReportsPage() {
  const [tab, setTab] = useState<SalesReportTab>('revenue');
  const [period, setPeriod] = useState<ReportPeriod>('90');
  const [granularity, setGranularity] = useState<VolumeGranularity>('week');

  const { from, to } = useMemo(() => periodRange(period), [period]);

  const revenue = useGarageSalesRevenue(from, to, apiGranularity(granularity), tab === 'revenue');
  const products = useGarageSalesProducts(from, to, tab === 'products');
  const buyers = useGarageSalesBuyers(from, to, tab === 'buyers');

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Garážový prodej"
        title="Reporty prodejny"
        subtitle={`Dokončené prodeje · ${SALES_PERIOD_LABEL[period]}.`}
      />

      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <SegControl value={tab} onChange={setTab} options={SALES_TAB_OPTIONS} />
        <SegControl value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </Stack>

      {tab === 'revenue' && (
        <QueryBoundary query={revenue}>
          {(data) => (
            <RevenueTab data={data} granularity={granularity} onGranularityChange={setGranularity} />
          )}
        </QueryBoundary>
      )}

      {tab === 'products' && (
        <QueryBoundary query={products}>{(data) => <ProductsTab data={data} />}</QueryBoundary>
      )}

      {tab === 'buyers' && (
        <QueryBoundary query={buyers}>{(data) => <BuyersTab data={data} />}</QueryBoundary>
      )}
    </PageContainer>
  );
}
