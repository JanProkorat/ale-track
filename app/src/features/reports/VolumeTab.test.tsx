import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('12,4 t')).toBeInTheDocument();
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

  it('keeps the legend visible — the amber and sky slots need its labels for contrast', () => {
    renderTab();

    expect(screen.getByText('Světlý ležák')).toBeInTheDocument();
    expect(screen.getByText('Tmavý ležák')).toBeInTheDocument();
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
