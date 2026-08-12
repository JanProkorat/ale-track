// A driver-scoped account never manages the roster: no add button, and an
// unlinked account (no driver row of its own) gets an explanation rather
// than the generic "add your first driver" empty state.

import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { DriverListItemDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { DriversPage } from './DriversPage';

function renderPage() {
  return render(
    <MuiThemeProvider theme={theme}>
      <DriversPage />
    </MuiThemeProvider>,
  );
}

const auth = { canEdit: () => true, canSee: () => true, can: () => true, isDriverScoped: true };
vi.mock('src/auth/AuthProvider', () => ({ useAuth: () => auth }));

let drivers: DriverListItemDto[] = [];
vi.mock('src/hooks/useDrivers', () => ({
  useDrivers: () => ({ data: drivers, isPending: false, isError: false }),
  useDeleteDriver: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // DriverFormDrawer is always mounted (even while closed) and calls these unconditionally.
  useCreateDriver: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDriver: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('DriversPage for a driver account', () => {
  it('hides the add button', () => {
    drivers = [];
    renderPage();
    expect(screen.queryByRole('button', { name: /Nový řidič/i })).not.toBeInTheDocument();
  });

  it('explains an unlinked account', () => {
    drivers = [];
    renderPage();
    expect(screen.getByText(/není propojen s řidičem/i)).toBeInTheDocument();
  });
});

describe('DriversPage for a driver account with a linked driver record', () => {
  it('keeps the edit action but hides delete on the driver tile', () => {
    drivers = [new DriverListItemDto({ id: 'driver-1', firstName: 'Jana', lastName: 'Nováková' })];
    renderPage();
    expect(screen.getByRole('button', { name: 'Upravit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Smazat' })).not.toBeInTheDocument();
  });
});
