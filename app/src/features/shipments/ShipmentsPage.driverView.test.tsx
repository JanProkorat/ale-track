// A driver-scoped account with an empty Vývozy list can be in two different
// situations that must not be confused: an unlinked account (no driver row of
// its own yet — broken, contact admin) versus a linked driver who simply has
// no runs assigned right now (normal — their last run finished).

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from 'src/theme/theme';
import { ShipmentsPage } from './ShipmentsPage';

const useDrivers = vi.fn();

vi.mock('src/hooks/useShipments', () => ({
  useShipments: () => ({ data: [], isLoading: false, isPending: false, isError: false }),
  useShipment: () => ({ data: undefined, isLoading: false, isPending: false, isError: false }),
}));
vi.mock('src/hooks/useDrivers', () => ({
  useDrivers: (...args: unknown[]) => useDrivers(...args),
}));
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => true, canSee: () => true, can: () => true, isDriverScoped: true }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MuiThemeProvider theme={theme}>
        <ShipmentsPage />
      </MuiThemeProvider>
    </MemoryRouter>,
  );
}

describe('ShipmentsPage for a driver account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains an unlinked account instead of the generic empty list', () => {
    useDrivers.mockReturnValue({ data: [], isLoading: false, isPending: false, isError: false });

    renderPage();

    expect(screen.getByText(/není propojen s řidičem/i)).toBeInTheDocument();
  });

  it('tells a linked driver with no assigned runs this is normal, not broken', () => {
    useDrivers.mockReturnValue({
      data: [{ id: 'driver-1', firstName: 'Jan', lastName: 'Novák' }],
      isLoading: false,
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/nebyl přiřazen žádný vývoz/i)).toBeInTheDocument();
    expect(screen.queryByText(/není propojen s řidičem/i)).not.toBeInTheDocument();
  });

  it('does not claim the account is unlinked while the drivers query is still loading', () => {
    useDrivers.mockReturnValue({ data: undefined, isLoading: true, isPending: true, isError: false });

    renderPage();

    expect(screen.queryByText(/není propojen s řidičem/i)).not.toBeInTheDocument();
  });

  it('hides the new-shipment button, both in the header and the empty state', () => {
    useDrivers.mockReturnValue({ data: [], isLoading: false, isPending: false, isError: false });

    renderPage();

    expect(screen.queryByRole('button', { name: /Naplánovat vývoz/i })).not.toBeInTheDocument();
  });
});
