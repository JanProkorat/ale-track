import { Box, Card, Stack, Typography } from '@mui/material';
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
import { num } from 'src/lib/format';
import { kindLabel, kindName } from 'src/lib/labels';
import { ChartCard } from './ChartCard';
import {
  GRANULARITY_OPTIONS,
  bandAxisWidth,
  bucketLabel,
  fmtKg,
  fmtUnits,
  sharePct,
  tonnesAxisTick,
  type VolumeGranularity,
} from './reportModel';
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
  // through kindName (the enum's member name) rather than the Czech label, so two
  // labels can never collide — kindLabel is for display only. Also resolves either
  // wire form: the numeric enum (demo data) or its string name (the real API).
  const unitsForKind = (name: string) =>
    kinds.filter((k) => kindName(k.kind) === name).reduce((s, k) => s + (k.units ?? 0), 0);
  const kegUnits = unitsForKind('Keg');
  const bottleUnits = unitsForKind('Bottle');
  const canUnits = unitsForKind('Can') + unitsForKind('Multipack');

  const typeSlices = foldTypes(
    (data.byType ?? []).map((t) => ({ type: t.type!, weightKg: t.weightKg ?? 0, units: t.units ?? 0 })),
    palette
  );

  // Per-brewery colour for the horizontal bar chart's axis colour map: the brewery's own
  // token, falling back to a palette slot when it has none. `||`, not `??` — `color` is a
  // nullable string, and `??` only catches null/undefined, letting an empty string
  // through as an (invalid) d3 fill; same for the name fallback below.
  const breweryNames = breweries.map((b) => b.breweryName || '—');
  const breweryColors = breweries.map((b, i) => b.color || palette[i % palette.length]);
  // The axis needs a unique key per row for both its band-scale positions and its colour
  // map — @mui/x-charts keys both by value (confirmed by reading the installed package,
  // see the report), so two breweries sharing a display name (or two null names, both
  // rendered '—') would collapse onto the same band position and colour, silently
  // dropping a row. breweryId is unique on the DTO; the index is only a defensive
  // fallback for a malformed row missing it. The display name still reaches the axis via
  // valueFormatter, so labels and tooltips are unaffected.
  const breweryKeys = breweries.map((b, i) => b.breweryId ?? `__brewery_${i}`);
  const breweryNameByKey = new Map(breweryKeys.map((key, i) => [key, breweryNames[i]]));

  const kindColumns: Column<KindRow>[] = [
    { key: 'kind', header: 'Obal', render: (r) => kindLabel(r.kind) ?? String(r.kind) },
    { key: 'units', header: 'Kusů', align: 'right', render: (r) => num(r.units) },
    { key: 'weight', header: 'Hmotnost', align: 'right', render: (r) => fmtKg(r.weightKg) },
    { key: 'share', header: 'Podíl', align: 'right', render: (r) => sharePct(r.weightKg, total) },
  ];

  if (total === 0 && kinds.length === 0 && series.length === 0 && breweries.length === 0 && typeSlices.length === 0) {
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
              xAxis={[
                { scaleType: 'point', data: series.map((p) => bucketLabel(p.bucketStart, granularity)), height: 28 },
              ]}
              yAxis={[{ width: 56, valueFormatter: (v: number) => num(v) }]}
              margin={{ right: 16 }}
              hideLegend
            />
          </Box>
        </ChartCard>

        {/* No alignItems: 'start' — the grid's default stretch is what makes the pair share a
            height. Both cards take `fill` so the shorter one centres its chart in the leftover
            space rather than leaving a gap under it. The bar card grows with the brewery count
            while the donut is a fixed 158px, so which of the two is taller varies with the
            data; centring keeps either combination balanced. */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' } }}>
          <ChartCard icon={<SportsBarOutlinedIcon />} title="Podle pivovaru" fill>
            {/* +60 rather than +40: the x-axis label below costs an extra
                AXIS_LABEL_DEFAULT_HEIGHT (20px) of axis height, which would otherwise be
                taken out of the bars and thin every one of them. */}
            <Box sx={{ width: '100%', height: 60 + breweries.length * 46 }}>
              <BarChart
                layout="horizontal"
                series={[{ data: breweries.map((b) => b.weightKg ?? 0), valueFormatter: (v) => fmtKg(v ?? 0) }]}
                yAxis={[
                  {
                    scaleType: 'band',
                    // Keyed on breweryId, not breweryName: BarChart's getColor.js (bar
                    // variant) reads `yAxis.data[dataIndex]` and looks that value up in
                    // `yAxis.colorScale`, which is a d3 scaleOrdinal built from
                    // colorMap.values — i.e. both the band scale's positions AND the
                    // colour scale are keyed by VALUE EQUALITY, not by index (confirmed by
                    // reading @mui/x-charts-vendor's vendored d3-scale ordinal()/band(),
                    // which dedupe their domain via an InternMap.set(value, ...)). Two
                    // breweries sharing a name — or two null names, both rendered '—' —
                    // would otherwise collapse onto the same band position and colour,
                    // silently hiding one bar. valueFormatter below maps the id back to
                    // the display name for the tick labels and hover tooltip.
                    data: breweryKeys,
                    valueFormatter: (id: string) => breweryNameByKey.get(id) ?? '—',
                    // Fitted to the names instead of a flat 150, which pushed the plot
                    // right and left the card's left edge empty — see bandAxisWidth.
                    width: bandAxisWidth(breweryNames),
                    colorMap: { type: 'ordinal', values: breweryKeys, colors: breweryColors },
                  },
                ]}
                // Tonnes, matching the KPIs and the donut legend. The bars stay driven by the
                // raw kilogram values, so only the tick text is converted — see tonnesAxisTick.
                xAxis={[{ label: 'Hmotnost (t)', valueFormatter: tonnesAxisTick }]}
                // right: 24, not 16. A centred tick label is allowed twice the space between
                // its tick and the drawing area's edge (ChartsXAxis/shortenLabels.js), so the
                // last tick got 2*16 = 32px — enough for a tonne label like "50", but not for
                // the "50 000" this axis used to show, which MUI ellipsized to "50…". 2*24 =
                // 48px also clears a five-digit tonne axis ("1 250") on a very large period.
                margin={{ right: 24 }}
                hideLegend
              />
            </Box>
          </ChartCard>

          <ChartCard icon={<LocalOfferOutlinedIcon />} title="Podle typu" fill>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Donut with the prototype's centre total (line 892: chDonut(..., {center})).
                  MUI's PieChart has no built-in centre-text slot, so the total is an
                  absolutely-positioned overlay inside this relatively-positioned wrapper;
                  pointerEvents: 'none' keeps it out of the hover/tooltip hit area. */}
              <Box sx={{ position: 'relative', width: 158, height: 158, flex: '0 0 auto' }}>
                <PieChart
                  series={[
                    {
                      // Radii must stay inside the 158px box: with margin 0 the chart's
                      // available radius is 158/2 = 79, and anything past that is clipped by
                      // the SVG viewport (a squared-off ring, not a smaller one). These are
                      // the prototype's own numbers — chDonut draws r=(158/2)-12=67 with
                      // stroke-width 18, i.e. a ring spanning radius 58 → 76.
                      innerRadius: 58,
                      outerRadius: 76,
                      paddingAngle: 1.5,
                      data: typeSlices.map((s, i) => ({ id: i, value: s.value, label: s.label, color: s.color })),
                      valueFormatter: (v) => fmtKg(v.value),
                    },
                  ]}
                  width={158}
                  height={158}
                  margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
                  // The legend is hand-rolled below (with per-type weights, which MUI's
                  // built-in legend does not show) — hide the chart's own to avoid a duplicate.
                  hideLegend
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 19, lineHeight: 1.2 }}>{fmtKg(total)}</Typography>
                    <Typography
                      sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}
                    >
                      celkem
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Hand-rolled legend (prototype's `legend()`, line 852): swatch + label + weight
                  per slice, right-aligned. This is the required contrast relief for the amber
                  and sky slots (see reportPalette.ts) — never drop it in favour of hideLegend
                  alone. */}
              <Stack spacing={1} sx={{ flex: 1, minWidth: 170 }}>
                {typeSlices.map((s) => (
                  <Stack key={s.label} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.75, bgcolor: s.color, flex: '0 0 auto' }} />
                    <Typography sx={{ fontSize: 12.5, flex: 1 }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.secondary' }}>
                      {fmtKg(s.value)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </ChartCard>
        </Box>

        <ChartCard icon={<Inventory2OutlinedIcon />} title="Podle obalu" padded={false}>
          <DataTable
            columns={kindColumns}
            rows={kinds.map((k) => ({ kind: k.kind ?? 'Other', units: k.units ?? 0, weightKg: k.weightKg ?? 0 }))}
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
