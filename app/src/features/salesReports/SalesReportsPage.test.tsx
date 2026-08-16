import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { SalesReportsPage } from './SalesReportsPage';

const useGarageSalesRevenue = vi.fn();
const useGarageSalesProducts = vi.fn();
const useGarageSalesBuyers = vi.fn();

vi.mock('src/hooks/useSalesReports', () => ({
  useGarageSalesRevenue: (...args: unknown[]) => useGarageSalesRevenue(...args),
  useGarageSalesProducts: (...args: unknown[]) => useGarageSalesProducts(...args),
  useGarageSalesBuyers: (...args: unknown[]) => useGarageSalesBuyers(...args),
}));

// Money formatting is not what this page decides. Mocking the provider keeps the test off
// its auth + query-client + localStorage dependencies.
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => `${czk ?? 0} Kč` }),
}));

const loading = { data: undefined, isLoading: true, isError: false, error: null };

const emptyRevenue = {
  data: {
    totalRevenue: 0, salesCount: 0, averageSale: 0, totalUnits: 0, totalLitres: 0,
    trend: [], byPayment: [], unpaidInvoices: [], unpaidTotal: 0,
  },
  isLoading: false,
  isError: false,
  error: null,
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <SalesReportsPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('SalesReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGarageSalesRevenue.mockReturnValue(emptyRevenue);
    useGarageSalesProducts.mockReturnValue(loading);
    useGarageSalesBuyers.mockReturnValue(loading);
  });

  it('opens on Tržby with the 90-day preset and only fetches the active tab', () => {
    renderPage();

    expect(screen.getByText('Reporty prodejny')).toBeInTheDocument();
    expect(screen.getByText('Garážový prodej')).toBeInTheDocument();

    expect(useGarageSalesRevenue.mock.calls[0][3]).toBe(true);
    expect(useGarageSalesProducts.mock.calls[0][2]).toBe(false);
    expect(useGarageSalesBuyers.mock.calls[0][2]).toBe(false);

    const [from, to] = useGarageSalesRevenue.mock.calls[0] as [string, string];
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBe(90);
  });

  it('switches the enabled query when a different tab is selected', () => {
    renderPage();

    fireEvent.click(screen.getByText('Zboží'));

    expect(useGarageSalesProducts.mock.calls.at(-1)![2]).toBe(true);
    expect(useGarageSalesRevenue.mock.calls.at(-1)![3]).toBe(false);
  });

  it('refetches with a narrower window when the period preset changes', () => {
    renderPage();
    const before = useGarageSalesRevenue.mock.calls[0][0] as string;

    fireEvent.click(screen.getByText('30 dní'));

    const after = useGarageSalesRevenue.mock.calls.at(-1)![0] as string;
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
  });

  it('renders the error state instead of a tab body when the query fails', () => {
    useGarageSalesRevenue.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('boom'),
    });

    renderPage();

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('Tržba celkem')).not.toBeInTheDocument();
  });

  it('does not render a tab body while its query is still loading', () => {
    useGarageSalesRevenue.mockReturnValue(loading);

    renderPage();

    expect(screen.queryByText('Tržba celkem')).not.toBeInTheDocument();
  });
});
