// A client detail can be reached from its own list or as a detour from elsewhere — e.g. from a
// garage sale, whose buyer is a client. When it carries a back target in the router's location
// state, the arrow must honour it instead of dropping the user on /clients.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { ClientDto, ClientListItemDto, Region } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { ClientsPage } from './ClientsPage';

const client = new ClientDto({
  id: 'cl-1',
  name: 'Pivnice Na Rohu',
  region: Region.ZittauRegion,
  contacts: [],
  deliveryPlaces: [],
} as never);

vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: [new ClientListItemDto({ id: 'cl-1', name: 'Pivnice Na Rohu' } as never)], isPending: false, isError: false }),
  useClient: () => ({ data: client, isPending: false, isError: false }),
  useCreateClient: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdateClient: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useClientReminders', () => ({
  useClientReminders: () => ({ data: [], isPending: false }),
}));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueries: () => [],
}));
vi.mock('src/hooks/useOrders', () => ({
  useClientOrders: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock('src/hooks/useClientNotes', () => ({
  useClientNotes: () => ({ data: [], isPending: false, isError: false }),
  useCreateClientNote: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClientNote: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: [], isPending: false, isError: false }),
  useCreateDeliveryPlace: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteDeliveryPlace: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useClientProductPrices', () => ({
  useClientProductPrices: () => ({ data: [], isPending: false, isError: false }),
  useSaveClientProductPrice: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteClientProductPrice: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => true, canSee: () => true, can: () => true }),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

/** Renders the client detail route with whatever location state the caller arrived with. */
function renderDetail(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/clients/cl-1', state }]}>
      <MuiThemeProvider theme={theme}>
        <Routes>
          <Route path="/clients/:id" element={<ClientsPage />} />
        </Routes>
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

describe('ClientsPage back navigation', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('returns to the clients list when opened from it', () => {
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Zpět na klienty' }));
    expect(navigateMock).toHaveBeenCalledWith('/clients');
  });

  it('returns to the carried target when opened as a detour', () => {
    renderDetail({ backTo: '/sales/sale-000018', backLabel: 'Zpět na prodej' });

    // The label comes from the state too, so the arrow says where it goes.
    fireEvent.click(screen.getByRole('button', { name: 'Zpět na prodej' }));
    expect(navigateMock).toHaveBeenCalledWith('/sales/sale-000018');
  });

  it('ignores a malformed target rather than navigating somewhere broken', () => {
    // Location state is whatever the browser kept, from any app version — detailBackState narrows it.
    renderDetail({ backTo: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Zpět na klienty' }));
    expect(navigateMock).toHaveBeenCalledWith('/clients');
  });
});
