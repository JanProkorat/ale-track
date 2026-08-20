import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ReportsPage } from './ReportsPage';

const useDeliveryVolume = vi.fn();
const useClientVolume = vi.fn();
const useOperationsReport = vi.fn();

vi.mock('src/hooks/useReports', () => ({
  useDeliveryVolume: (...args: unknown[]) => useDeliveryVolume(...args),
  useClientVolume: (...args: unknown[]) => useClientVolume(...args),
  useOperationsReport: (...args: unknown[]) => useOperationsReport(...args),
}));

const loading = { data: undefined, isLoading: true, isError: false, error: null };
const empty = {
  data: {
    totalWeightKg: 0, totalUnits: 0, clientsServed: 0,
    unitsByKind: [], byBrewery: [], byType: [], series: [],
  },
  isLoading: false, isError: false, error: null,
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeliveryVolume.mockReturnValue(empty);
    useClientVolume.mockReturnValue(loading);
    useOperationsReport.mockReturnValue(loading);
  });

  it('opens on Objem with the 90-day preset and only fetches the active tab', () => {
    renderPage();

    expect(screen.getByText('Reporty')).toBeInTheDocument();
    expect(screen.getByText('Objem')).toBeInTheDocument();

    // Active tab enabled, the other two disabled — switching tabs is the only thing
    // that should ever trigger a fetch.
    expect(useDeliveryVolume.mock.calls[0][3]).toBe(true);
    expect(useClientVolume.mock.calls[0][2]).toBe(false);
    expect(useOperationsReport.mock.calls[0][2]).toBe(false);

    const [from, to] = useDeliveryVolume.mock.calls[0] as [string, string];
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(90);
  });

  it('refetches with a narrower window when the period preset changes', () => {
    renderPage();
    const before = useDeliveryVolume.mock.calls[0][0] as string;

    fireEvent.click(screen.getByText('30 dní'));

    const after = useDeliveryVolume.mock.calls.at(-1)![0] as string;
    expect(after).not.toBe(before);
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
  });

  it('switches the enabled query when a different tab is selected', () => {
    renderPage();

    fireEvent.click(screen.getByText('Klienti'));

    expect(useClientVolume.mock.calls.at(-1)![2]).toBe(true);
    expect(useDeliveryVolume.mock.calls.at(-1)![3]).toBe(false);
  });

  it('renders the error state instead of a tab body when the query fails', () => {
    useDeliveryVolume.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('boom'),
    });

    renderPage();

    // QueryBoundary renders apiErrorMessage(error, fallback), and a plain Error surfaces
    // its own message — the fallback only applies when there is nothing better to show.
    expect(screen.getByText('boom')).toBeInTheDocument();
    // The point of the test: the tab body must not render alongside the error.
    expect(screen.queryByText('Celkem doručeno')).not.toBeInTheDocument();
  });

  it('falls back to a Czech message when the failure carries none', () => {
    useDeliveryVolume.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: null,
    });

    renderPage();

    expect(screen.getByText('Data se nepodařilo načíst.')).toBeInTheDocument();
  });
});
