import { useNavigate } from 'react-router-dom';
import { Box, Card, Stack } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { ChartCard } from 'src/features/reports/ChartCard';
import { bandAxisWidth, sharePct } from 'src/features/reports/reportModel';
import { useReportPalette } from 'src/features/reports/reportPalette';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { type BuyerClientRowDto, type GarageSalesBuyersReportDto } from 'src/generated/api-client';
import { num, fmtDate } from 'src/lib/format';
import { PATHS } from 'src/routes/paths';
import { buyerKindLabel } from './salesReportModel';

const TOP_N = 10;

/**
 * Kupující — who buys at the counter.
 *
 * Walk-ins are one bucket and carry no link: the sale records at most a typed name, which
 * identifies nobody, so there is no buyer record to navigate to.
 */
export function BuyersTab({ data }: { data: GarageSalesBuyersReportDto }) {
  const navigate = useNavigate();
  const palette = useReportPalette();
  const { formatMoney } = useCurrency();

  const byBuyerKind = data.byBuyerKind ?? [];
  const clients = data.topClients ?? [];

  const totalRevenue = byBuyerKind.reduce((sum, b) => sum + (b.revenue ?? 0), 0);
  const clientRevenue = clients.reduce((sum, c) => sum + (c.revenue ?? 0), 0);

  const top = clients.slice(0, TOP_N);
  const clientNames = top.map((c) => c.clientName || '—');

  const columns: Column<BuyerClientRowDto>[] = [
    { key: 'name', header: 'Klient', render: (r) => r.clientName },
    { key: 'sales', header: 'Nákupů', align: 'right', render: (r) => num(r.salesCount ?? 0) },
    {
      key: 'last',
      header: 'Poslední nákup',
      align: 'right',
      hideOnMobile: true,
      render: (r) => fmtDate(r.lastPurchase),
    },
    { key: 'revenue', header: 'Tržba', align: 'right', render: (r) => formatMoney(r.revenue ?? 0) },
    { key: 'share', header: 'Podíl', align: 'right', render: (r) => sharePct(r.revenue ?? 0, totalRevenue) },
  ];

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard icon={<StorefrontOutlinedIcon />} tone="info" label="Klientů nakoupilo" value={num(clients.length)} />
        <StatCard icon={<ReplayOutlinedIcon />} tone="ok" label="Opakovaní kupující" value={num(data.repeatBuyers ?? 0)} />
        <StatCard
          icon={<PersonOutlineOutlinedIcon />}
          tone="grey"
          label="Jednorázoví kupující"
          value={num(data.oneTimeBuyers ?? 0)}
        />
        <StatCard
          icon={<GroupOutlinedIcon />}
          tone="amber"
          label="Podíl klientů na tržbě"
          value={sharePct(clientRevenue, totalRevenue)}
          hint={formatMoney(clientRevenue)}
        />
      </Box>

      {byBuyerKind.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.25fr' } }}>
            <ChartCard icon={<GroupOutlinedIcon />} title="Klienti vs. jednorázoví" fill>
              <Box sx={{ width: '100%', height: 260 }}>
                <PieChart
                  series={[
                    {
                      // Coloured by buyer kind's own slot, so the split keeps its colours when
                      // one kind drops out of the window.
                      data: byBuyerKind.map((b, index) => ({
                        id: buyerKindLabel(b.buyerKind),
                        value: b.revenue ?? 0,
                        label: buyerKindLabel(b.buyerKind),
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

            <ChartCard icon={<StorefrontOutlinedIcon />} title={`Nejlepší klienti (top ${TOP_N})`} fill>
              <Box sx={{ width: '100%', height: 60 + Math.max(top.length, 1) * 40 }}>
                <BarChart
                  layout="horizontal"
                  series={[
                    { data: top.map((c) => c.revenue ?? 0), valueFormatter: (v) => formatMoney(v ?? 0) },
                  ]}
                  yAxis={[{ scaleType: 'band', data: clientNames, width: bandAxisWidth(clientNames, 170) }]}
                  xAxis={[{ label: 'Tržba', valueFormatter: (v: number) => num(v) }]}
                  colors={[palette[0]]}
                  margin={{ right: 24 }}
                  hideLegend
                />
              </Box>
            </ChartCard>
          </Box>

          <ChartCard icon={<StorefrontOutlinedIcon />} title="Všichni klienti" padded={clients.length === 0}>
            {clients.length === 0 ? (
              <EmptyState title="Za zvolené období nakoupili jen jednorázoví kupující." />
            ) : (
              <DataTable
                columns={columns}
                rows={clients}
                getRowKey={(r) => String(r.clientId)}
                onRowClick={(r) => navigate(`${PATHS.clients}/${r.clientId}`)}
                dense
              />
            )}
          </ChartCard>
        </Stack>
      )}
    </>
  );
}
