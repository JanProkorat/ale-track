// A client detail can be reached from its own list or as a detour from elsewhere — e.g. from a
// garage sale, whose buyer is a client. When it carries a back target in the router's location
// state, the arrow must honour it instead of dropping the user on /clients.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { AddressDto, ClientDto, ClientListItemDto, Region } from 'src/generated/api-client';
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
  // Three rows: one carries a trading name, one is billed through a payer, and one has no
  // official address of its own — enough for a search to narrow and for the payer/fallback
  // rows to be told apart from the plain one.
  useClients: () => ({
    data: [
      new ClientListItemDto({
        id: 'cl-1', name: 'Pivnice Na Rohu', businessName: 'Na Rohu gastro s.r.o.',
      } as never),
      new ClientListItemDto({ id: 'cl-2', name: 'Pivnice U Kapra', invoicingClientName: 'Head Office' } as never),
      new ClientListItemDto({ id: 'cl-3', name: 'Pivnice Bez Adresy' } as never),
    ],
    isPending: false,
    isError: false,
  }),
  useClient: () => ({ data: client, isPending: false, isError: false }),
  useCreateClient: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdateClient: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useClientReminders', () => ({
  useClientReminders: () => ({ data: [], isPending: false }),
}));
// A fn rather than a fixed `[]`, so one test can hand back real per-row detail data (the
// address fallback needs `cl-3`'s detail to carry a contact address and no official one) while
// every other test keeps the empty default.
const useQueriesMock = vi.fn((): { data?: ClientDto }[] => []);
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueries: () => useQueriesMock(),
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

/** The list route, where every row comes from the list response alone. */
function renderList() {
  return render(
    <MemoryRouter initialEntries={['/clients']}>
      <MuiThemeProvider theme={theme}>
        <Routes>
          <Route path="/clients" element={<ClientsPage />} />
        </Routes>
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

/**
 * The trading name used to be read out of a per-client *detail* query — one request per
 * row, just for a subtitle — and the row stayed nameless until it landed. It is on the list
 * response now. `useQueries` is mocked empty here, so nothing but the list can be supplying
 * it: this fails the moment the page goes back to the detail for it.
 */
describe('ClientsPage rows', () => {
  beforeEach(() => {
    useQueriesMock.mockReturnValue([]);
  });

  it('names the trading entity without waiting on a per-row detail fetch', () => {
    renderList();

    expect(screen.getByText('Pivnice Na Rohu')).toBeInTheDocument();
    expect(screen.getByText('Na Rohu gastro s.r.o.')).toBeInTheDocument();
  });

  it('searches the trading name as well as the name', async () => {
    renderList();

    // "gastro" appears in a trading name and in no client's name.
    fireEvent.change(screen.getByPlaceholderText(/Hledat/i), { target: { value: 'gastro' } });

    // Waited on the row that must *go*, not the one that must stay: SearchField debounces,
    // and `waitFor` passes on its first synchronous check — so waiting for something to
    // remain true would succeed before the filter had run at all.
    await waitFor(() => expect(screen.queryByText('Pivnice U Kapra')).not.toBeInTheDocument());
    expect(screen.getByText('Pivnice Na Rohu')).toBeInTheDocument();
  });

  it('shows the payer on a sub-client row', async () => {
    renderList();

    // cl-2 ("Pivnice U Kapra") is billed through "Head Office" — the list DTO names the payer
    // directly, so this needs no per-row detail fetch either.
    expect(await screen.findByText('Head Office')).toBeInTheDocument();
  });

  it('falls back to the contact address for a client with no official one', async () => {
    // cl-3 ("Pivnice Bez Adresy") has a contact address but no official one in its detail —
    // the per-row detail queries line up with the client list order from the mock above.
    useQueriesMock.mockReturnValue([
      { data: undefined },
      { data: undefined },
      {
        data: ClientDto.fromJS({
          id: 'cl-3',
          name: 'Pivnice Bez Adresy',
          contactAddress: new AddressDto({
            streetName: 'Dlouhá', streetNumber: '14', city: 'Liberec', zip: '46001',
          } as never),
        }),
      },
    ]);

    renderList();

    expect(await screen.findByText(/Dlouhá 14/)).toBeInTheDocument();
  });
});

describe('ClientsPage back navigation', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    useQueriesMock.mockReturnValue([]);
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
