// The page's own decisions: which state it renders (loading / error / empty / rows), that
// search filters on what a supplier sells, and that a viewer without edit rights sees no
// write controls. fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  AddressDto, Country, DayOfWeek, SupplierListItemDto, SupplierOpeningHoursDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SuppliersPage } from './SuppliersPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

/** The list query is swapped per test, so loading and error states are reachable. */
const listState: {
  data?: SupplierListItemDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
} = {
  // `refetch` is part of the shape TanStack Query really returns, and QueryBoundary only
  // offers "Zkusit znovu" when it is there — a mock without it hides that affordance.
  data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn(),
};
let canEditModule = true;

vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliers: () => listState,
  useSupplier: () => ({ data: undefined, isLoading: false, isError: false, error: null }),
  useCreateSupplier: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSupplier: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSupplier: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReplaceOpeningHours: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSupplierGood: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSupplierGood: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSupplierGood: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSupplierNotes: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useCreateSupplierNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSupplierNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => canEditModule, canSee: () => true, can: () => true }),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v: number) => `${v} Kč`, currency: 'CZK' }),
}));

const addr = (city: string) =>
  new AddressDto({ streetName: 'Londýnská', streetNumber: '564', city, zip: '46011', country: Country.Czechia });

// Enum names, not numbers: that is what the API sends, and the numeric fixtures this
// started with hid a bug that rendered every supplier as closed.
const hours = (day: DayOfWeek, from: string, to: string) =>
  new SupplierOpeningHoursDto({
    dayOfWeek: DayOfWeek[day] as unknown as DayOfWeek,
    from: `${from}:00`,
    to: `${to}:00`,
  });

const LINDE = new SupplierListItemDto({
  id: 'sp-linde',
  name: 'Linde Gas — plnírna Liberec',
  businessName: 'Linde Gas a.s.',
  officialAddress: addr('Liberec'),
  contacts: [],
  goodsCount: 4,
  goodNames: ['CO₂ láhev', 'Dusík láhev'],
  openingHours: [hours(DayOfWeek.Monday, '07:00', '11:30'), hours(DayOfWeek.Monday, '12:00', '15:30')],
} as never);

const OBALY = new SupplierListItemDto({
  id: 'sp-obaly',
  name: 'Obaly Frýdlant s.r.o.',
  officialAddress: addr('Frýdlant'),
  contacts: [],
  goodsCount: 2,
  goodNames: ['Přepravka', 'KEG sud nerez'],
  openingHours: [],
} as never);

/**
 * Types into the search box and lets its debounce fire. SearchField keeps its own text
 * state and pushes changes up after 200ms, so without advancing timers the page never
 * sees the query at all — and every filter assertion would pass against unfiltered rows.
 */
function search(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Hledat dodavatele nebo zboží…'), {
    target: { value: text },
  });
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/suppliers']}>
      <MuiThemeProvider theme={theme}>
        <Routes>
          <Route path="/suppliers" element={<SuppliersPage />} />
        </Routes>
      </MuiThemeProvider>
    </MemoryRouter>,
  );
}

describe('SuppliersPage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    canEditModule = true;
    // A fixed Monday 09:00, so the "Dnes" column is deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T09:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a spinner while the list is loading', () => {
    Object.assign(listState, { data: undefined, isLoading: true, isError: false, error: null });
    renderList();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the error state rather than an empty table', () => {
    Object.assign(listState, { data: undefined, isLoading: false, isError: true, error: new Error('nope') });
    renderList();
    // apiErrorMessage passes a non-ApiException's own message through, so the alert is
    // what identifies the state, not the fallback sentence.
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeTruthy();
  });

  it('invites the first supplier when there are none', () => {
    Object.assign(listState, { data: [], isLoading: false, isError: false, error: null });
    renderList();
    expect(screen.getByText('Zatím žádní dodavatelé')).toBeTruthy();
  });

  it('renders a row per supplier with its open state', () => {
    Object.assign(listState, { data: [LINDE, OBALY], isLoading: false, isError: false, error: null });
    renderList();

    // DataTable renders the desktop row and the mobile card together — one is hidden by
    // CSS, so each row's text is in the DOM twice. Hence getAllByText throughout.
    expect(screen.getAllByText('Linde Gas — plnírna Liberec').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Obaly Frýdlant s.r.o.').length).toBeGreaterThan(0);
    // Monday 09:00: Linde is inside its morning interval, Obaly has no hours at all.
    expect(screen.getAllByText('otevřeno').length).toBeGreaterThan(0);
    expect(screen.getAllByText('zavřeno').length).toBeGreaterThan(0);
    expect(screen.getAllByText('7:00–11:30 · 12:00–15:30').length).toBeGreaterThan(0);
  });

  it('filters by something a supplier sells, not just by its name', () => {
    Object.assign(listState, { data: [LINDE, OBALY], isLoading: false, isError: false, error: null });
    renderList();

    search('přepravka');

    expect(screen.queryByText('Linde Gas — plnírna Liberec')).toBeNull();
    expect(screen.getAllByText('Obaly Frýdlant s.r.o.').length).toBeGreaterThan(0);
  });

  it('reaches a subscript gas name from a plain keyboard digit', () => {
    Object.assign(listState, { data: [LINDE, OBALY], isLoading: false, isError: false, error: null });
    renderList();

    search('co2');

    expect(screen.getAllByText('Linde Gas — plnírna Liberec').length).toBeGreaterThan(0);
    expect(screen.queryByText('Obaly Frýdlant s.r.o.')).toBeNull();
  });

  it('offers to clear a search that matched nothing', () => {
    Object.assign(listState, { data: [LINDE], isLoading: false, isError: false, error: null });
    renderList();

    search('sanitace');

    expect(screen.getByText('Žádní dodavatelé')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit hledání' }));
    expect(screen.getAllByText('Linde Gas — plnírna Liberec').length).toBeGreaterThan(0);
  });

  it('opens a supplier on row click', () => {
    Object.assign(listState, { data: [LINDE], isLoading: false, isError: false, error: null });
    renderList();

    fireEvent.click(screen.getAllByText('Linde Gas — plnírna Liberec')[0]);
    expect(navigateMock).toHaveBeenCalledWith('/suppliers/sp-linde');
  });

  it('hides the create button from a view-only user', () => {
    canEditModule = false;
    Object.assign(listState, { data: [LINDE], isLoading: false, isError: false, error: null });
    renderList();

    expect(screen.queryByRole('button', { name: /Nový dodavatel/ })).toBeNull();
  });
});
