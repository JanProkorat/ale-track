// The detail's tab-level actions belong on the tab strip, not stacked beneath it. Checked
// through the real detail rather than the shared component alone, because the wiring that
// broke before was the one between a panel and the strip.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  AddressDto, Country, SupplierChargeKind, SupplierDto, SupplierGoodDto, SupplierGoodPriceDto,
  SupplierOpeningHoursDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SupplierDetail } from './SupplierDetail';
import { type SupplierTab } from './supplierDetailTab';

vi.mock('src/hooks/useSuppliers', () => ({
  useSupplierNotes: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useCreateSupplierNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSupplierNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v: number) => `${v} Kč`, currency: 'CZK' }),
}));
// Leaflet needs a real layout box; the map is not what these assertions are about.
vi.mock('src/components/common/PointMap', () => ({ PointMap: () => <div data-testid="map" /> }));

const SUPPLIER = new SupplierDto({
  id: 'sp-1',
  name: 'Albeco',
  businessName: 'ALBECO spol. s r.o.',
  officialAddress: new AddressDto({
    streetName: 'Londýnská', streetNumber: '564', city: 'Liberec', zip: '46011', country: Country.Czechia,
  }),
  contacts: [],
  openingHours: [
    { dayOfWeek: 'Monday', from: '06:30:00', to: '15:00:00' },
  ] as unknown as SupplierOpeningHoursDto[],
  goods: [
    new SupplierGoodDto({
      id: 'sg-1',
      name: 'CO₂ láhev',
      size: '10 kg',
      prices: [new SupplierGoodPriceDto({
        kind: 'Fill' as unknown as SupplierChargeKind, priceWithVat: 450,
      })],
    }),
  ],
} as never);

function renderDetail(tab: SupplierTab, { editable = true } = {}) {
  return render(
    <MuiThemeProvider theme={theme}>
      <SupplierDetail
        supplier={SUPPLIER}
        editable={editable}
        tab={tab}
        onTabChange={vi.fn()}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEditHours={vi.fn()}
        onAddGood={vi.fn()}
        onEditGood={vi.fn()}
        onDeleteGood={vi.fn()}
        now={new Date('2026-08-17T09:00:00')}
      />
    </MuiThemeProvider>,
  );
}

const inStrip = (name: string) =>
  screen.getByTestId('tab-actions-slot').contains(screen.getByRole('button', { name }));

describe('SupplierDetail tab actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('puts Přidat zboží on the tab strip', () => {
    renderDetail('cenik');
    expect(inStrip('Přidat zboží')).toBe(true);
  });

  it('puts Upravit dobu on the tab strip', () => {
    renderDetail('hours');
    expect(inStrip('Upravit dobu')).toBe(true);
  });

  it('offers no tab actions to a view-only user', () => {
    renderDetail('cenik', { editable: false });
    expect(screen.queryByRole('button', { name: 'Přidat zboží' })).toBeNull();
    expect(screen.getByTestId('tab-actions-slot').children).toHaveLength(0);
  });

  it('leaves the strip empty on a tab that has no action', () => {
    renderDetail('info');
    expect(screen.getByTestId('tab-actions-slot').children).toHaveLength(0);
  });

  it('still renders the tab body beneath the strip', () => {
    renderDetail('cenik');
    expect(screen.getByText('CO₂ láhev')).toBeTruthy();
    expect(screen.getByText('Plnění')).toBeTruthy();
  });
});
