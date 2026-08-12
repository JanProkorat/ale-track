// An unlinked driver account (no driver row of its own yet) sees the same
// explanation on the empty Vývozy list as it does on the empty Řidiči list.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { ShipmentsPage } from './ShipmentsPage';

vi.mock('src/hooks/useShipments', () => ({
  useShipments: () => ({ data: [], isLoading: false, isPending: false, isError: false }),
  useShipment: () => ({ data: undefined, isLoading: false, isPending: false, isError: false }),
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
  it('explains an unlinked account instead of the generic empty list', () => {
    renderPage();
    expect(screen.getByText(/není propojen s řidičem/i)).toBeInTheDocument();
  });

  it('hides the new-shipment button, both in the header and the empty state', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /Naplánovat vývoz/i })).not.toBeInTheDocument();
  });
});
