import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { DashboardPage } from './DashboardPage';

vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { firstName: 'Jan' }, canSee: () => true }),
}));

const loaded = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });

// Mutable so a test can put the counts query into its loading state — the fold's
// header must not wait on it.
let counts: { data: unknown; isLoading: boolean; isError: boolean; error: unknown } = loaded({
  ordersCount: 7,
  outgoingShipmentsCount: 2,
  productDeliveriesCount: 1,
  inventoryItemsCount: 207,
  salesCount: 1,
  breweriesCount: 3,
  clientsCount: 31,
  driversCount: 4,
  vehiclesCount: 2,
  usersCount: 5,
});
const LOADED_COUNTS = counts;

vi.mock('src/hooks/useReports', () => ({ useModuleCounts: () => counts }));
vi.mock('src/hooks/useDrivers', () => ({ useDrivers: () => loaded([]) }));
vi.mock('src/hooks/useShipments', () => ({ useShipments: () => loaded([]) }));
vi.mock('src/hooks/useDeliveries', () => ({ useDeliveries: () => loaded([]) }));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => loaded([]) }));
vi.mock('src/hooks/useSales', () => ({ useSales: () => loaded([]) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (n: number) => `${n} Kč` }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

/** MUI's useMediaQuery reads window.matchMedia; happy-dom resolves it against a
 * 1024px window, so force the answer rather than depend on that default. */
function setCompact(compact: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: compact && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

// "Uživatelé" is the users tile's label and appears nowhere else on the dashboard,
// so it stands in for "the module tiles are mounted".
const tile = () => screen.queryByText('Uživatelé');
const toggle = () => screen.getByRole('button', { name: /Přehled modulů/ });

describe('DashboardPage module tiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counts = LOADED_COUNTS;
  });

  it('renders the tiles up front on a wide screen', () => {
    setCompact(false);
    renderPage();

    expect(tile()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přehled modulů/ })).not.toBeInTheDocument();
  });

  /**
   * The regression this guards: ten single-column StatCards at ~90px each put roughly
   * 900px of counters above the first actionable card on a 390px phone.
   */
  it('folds the tiles away behind a toggle on a phone', () => {
    setCompact(true);
    renderPage();

    expect(tile()).not.toBeInTheDocument();

    fireEvent.click(toggle());
    expect(tile()).toBeInTheDocument();
  });

  it('puts the actionable cards before the tiles on a phone', () => {
    setCompact(true);
    renderPage();

    const sales = screen.getByText('Rozpracované prodeje');
    // Node.DOCUMENT_POSITION_FOLLOWING — the toggle comes after the sales card.
    expect(sales.compareDocumentPosition(toggle()) & 4).toBeTruthy();
  });

  /** The label comes from the nav config, not the counts query, so a slow or failed
   * /reports call must still leave the user something to open. */
  it('shows the toggle while the counts are still loading', () => {
    setCompact(true);
    counts = { data: undefined, isLoading: true, isError: false, error: null };
    renderPage();

    expect(toggle()).toBeInTheDocument();
    fireEvent.click(toggle());
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('counts the folded-away tiles on the toggle', () => {
    setCompact(true);
    renderPage();

    // Every key in TILE_CONFIG, since this user can see every module.
    expect(toggle()).toHaveTextContent('10');
  });
});
