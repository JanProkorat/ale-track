// What only DeliveryPlacesPanel decides: whether the add button and each
// row's edit/delete actions show up when `editable`, the count chip, and the
// editable-conditional empty-state copy. The query can also be loading or
// failed — the mock below can express both, since a mock that always hands
// back a happy response cannot catch a crash on a missing one.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { AddressDto, ClientDeliveryPlaceDto, Country } from 'src/generated/api-client';

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

// The dialog opened by "Přidat místo"/edit renders AddressMapPicker, which
// pulls in react-leaflet — stub it out so this file stays about the panel.
vi.mock('src/components/common/AddressMapPicker', () => ({
  AddressMapPicker: () => <div data-testid="address-map-picker-stub" />,
}));

const deleteMutateAsync = vi.fn().mockResolvedValue('deleted-id');
const refetch = vi.fn();
let queryState: { data: ClientDeliveryPlaceDto[] | undefined; isLoading: boolean; isError: boolean; error?: unknown } =
  { data: [], isLoading: false, isError: false };

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ ...queryState, refetch }),
  useDeleteDeliveryPlace: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
  // Rendered by the panel's <DeliveryPlaceDialog>, which is mounted (closed)
  // even when no row is being edited — must still resolve to something usable.
  useCreateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { DeliveryPlacesPanel } = await import('./DeliveryPlacesPanel');

function place(over: Partial<ClientDeliveryPlaceDto> = {}): ClientDeliveryPlaceDto {
  return new ClientDeliveryPlaceDto({
    id: `place-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Letní zahrádka',
    note: undefined,
    address: new AddressDto({
      streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', country: Country.Germany, latitude: 50.9, longitude: 14.8,
    }),
    ...over,
  });
}

function renderPanel(editable: boolean) {
  return render(
    <MuiThemeProvider theme={theme}>
      <DeliveryPlacesPanel clientId="client-1" clientName="Hospoda U Netopýra" editable={editable} />
    </MuiThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteMutateAsync.mockResolvedValue('deleted-id');
  queryState = { data: [], isLoading: false, isError: false };
});

describe('DeliveryPlacesPanel editable gating', () => {
  it('hides the add button and every row action when not editable', () => {
    queryState = { data: [place({ name: 'Zahrádka A' }), place({ name: 'Sklad B' })], isLoading: false, isError: false };
    renderPanel(false);

    expect(screen.queryByRole('button', { name: /Přidat místo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upravit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Smazat' })).not.toBeInTheDocument();
    // The rows themselves are still shown — only the actions are gated.
    expect(screen.getByText('Zahrádka A')).toBeInTheDocument();
    expect(screen.getByText('Sklad B')).toBeInTheDocument();
  });

  it('shows the add button and per-row edit/delete actions when editable', () => {
    queryState = { data: [place()], isLoading: false, isError: false };
    renderPanel(true);

    expect(screen.getByRole('button', { name: /Přidat místo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upravit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Smazat' })).toBeInTheDocument();
  });
});

describe('DeliveryPlacesPanel count and empty state', () => {
  it('shows the row count in the header chip', () => {
    queryState = { data: [place(), place(), place()], isLoading: false, isError: false };
    renderPanel(true);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the "add it above" hint in the empty state only when editable', () => {
    queryState = { data: [], isLoading: false, isError: false };
    renderPanel(true);
    expect(screen.getByText('Žádná vlastní místa.')).toBeInTheDocument();
    expect(screen.getByText(/Přidejte je tlačítkem výše/)).toBeInTheDocument();
  });

  it('omits the "add it above" hint in the empty state when not editable', () => {
    queryState = { data: [], isLoading: false, isError: false };
    renderPanel(false);
    expect(screen.getByText('Žádná vlastní místa.')).toBeInTheDocument();
    expect(screen.queryByText(/Přidejte je tlačítkem výše/)).not.toBeInTheDocument();
  });
});

describe('DeliveryPlacesPanel query states', () => {
  it('shows a spinner while loading, not the empty state or any row', () => {
    queryState = { data: undefined, isLoading: true, isError: false };
    renderPanel(true);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Žádná vlastní místa.')).not.toBeInTheDocument();
  });

  it('shows an error alert with a retry action on failure', () => {
    queryState = { data: undefined, isLoading: false, isError: true, error: new Error('Nelze se připojit') };
    renderPanel(true);
    expect(screen.getByText('Nelze se připojit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});

describe('DeliveryPlacesPanel delete flow', () => {
  it('asks for confirmation before deleting, and calls the mutation only after confirming', async () => {
    const target = place({ id: 'place-1', name: 'Zahrádka A' });
    queryState = { data: [target], isLoading: false, isError: false };
    renderPanel(true);

    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Místo zmizí z nabídky/)).toBeInTheDocument();
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Smazat' }));

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith({ id: 'place-1', clientId: 'client-1' }));
  });
});
