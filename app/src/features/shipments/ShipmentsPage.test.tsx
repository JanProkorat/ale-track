// The Vývozy list must render in the order the endpoint returns (newest-created
// first). A defaultSort on the delivery-date column would silently override that,
// which is exactly the regression this file guards.

import { render, screen } from '@testing-library/react';
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
    state: OutgoingShipmentState.Created,
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
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => true, canSee: () => true, can: () => true }),
}));

describe('ShipmentsPage list order', () => {
  it('keeps the order the endpoint returned instead of sorting by delivery date', () => {
    render(
      <MemoryRouter>
        <MuiThemeProvider theme={theme}>
          <ShipmentsPage />
        </MuiThemeProvider>
      </MemoryRouter>,
    );

    // Both the table rows and the mobile cards render the name, so scope to the table.
    const rows = screen.getAllByRole('row').slice(1);
    const names = rows.map((row) => row.querySelectorAll('td')[1]?.textContent);

    expect(names).toEqual(['Nejnovější', 'Prostřední', 'Nejstarší']);
  });
});
