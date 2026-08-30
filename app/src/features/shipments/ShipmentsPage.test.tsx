// The Vývozy list must render in the order the endpoint returns (newest-created
// first). A defaultSort on the delivery-date column would silently override that,
// which is exactly the regression this file guards.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { OutgoingShipmentListItemDto, OutgoingShipmentState } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { ShipmentsPage } from './ShipmentsPage';

const shipments = [
  new OutgoingShipmentListItemDto({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Nejnovější',
    state: OutgoingShipmentState.Delivered,
    createdDate: new Date('2026-07-30T08:00:00Z'),
    deliveryDate: new Date('2026-08-20T08:00:00Z'),
  }),
  new OutgoingShipmentListItemDto({
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Prostřední',
    state: OutgoingShipmentState.Created,
    createdDate: new Date('2026-07-15T08:00:00Z'),
    deliveryDate: new Date('2026-08-01T08:00:00Z'),
  }),
  new OutgoingShipmentListItemDto({
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Nejstarší',
    state: OutgoingShipmentState.Created,
    createdDate: new Date('2026-07-01T08:00:00Z'),
    deliveryDate: new Date('2026-08-10T08:00:00Z'),
  }),
];

vi.mock('src/hooks/useShipments', () => ({
  useShipments: () => ({ data: shipments, isLoading: false, isPending: false, isError: false }),
  useShipment: () => ({ data: undefined, isLoading: false, isPending: false, isError: false }),
}));
vi.mock('src/hooks/useDrivers', () => ({
  useDrivers: () => ({ data: [], isLoading: false, isPending: false, isError: false }),
}));
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => true, canSee: () => true, can: () => true }),
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

/** Both the table rows and the mobile cards render the name, so this scopes to the table. */
function rowNames(): (string | undefined)[] {
  return screen.getAllByRole('row').slice(1)
    .map((row) => row.querySelectorAll('td')[1]?.textContent);
}

describe('ShipmentsPage list order', () => {
  it('keeps the order the endpoint returned instead of sorting by delivery date', () => {
    renderPage();

    expect(rowNames()).toEqual(['Nejnovější', 'Prostřední', 'Nejstarší']);
  });
});

describe('ShipmentsPage filter bar', () => {
  it('counts each state beside its segment', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Vše 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vytvořeno 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Doručeno 1' })).toBeInTheDocument();
    // No run is on the way, so that segment carries no count at all.
    expect(screen.getByRole('button', { name: 'Na cestě' })).toBeInTheDocument();
  });

  it('narrows the list to one state', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Doručeno 1' }));

    expect(rowNames()).toEqual(['Nejnovější']);
  });

  it('searches by name', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Hledat vývoz…'), { target: { value: 'nejstar' } });

    // Waited on a row that must go, not one that must stay: SearchField debounces, and
    // waitFor passes on its first synchronous check.
    await waitFor(() => expect(screen.queryByText('Nejnovější')).not.toBeInTheDocument());
    expect(rowNames()).toEqual(['Nejstarší']);
  });

  // The number is the column read first, and it is what the run's paperwork carries.
  it('searches by the display number too', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Hledat vývoz…'), { target: { value: '222222' } });

    await waitFor(() => expect(screen.queryByText('Nejnovější')).not.toBeInTheDocument());
    expect(rowNames()).toEqual(['Prostřední']);
  });

  it('says so when a filter leaves nothing', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Hledat vývoz…'), { target: { value: 'zzz' } });

    await waitFor(() => expect(screen.getByText('Žádné vývozy v tomto filtru')).toBeInTheDocument());
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });

  // The list keeps its own order under the filter — the regression the file above guards.
  it('keeps the endpoint order while filtering', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Vytvořeno 2' }));

    expect(rowNames()).toEqual(['Prostřední', 'Nejstarší']);
  });
});
