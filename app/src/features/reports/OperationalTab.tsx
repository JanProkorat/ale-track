import { Box, Card, Stack, Typography, useTheme } from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { EmptyState } from 'src/components/common/EmptyState';
import { type OperationsReportDto } from 'src/generated/api-client';
import { num } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, type StatusTone } from 'src/lib/labels';
import { ChartCard } from './ChartCard';
import { bucketLabel, fmtKg, fmtUnits } from './reportModel';
import { useReportPalette } from './reportPalette';

/**
 * Provoz — how the operation ran. Ported from the prototype's `repOps`
 * (docs/prototype/aletrack-prototype.html:939).
 *
 * Shipment state and punctuality take their colours from the theme's reserved status
 * tokens, never from the categorical palette: those hues carry meaning elsewhere in the
 * app (StatusPill uses the same ones), and reusing them for arbitrary categories would
 * make "green" stop meaning "delivered". Every slice also ships a legend label, so state
 * is never conveyed by colour alone.
 */
export function OperationalTab({ data }: { data: OperationsReportDto }) {
  const theme = useTheme();
  const palette = useReportPalette();

  const states = data.shipmentsByState ?? [];
  const months = data.incomingVsOutgoing ?? [];
  const drivers = data.byDriver ?? [];
  const onTime = Number(data.onTimePercentage ?? 0);

  // The same status tokens StatusPill maps its tones onto.
  const toneColor: Record<StatusTone, string> = {
    amber: theme.vars!.palette.warning.main,
    ok: theme.vars!.palette.success.main,
    info: theme.vars!.palette.info.main,
    crit: theme.vars!.palette.error.main,
    grey: theme.vars!.palette.text.secondary,
  };

  const stateSlices = states.map((s, i) => {
    const name = shipStateName(s.state) ?? String(s.state);
    const status = SHIP_STATUS[name];
    return {
      id: i,
      value: s.count ?? 0,
      label: status?.label ?? name,
      color: toneColor[status?.tone ?? 'grey'],
    };
  });

  const isEmpty =
    (data.totalShipments ?? 0) === 0 && states.length === 0 && months.length === 0 && drivers.length === 0;

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard
          icon={<LocalShippingOutlinedIcon />}
          tone="info"
          label="Vývozů celkem"
          value={num(data.totalShipments ?? 0)}
          hint={`${num(data.totalStops ?? 0)} zastávek`}
        />
        <StatCard
          icon={<CheckCircleOutlineIcon />}
          tone="ok"
          label="Doručeno včas"
          value={`${num(onTime)} %`}
          hint="vůči požadovanému termínu"
        />
        <StatCard
          icon={<MoveToInboxOutlinedIcon />}
          tone="amber"
          label="Vratných obalů"
          value={fmtUnits(data.returnableUnits ?? 0)}
          hint="prázdné obaly zpět"
        />
        <StatCard
          icon={<BadgeOutlinedIcon />}
          tone="grey"
          label="Aktivních řidičů"
          value={num(data.activeDrivers ?? 0)}
        />
      </Box>

      {isEmpty ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
            <ChartCard icon={<LocalShippingOutlinedIcon />} title="Vývozy podle stavu">
              <Box sx={{ width: '100%', height: 240 }}>
                <PieChart
                  series={[
                    {
                      innerRadius: 52,
                      outerRadius: 92,
                      paddingAngle: 1.5,
                      data: stateSlices,
                      valueFormatter: (v) => `${num(v.value)} vývozů`,
                    },
                  ]}
                />
              </Box>
            </ChartCard>

            <ChartCard icon={<ScheduleOutlinedIcon />} title="Dodržení termínu">
              <Stack alignItems="center" justifyContent="center" sx={{ height: 240, position: 'relative' }}>
                <Box sx={{ width: 200, height: 200 }}>
                  <PieChart
                    series={[
                      {
                        innerRadius: 66,
                        outerRadius: 92,
                        startAngle: -90,
                        endAngle: 270,
                        data: [
                          { id: 0, value: onTime, label: 'Včas', color: theme.vars!.palette.success.main },
                          {
                            id: 1,
                            value: Math.max(0, 100 - onTime),
                            label: 'Pozdě',
                            color: theme.vars!.palette.brand.surface3,
                          },
                        ],
                        valueFormatter: (v) => `${num(v.value)} %`,
                      },
                    ]}
                    hideLegend
                  />
                </Box>
                {/* The gauge's own readout. The KPI above says the same number in words,
                    so the figure is never only a slice of colour. */}
                <Box sx={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{num(onTime)} %</Typography>
                  <Typography variant="caption" color="text.secondary">
                    včas
                  </Typography>
                </Box>
              </Stack>
            </ChartCard>
          </Box>

          <ChartCard icon={<MoveToInboxOutlinedIcon />} title="Dovoz vs. vývoz podle měsíce">
            <Box sx={{ width: '100%', height: 280 }}>
              {/* Both series are kilograms, so they share one y-axis. Separate scales would
                  let a smaller bar look taller than a bigger one. */}
              <BarChart
                series={[
                  {
                    data: months.map((m) => m.incomingWeightKg ?? 0),
                    label: 'Dovoz',
                    color: palette[3],
                    valueFormatter: (v) => fmtKg(v ?? 0),
                  },
                  {
                    data: months.map((m) => m.outgoingWeightKg ?? 0),
                    label: 'Vývoz',
                    color: palette[0],
                    valueFormatter: (v) => fmtKg(v ?? 0),
                  },
                ]}
                // Buckets here are always months; bucketLabel owns the Czech abbreviations
                // so this chart and the Objem trend cannot drift apart.
                xAxis={[{ scaleType: 'band', data: months.map((m) => bucketLabel(m.month, 'month')), height: 28 }]}
                yAxis={[{ width: 56, valueFormatter: (v: number) => num(v) }]}
                margin={{ right: 16 }}
              />
            </Box>
          </ChartCard>

          <ChartCard icon={<BadgeOutlinedIcon />} title="Vývozy podle řidiče">
            <Box sx={{ width: '100%', height: 40 + drivers.length * 40 }}>
              <BarChart
                layout="horizontal"
                series={[
                  {
                    data: drivers.map((d) => d.deliveredShipments ?? 0),
                    valueFormatter: (v) => `${num(v ?? 0)} vývozů`,
                  },
                ]}
                yAxis={[{ scaleType: 'band', data: drivers.map((d) => d.driverName ?? '—'), width: 150 }]}
                xAxis={[{ valueFormatter: (v: number) => num(v) }]}
                // The driver's own colour token: identity, not rank.
                colors={drivers.map((d, i) => d.color ?? palette[i % palette.length])}
                margin={{ right: 16 }}
                hideLegend
              />
            </Box>
          </ChartCard>
        </Stack>
      )}
    </>
  );
}
