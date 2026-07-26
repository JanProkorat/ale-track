import { Box, Card, Stack } from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { SegControl } from 'src/components/common/SegControl';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { type DeliveryVolumeReportDto, type ProductKind } from 'src/generated/api-client';
import { fmtDateShort, num } from 'src/lib/format';
import { kindLabel, L } from 'src/lib/labels';
import { ChartCard } from './ChartCard';
import { GRANULARITY_OPTIONS, fmtKg, fmtUnits, sharePct, type VolumeGranularity } from './reportModel';
import { foldTypes, useReportPalette } from './reportPalette';

interface KindRow {
  kind: ProductKind | string | number;
  units: number;
  weightKg: number;
}

/**
 * Objem — delivered volume: four KPIs, a trend, per-brewery and per-type breakdowns,
 * and a per-package table. Ported from the prototype's `repVolume` (line 883).
 */
export function VolumeTab({
  data,
  granularity,
  onGranularityChange,
}: {
  data: DeliveryVolumeReportDto;
  granularity: VolumeGranularity;
  onGranularityChange: (g: VolumeGranularity) => void;
}) {
  const palette = useReportPalette();

  const total = data.totalWeightKg ?? 0;
  const kinds = data.unitsByKind ?? [];
  const breweries = data.byBrewery ?? [];
  const series = data.series ?? [];

  // Kind buckets the prototype's KPIs use; cans and multipacks share one tile. Goes
  // through kindLabel rather than comparing the raw enum, since the wire form can be
  // either the numeric enum (demo data) or its string name (the real API).
  const unitsForKind = (label: string) =>
    kinds.filter((k) => kindLabel(k.kind) === label).reduce((s, k) => s + (k.units ?? 0), 0);
  const kegUnits = unitsForKind(L.kind.Keg);
  const bottleUnits = unitsForKind(L.kind.Bottle);
  const canUnits = unitsForKind(L.kind.Can) + unitsForKind(L.kind.Multipack);

  const typeSlices = foldTypes(
    (data.byType ?? []).map((t) => ({ type: t.type!, weightKg: t.weightKg ?? 0, units: t.units ?? 0 })),
    palette
  );

  const kindColumns: Column<KindRow>[] = [
    { key: 'kind', header: 'Obal', render: (r) => kindLabel(r.kind) ?? String(r.kind) },
    { key: 'units', header: 'Kusů', align: 'right', render: (r) => num(r.units) },
    { key: 'weight', header: 'Hmotnost', align: 'right', render: (r) => fmtKg(r.weightKg) },
    { key: 'share', header: 'Podíl', align: 'right', render: (r) => sharePct(r.weightKg, total) },
  ];

  if (total === 0 && kinds.length === 0 && series.length === 0) {
    return (
      <>
        <KpiRow total={total} clientsServed={data.clientsServed ?? 0} kegUnits={0} bottleUnits={0} canUnits={0} />
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      </>
    );
  }

  return (
    <>
      <KpiRow
        total={total}
        clientsServed={data.clientsServed ?? 0}
        kegUnits={kegUnits}
        bottleUnits={bottleUnits}
        canUnits={canUnits}
      />

      <Stack spacing={2} sx={{ mt: 2 }}>
        <ChartCard
          icon={<InsightsOutlinedIcon />}
          title="Dodané množství v čase"
          action={<SegControl value={granularity} onChange={onGranularityChange} options={GRANULARITY_OPTIONS} />}
        >
          <Box sx={{ width: '100%', height: 260 }}>
            <LineChart
              series={[{ data: series.map((p) => p.weightKg ?? 0), label: 'Hmotnost', area: true, color: palette[0] }]}
              xAxis={[{ scaleType: 'point', data: series.map((p) => fmtDateShort(p.bucketStart)), height: 28 }]}
              yAxis={[{ width: 56, valueFormatter: (v: number) => num(v) }]}
              margin={{ right: 16 }}
              hideLegend
            />
          </Box>
        </ChartCard>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' }, alignItems: 'start' }}>
          <ChartCard icon={<SportsBarOutlinedIcon />} title="Podle pivovaru">
            <Box sx={{ width: '100%', height: 40 + breweries.length * 46 }}>
              <BarChart
                layout="horizontal"
                series={[{ data: breweries.map((b) => b.weightKg ?? 0), valueFormatter: (v) => fmtKg(v ?? 0) }]}
                yAxis={[{ scaleType: 'band', data: breweries.map((b) => b.breweryName ?? '—'), width: 150 }]}
                xAxis={[{ valueFormatter: (v: number) => num(v) }]}
                // Colour follows the brewery's own token, so a filter never repaints it.
                colors={breweries.map((b, i) => b.color ?? palette[i % palette.length])}
                margin={{ right: 16 }}
                hideLegend
              />
            </Box>
          </ChartCard>

          <ChartCard icon={<LocalOfferOutlinedIcon />} title="Podle typu">
            <Box sx={{ width: '100%', height: 240 }}>
              <PieChart
                series={[
                  {
                    innerRadius: 52,
                    outerRadius: 92,
                    paddingAngle: 1.5,
                    data: typeSlices.map((s, i) => ({ id: i, value: s.value, label: s.label, color: s.color })),
                    valueFormatter: (v) => fmtKg(v.value),
                  },
                ]}
              />
            </Box>
          </ChartCard>
        </Box>

        <ChartCard icon={<Inventory2OutlinedIcon />} title="Podle obalu" padded={false}>
          <DataTable
            columns={kindColumns}
            rows={kinds.map((k) => ({ kind: k.kind ?? L.kind.Other, units: k.units ?? 0, weightKg: k.weightKg ?? 0 }))}
            getRowKey={(r) => String(r.kind)}
            dense
          />
        </ChartCard>
      </Stack>
    </>
  );
}

/** The prototype's four Objem KPIs (line 896). */
function KpiRow({
  total,
  clientsServed,
  kegUnits,
  bottleUnits,
  canUnits,
}: {
  total: number;
  clientsServed: number;
  kegUnits: number;
  bottleUnits: number;
  canUnits: number;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
      <StatCard
        icon={<InsightsOutlinedIcon />}
        tone="amber"
        label="Celkem dodáno"
        value={fmtKg(total)}
        hint={`${num(clientsServed)} klientů obslouženo`}
      />
      <StatCard icon={<Inventory2OutlinedIcon />} tone="info" label="Sudy" value={fmtUnits(kegUnits)} />
      <StatCard icon={<Inventory2OutlinedIcon />} tone="grey" label="Lahve (basy)" value={fmtUnits(bottleUnits)} />
      <StatCard icon={<Inventory2OutlinedIcon />} tone="ok" label="Plechovky / multipack" value={fmtUnits(canUnits)} />
    </Box>
  );
}
