import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Chip, Stack } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { StatCard } from 'src/components/common/StatCard';
import { SegControl } from 'src/components/common/SegControl';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { type ClientVolumeReportDto, type ClientVolumeRowDto } from 'src/generated/api-client';
import { num } from 'src/lib/format';
import { regionLabel } from 'src/lib/labels';
import { PATHS } from 'src/routes/paths';
import { ChartCard } from './ChartCard';
import {
  METRIC_OPTIONS,
  bandAxisWidth,
  clientMetricFormat,
  clientMetricValue,
  fmtKg,
  sharePct,
  tonnesAxisTick,
  type ClientMetric,
} from './reportModel';
import { useReportPalette } from './reportPalette';

/**
 * Klienti — who took delivery and how much. Ported from the prototype's `repClients`
 * (docs/prototype/aletrack-prototype.html:913). The top-clients chart is one series in
 * one colour on purpose (prototype line 919, `color:'var(--amber)'` for every row): a
 * single-series bar chart only ever reads `colors[0]` (@mui/x-charts indexes `colors` by
 * series, not by data point), and per-bar hues here would encode rank, which the palette
 * rules forbid. Same for the per-region chart (prototype line 920, `var(--info)` for
 * every row) — it gets its own fixed slot instead.
 *
 * Deviation from the prototype: `repClients` derives "Rozvozů" from `new Set(dates).size`
 * per client (distinct delivery days) computed client-side from raw records. The real
 * `ClientVolumeRowDto.deliveries` is whatever the backend's report query counts as a
 * delivery — the frontend has no raw records to re-derive it from, so it is used as-is.
 */
export function ClientsTab({ data }: { data: ClientVolumeReportDto }) {
  const navigate = useNavigate();
  const palette = useReportPalette();
  const [metric, setMetric] = useState<ClientMetric>('kg');

  const clients = data.topClients ?? [];
  const regions = data.byRegion ?? [];
  const total = data.totalWeightKg ?? 0;
  const served = data.clientsServed ?? 0;

  const averagePerClient = served > 0 ? total / served : 0;
  const strongestRegion = regions[0];

  const top = clients.slice(0, 10);
  const metricValue = (c: ClientVolumeRowDto) => clientMetricValue(c, metric);
  const metricFormat = (v: number) => clientMetricFormat(v, metric);

  const clientNames = top.map((c) => c.clientName ?? '—');
  const regionNames = regions.map((r) => regionLabel(r.region) ?? '—');

  // The top-clients axis follows the Hmotnost/Kusy toggle: tonnes for weight (matching the
  // KPIs and the table), a raw count for units. Only the tick text is converted — the bars
  // stay driven by the underlying values.
  const clientAxis =
    metric === 'kg'
      ? { label: 'Hmotnost (t)', valueFormatter: tonnesAxisTick }
      : { label: 'Počet kusů', valueFormatter: (v: number) => num(v) };

  const columns: Column<ClientVolumeRowDto>[] = [
    { key: 'name', header: 'Klient', render: (r) => r.clientName },
    {
      key: 'region',
      header: 'Region',
      hideOnMobile: true,
      render: (r) => (
        <Chip
          size="small"
          variant="outlined"
          icon={<PlaceOutlinedIcon />}
          label={regionLabel(r.region) ?? '—'}
        />
      ),
    },
    { key: 'deliveries', header: 'Rozvozů', align: 'right', render: (r) => num(r.deliveries ?? 0) },
    { key: 'units', header: 'Kusů', align: 'right', render: (r) => num(r.units ?? 0) },
    { key: 'weight', header: 'Hmotnost', align: 'right', render: (r) => fmtKg(r.weightKg ?? 0) },
    { key: 'share', header: 'Podíl', align: 'right', render: (r) => sharePct(r.weightKg ?? 0, total) },
  ];

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard icon={<StorefrontOutlinedIcon />} tone="info" label="Klientů obslouženo" value={num(served)} />
        <StatCard
          icon={<LocalShippingOutlinedIcon />}
          tone="grey"
          label="Rozvozů celkem"
          value={num(data.totalDeliveries ?? 0)}
        />
        <StatCard
          icon={<InsightsOutlinedIcon />}
          tone="amber"
          label="Průměr na klienta"
          value={fmtKg(averagePerClient)}
        />
        <StatCard
          icon={<PlaceOutlinedIcon />}
          tone="ok"
          label="Nejsilnější region"
          value={strongestRegion ? (regionLabel(strongestRegion.region) ?? '—') : '—'}
          hint={strongestRegion ? fmtKg(strongestRegion.weightKg ?? 0) : undefined}
        />
      </Box>

      {clients.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {/* No alignItems: 'start' — the grid's default stretch is what makes the pair share
              a height. Both cards take `fill` so the shorter chart centres in the leftover
              space instead of leaving one card mostly empty below its bars. */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' } }}>
            <ChartCard
              icon={<StorefrontOutlinedIcon />}
              title="Nejlepší klienti"
              action={<SegControl value={metric} onChange={setMetric} options={METRIC_OPTIONS} />}
              fill
            >
              {/* +60 rather than +40: the x-axis label costs an extra 20px of axis height
                  (AXIS_LABEL_DEFAULT_HEIGHT), which would otherwise thin every bar. */}
              <Box sx={{ width: '100%', height: 60 + top.length * 40 }}>
                <BarChart
                  layout="horizontal"
                  series={[{ data: top.map(metricValue), valueFormatter: (v) => metricFormat(v ?? 0) }]}
                  // Fitted to the names, not a flat 170 — the plot area starts at
                  // margin.left + width, so an over-wide band shifts the whole chart right.
                  yAxis={[{ scaleType: 'band', data: clientNames, width: bandAxisWidth(clientNames, 170) }]}
                  xAxis={[clientAxis]}
                  colors={[palette[0]]}
                  // 2*24 = 48px of room for the last tick label (ChartsXAxis/shortenLabels.js
                  // allows a centred label twice its distance to the edge), so it is not
                  // ellipsized the way "50 000" was at right: 16.
                  margin={{ right: 24 }}
                  hideLegend
                />
              </Box>
            </ChartCard>

            <ChartCard icon={<MapOutlinedIcon />} title="Podle regionu" fill>
              <Box sx={{ width: '100%', height: 60 + regions.length * 40 }}>
                <BarChart
                  layout="horizontal"
                  series={[{ data: regions.map((r) => r.weightKg ?? 0), valueFormatter: (v) => fmtKg(v ?? 0) }]}
                  yAxis={[{ scaleType: 'band', data: regionNames, width: bandAxisWidth(regionNames, 130) }]}
                  xAxis={[{ label: 'Hmotnost (t)', valueFormatter: tonnesAxisTick }]}
                  colors={[palette[3]]}
                  margin={{ right: 24 }}
                  hideLegend
                />
              </Box>
            </ChartCard>
          </Box>

          <ChartCard icon={<StorefrontOutlinedIcon />} title="Všichni klienti" padded={false}>
            <DataTable
              columns={columns}
              rows={clients}
              getRowKey={(r) => String(r.clientId)}
              onRowClick={(r) => navigate(`${PATHS.clients}/${r.clientId}`)}
              dense
            />
          </ChartCard>
        </Stack>
      )}
    </>
  );
}
