import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ProductKind, ProductType } from 'src/generated/api-client';
import { VolumeTab } from './VolumeTab';

const data = {
  totalWeightKg: 12400,
  totalUnits: 320,
  clientsServed: 14,
  unitsByKind: [
    { kind: ProductKind.Keg, units: 120, weightKg: 7440 },
    { kind: ProductKind.Bottle, units: 100, weightKg: 3000 },
    { kind: ProductKind.Can, units: 100, weightKg: 1960 },
  ],
  byBrewery: [
    { breweryId: 'b1', breweryName: 'Pivovar Zittau', color: '#E69F00', units: 200, weightKg: 9000 },
    { breweryId: 'b2', breweryName: 'Pivovar Chemnitz', color: '#0072B2', units: 120, weightKg: 3400 },
  ],
  byType: [
    { type: ProductType.PaleLager, units: 200, weightKg: 9000 },
    { type: ProductType.DarkLager, units: 120, weightKg: 3400 },
  ],
  series: [
    { bucketStart: '2026-07-06', weightKg: 5000, units: 140 },
    { bucketStart: '2026-07-13', weightKg: 7400, units: 180 },
  ],
} as never;

function renderTab(overrides: Partial<Record<string, unknown>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <VolumeTab
        data={{ ...(data as object), ...overrides } as never}
        granularity="week"
        onGranularityChange={vi.fn()}
      />
    </ThemeProvider>
  );
}

describe('VolumeTab', () => {
  it('shows the four prototype KPIs with tonnes above 1000 kg', () => {
    renderTab();

    expect(screen.getByText('Celkem dodáno')).toBeInTheDocument();
    // "12,4 t" appears twice: the KPI tile and the donut's centre total (both show the
    // same overall total, matching the prototype's chDonut(..., {center}) at line 892).
    expect(screen.getAllByText('12,4 t').length).toBe(2);
    expect(screen.getByText('14 klientů obslouženo')).toBeInTheDocument();
    expect(screen.getByText('Sudy')).toBeInTheDocument();
    expect(screen.getByText('Lahve (basy)')).toBeInTheDocument();
    expect(screen.getByText('Plechovky / multipack')).toBeInTheDocument();
  });

  it('lists every brewery and product kind with its share', () => {
    renderTab();

    expect(screen.getByText('Pivovar Zittau')).toBeInTheDocument();
    expect(screen.getByText('Pivovar Chemnitz')).toBeInTheDocument();
    // Kind table: 7440 / 12400 = 60,0 %
    expect(screen.getByText('60,0 %')).toBeInTheDocument();
  });

  it('renders the Obal column as Czech kind labels, never a raw enum value', () => {
    renderTab();

    // L.kind: Keg -> "Sud", Bottle -> "Basa", Can -> "Plechovka". These are the table
    // cells, distinct from the KPI tiles ("Sudy", "Lahve (basy)", "Plechovky / multipack"),
    // so they cannot be satisfied by the tile text.
    expect(screen.getByText('Sud')).toBeInTheDocument();
    expect(screen.getByText('Basa')).toBeInTheDocument();
    expect(screen.getByText('Plechovka')).toBeInTheDocument();

    // The numeric wire form must never leak through as "1"/"2"/"3".
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('falls back to Ostatní when a row carries no kind', () => {
    renderTab({
      unitsByKind: [{ kind: undefined, units: 5, weightKg: 100 }],
    });

    expect(screen.getByText('Ostatní')).toBeInTheDocument();
  });

  it('keeps the legend visible — the amber and sky slots need its labels for contrast', () => {
    renderTab();

    expect(screen.getByText('Světlý ležák')).toBeInTheDocument();
    expect(screen.getByText('Tmavý ležák')).toBeInTheDocument();
  });

  it('shows the donut centre total and a per-type weight next to each legend label', () => {
    renderTab();

    expect(screen.getByText('celkem')).toBeInTheDocument();
    // 9000 kg -> "9,0 t" for Světlý ležák's legend row.
    expect(screen.getByText('9,0 t')).toBeInTheDocument();
    // 3400 kg -> "3,4 t" for Tmavý ležák's legend row.
    expect(screen.getByText('3,4 t')).toBeInTheDocument();
  });

  it('keeps the donut ring inside its own viewport so no slice is clipped', () => {
    const { container } = renderTab();

    // The donut is the only square 158x158 chart on the tab.
    const svg = Array.from(container.querySelectorAll('svg')).find((s) => s.getAttribute('viewBox') === '0 0 158 158');
    expect(svg).toBeTruthy();

    // MUI centres the pie at viewBox/2 and derives the radius it is allowed to use from
    // that same half-extent (PieChart/getPieCoordinates.js: `Math.min(width, height) / 2`).
    // A numeric outerRadius is NOT clamped to it (PieChart/seriesConfig/seriesLayout.js),
    // so a radius larger than this draws the ring outside the SVG and the browser clips it
    // into a squared-off blob. Arc coordinates are emitted relative to that centre, so each
    // coordinate pair's distance from the origin is the radius it sits at.
    const availableRadius = 158 / 2;

    const arcs = Array.from(svg!.querySelectorAll('path[class*="MuiPieArc-root"]'));
    expect(arcs.length).toBeGreaterThan(0);

    const radii = arcs.flatMap((arc) => {
      const pairs = (arc.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? [];
      return pairs.map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return Math.hypot(x, y);
      });
    });

    expect(radii.length).toBeGreaterThan(0);
    expect(Math.max(...radii)).toBeLessThanOrEqual(availableRadius);
  });

  it('fires onGranularityChange with the clicked option', () => {
    const onGranularityChange = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <VolumeTab data={data} granularity="week" onGranularityChange={onGranularityChange} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Měsíčně'));

    expect(onGranularityChange).toHaveBeenCalledWith('month');
  });

  it('survives an all-zero window without crashing or dividing by zero', () => {
    renderTab({
      totalWeightKg: 0,
      totalUnits: 0,
      clientsServed: 0,
      unitsByKind: [],
      byBrewery: [],
      byType: [],
      series: [],
    });

    expect(screen.getByText('0 kg')).toBeInTheDocument();
    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
  });
});
