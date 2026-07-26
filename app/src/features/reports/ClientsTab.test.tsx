import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { Region } from 'src/generated/api-client';
import { ClientsTab } from './ClientsTab';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}));

const data = {
  clientsServed: 2,
  totalDeliveries: 7,
  totalWeightKg: 12400,
  topClients: [
    { clientId: 'c1', clientName: 'Hospoda U Kotvy', region: Region.ZittauCity, deliveries: 5, units: 200, weightKg: 9000 },
    { clientId: 'c2', clientName: 'Restaurace Na Rynku', region: Region.Leipzig, deliveries: 2, units: 120, weightKg: 3400 },
  ],
  byRegion: [
    { region: Region.ZittauCity, units: 200, weightKg: 9000 },
    { region: Region.Leipzig, units: 120, weightKg: 3400 },
  ],
} as never;

function renderTab(overrides: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ClientsTab data={{ ...(data as object), ...overrides } as never} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('ClientsTab', () => {
  it('shows the four prototype KPIs including the average per client', () => {
    renderTab();

    expect(screen.getByText('Klientů obslouženo')).toBeInTheDocument();
    expect(screen.getByText('Rozvozů celkem')).toBeInTheDocument();
    expect(screen.getByText('Průměr na klienta')).toBeInTheDocument();
    // 12400 / 2 = 6200 kg => 6,2 t
    expect(screen.getByText('6,2 t')).toBeInTheDocument();
    expect(screen.getByText('Nejsilnější region')).toBeInTheDocument();
  });

  it('lists every client with region, deliveries and share', () => {
    renderTab();

    // Scoped to the table: the client's name also appears as the top-clients chart's
    // y-axis tick label (real @mui/x-charts SVG output, not a mock), so an unscoped
    // getByText finds both and throws on ambiguity.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Hospoda U Kotvy')).toBeInTheDocument();
    expect(table.getByText('Restaurace Na Rynku')).toBeInTheDocument();
    // 9000 / 12400 = 72,6 %
    expect(table.getByText('72,6 %')).toBeInTheDocument();
  });

  it('navigates to the client detail when a table row is clicked', () => {
    renderTab();

    fireEvent.click(within(screen.getByRole('table')).getByText('Hospoda U Kotvy'));

    expect(navigate).toHaveBeenCalledWith('/clients/c1');
  });

  it('switches the top-clients metric between weight and units', () => {
    renderTab();

    // The bar chart's own value labels/x-axis ticks are not asserted here: @mui/x-charts
    // measures its container via ResizeObserver, which is unpolyfilled under happy-dom, so
    // the container stays at zero width and the axis renders no tick text at all — there is
    // nothing in the DOM to read the plotted value back from. What IS observable and does
    // prove the metric actually flipped (as opposed to the click handler merely firing) is
    // the SegControl's own pressed state, which is real rendered markup.
    // "Hmotnost" is also a table column header, so pick the SegControl's own button —
    // the one rendered as an actual <button>.
    const hmotnost = screen.getAllByText('Hmotnost').map((el) => el.closest('button')).find(Boolean)!;
    const kusy = screen.getByText('Kusy').closest('button')!;
    expect(hmotnost).toHaveAttribute('aria-pressed', 'true');
    expect(kusy).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(kusy);

    expect(kusy).toHaveAttribute('aria-pressed', 'true');
    expect(hmotnost).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows an empty state and does not divide by zero with no clients', () => {
    renderTab({ clientsServed: 0, totalDeliveries: 0, totalWeightKg: 0, topClients: [], byRegion: [] });

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
    expect(screen.getByText('0 kg')).toBeInTheDocument();
  });
});
