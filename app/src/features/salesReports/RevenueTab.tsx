import { useNavigate } from 'react-router-dom';
import { Box, Card, Stack } from '@mui/material';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { StatusPill } from 'src/components/common/StatusPill';
import { SegControl } from 'src/components/common/SegControl';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { ChartCard } from 'src/features/reports/ChartCard';
import { GRANULARITY_OPTIONS, bucketLabel, type VolumeGranularity } from 'src/features/reports/reportModel';
import { useReportPalette } from 'src/features/reports/reportPalette';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { type GarageSalesRevenueReportDto, type UnpaidInvoiceRowDto } from 'src/generated/api-client';
import { num, fmtDate, fmtLiters } from 'src/lib/format';
import { PATHS } from 'src/routes/paths';
import { overdueTone, paymentLabel } from './salesReportModel';

/**
 * Tržby — what the counter took, how it was paid for, and what is still owed.
 *
 * The outstanding-invoice table is the only part of this screen that is not window-bound:
 * the endpoint returns every unpaid invoice regardless of period, because an invoice that
 * went unpaid months ago is exactly the one worth chasing today.
 */
export function RevenueTab({
  data,
  granularity,
  onGranularityChange,
}: {
  data: GarageSalesRevenueReportDto;
  granularity: VolumeGranularity;
  onGranularityChange: (g: VolumeGranularity) => void;
}) {
  const navigate = useNavigate();
  const palette = useReportPalette();
  const { formatMoney } = useCurrency();

  const trend = data.trend ?? [];
  const byPayment = data.byPayment ?? [];
  const unpaid = data.unpaidInvoices ?? [];

  const overdueLabel = (days: number | null | undefined) => {
    if (days == null) return 'Bez splatnosti';
    if (days <= 0) return `Do splatnosti ${-days} dní`;
    return `Po splatnosti ${days} dní`;
  };

  const columns: Column<UnpaidInvoiceRowDto>[] = [
    { key: 'date', header: 'Prodej', render: (r) => fmtDate(r.saleDate) },
    { key: 'buyer', header: 'Odběratel', render: (r) => r.buyerLabel || 'Neuvedeno' },
    { key: 'due', header: 'Splatnost', hideOnMobile: true, render: (r) => (r.dueDate ? fmtDate(r.dueDate) : '—') },
    {
      key: 'overdue',
      header: 'Stav',
      render: (r) => <StatusPill tone={overdueTone(r.daysOverdue)} label={overdueLabel(r.daysOverdue)} />,
    },
    { key: 'amount', header: 'Částka', align: 'right', render: (r) => formatMoney(r.amount ?? 0) },
  ];

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard icon={<PaidOutlinedIcon />} tone="amber" label="Tržba celkem" value={formatMoney(data.totalRevenue ?? 0)} />
        <StatCard icon={<ShoppingCartOutlinedIcon />} tone="info" label="Prodejů" value={num(data.salesCount ?? 0)} />
        <StatCard
          icon={<InsightsOutlinedIcon />}
          tone="grey"
          label="Průměrný nákup"
          value={formatMoney(data.averageSale ?? 0)}
        />
        <StatCard
          icon={<SportsBarOutlinedIcon />}
          tone="ok"
          label="Prodáno"
          value={`${num(data.totalUnits ?? 0)} ks`}
          hint={fmtLiters(data.totalLitres ?? 0)}
        />
      </Box>

      {data.salesCount === 0 && unpaid.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' } }}>
            <ChartCard
              icon={<InsightsOutlinedIcon />}
              title="Tržby v čase"
              action={<SegControl value={granularity} onChange={onGranularityChange} options={GRANULARITY_OPTIONS} />}
              fill
            >
              <Box sx={{ width: '100%', height: 260 }}>
                <LineChart
                  series={[
                    {
                      data: trend.map((p) => p.revenue ?? 0),
                      label: 'Tržba',
                      area: true,
                      color: palette[0],
                      valueFormatter: (v) => formatMoney(v ?? 0),
                    },
                  ]}
                  xAxis={[
                    {
                      scaleType: 'point',
                      data: trend.map((p) => bucketLabel(p.bucketStart, granularity)),
                      height: 28,
                    },
                  ]}
                  yAxis={[{ width: 64, valueFormatter: (v: number) => num(v) }]}
                  margin={{ right: 16 }}
                  hideLegend
                />
              </Box>
            </ChartCard>

            <ChartCard icon={<PaidOutlinedIcon />} title="Podle způsobu platby" fill>
              <Box sx={{ width: '100%', height: 260 }}>
                <PieChart
                  series={[
                    {
                      // Coloured by payment method's own slot, so the split keeps its colours
                      // when one method drops out of the window.
                      data: byPayment.map((p, index) => ({
                        id: paymentLabel(p.payment),
                        value: p.revenue ?? 0,
                        label: paymentLabel(p.payment),
                        color: palette[index === 0 ? 0 : 3],
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

          <ChartCard
            icon={<ReceiptLongOutlinedIcon />}
            title={`Neuhrazené faktury · ${formatMoney(data.unpaidTotal ?? 0)}`}
            padded={unpaid.length === 0}
          >
            {unpaid.length === 0 ? (
              <EmptyState icon={<WarningAmberOutlinedIcon />} title="Všechny faktury jsou uhrazené." />
            ) : (
              <DataTable
                columns={columns}
                rows={unpaid}
                getRowKey={(r) => String(r.saleId)}
                onRowClick={(r) => navigate(`${PATHS.sales}/${r.saleId}`)}
                dense
              />
            )}
          </ChartCard>
        </Stack>
      )}
    </>
  );
}
