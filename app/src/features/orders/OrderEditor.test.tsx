// The order editor's own client-selection wiring: picking a client resets the delivery
// address, then corrects it (async, once that client's own address data has loaded) to a
// kind the client can actually satisfy — see `defaultAddressKind` in deliveryAddress.ts and
// `changeClient`'s `pendingDefaultAddressClientRef` effect in OrderEditor.tsx. The pure
// `defaultAddressKind` function has its own direct tests in deliveryAddress.test.ts; this
// file covers the effect that actually consumes it inside the editor, which that coverage
// does not reach.

// fireEvent rather than user-event, matching the sibling editor tests — user-event is not
// a dependency of this project.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('src/hooks/useOrders', () => ({
  useOrder: () => ({ data: undefined, isLoading: false, isError: false }),
  useClientProductHistory: () => ({ data: undefined, isLoading: false }),
  useCreateOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

// Keyed by client id, not a single fixed object like the sibling test files use — this
// file's whole point is that OrderEditor picks up a *specific* client's own address data
// once it is the one selected, not whatever the mock always returns.
const clientDetails: Record<string, { officialAddress?: unknown; contactAddress?: unknown; name?: string }> = {
  'client-official': { officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' }, name: 'Hospoda Fakturační' },
  'client-contact': { officialAddress: undefined, contactAddress: { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763' }, name: 'Hospoda Kontaktní' },
};

// The editor reads the client's open ledger points above the cart, so the hook is mocked like
// every other resource — and the mock can say "nothing open", which is the ordinary case.
vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({
    data: [{ id: 'client-official', name: 'Hospoda Fakturační' }, { id: 'client-contact', name: 'Hospoda Kontaktní' }],
    isLoading: false,
  }),
  useClient: (id?: string) => ({ data: id ? clientDetails[id] : undefined, isLoading: false }),
}));

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: [], isLoading: false }),
  useCreateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('src/hooks/useBreweries', () => ({
  useBreweries: () => ({ data: [], isLoading: false }),
}));

vi.mock('src/hooks/useProducts', () => ({
  useProducts: () => ({ data: [], isLoading: false }),
}));

vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: [], isLoading: false }),
  useSuppliersMany: () => ({ bySupplier: new Map(), loading: new Set() }),
}));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const { OrderEditor } = await import('./OrderEditor');

function renderEditor() {
  // A data router, not MemoryRouter — the editor's unsaved-changes guard uses useBlocker,
  // which only works inside one (matches the sibling editor test files).
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <OrderEditor mode="create" onDone={vi.fn()} onCancel={vi.fn()} />
          </LocalizationProvider>
        </MuiThemeProvider>
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

/** The "Klient" card — holds the client picker first, then (once a client is chosen) the
 *  delivery-address <Select> right below it, so scoping to this card is what lets the address
 *  select be found unambiguously once no client-picking Combobox is left inside it. */
function clientCard(): HTMLElement {
  return screen.getByText('Klient').closest('.MuiCard-root') as HTMLElement;
}

function pickClient(name: string) {
  fireEvent.click(within(clientCard()).getByRole('button', { name: /open/i }));
  fireEvent.click(screen.getByText(name));
}

describe('OrderEditor — defaulting the delivery address to what the client actually has', () => {
  it('lands on Kontaktní once a freshly picked client with no official address has loaded', async () => {
    renderEditor();

    pickClient('Hospoda Kontaktní');

    await waitFor(() => {
      const select = within(clientCard()).getByRole('combobox');
      fireEvent.mouseDown(select);
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Kontaktní').closest('[aria-selected]')?.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('stays on Fakturační for a client that has an official address', async () => {
    // The control case: the effect must correct the default only when the client cannot
    // actually satisfy it, not on every client change.
    renderEditor();

    pickClient('Hospoda Fakturační');

    await waitFor(() => {
      const select = within(clientCard()).getByRole('combobox');
      fireEvent.mouseDown(select);
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Fakturační').closest('[aria-selected]')?.getAttribute('aria-selected')).toBe('true');
    });
  });
});
