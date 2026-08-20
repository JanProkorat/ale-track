// What only DeliveryPlaceDialog decides: the two "refuse to save" validation
// messages, and whether a search hit vs. a bare map click prefills the address
// fields. The map itself (AddressMapPicker) is Task 5's concern and is mocked
// out here so this file only exercises the dialog's own logic.
//
// fireEvent rather than user-event: the latter is not a dependency of this
// project and adding one for a test file is not worth it.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { Country, type ClientDeliveryPlaceDto } from 'src/generated/api-client';
import type { AddressHit, LatLng } from 'src/lib/geo';

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const createMutateAsync = vi.fn().mockResolvedValue('new-place-id');
const updateMutateAsync = vi.fn().mockResolvedValue('place-1');
let createPending = false;
let updatePending = false;

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useCreateDeliveryPlace: () => ({ mutateAsync: createMutateAsync, isPending: createPending }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: updateMutateAsync, isPending: updatePending }),
}));

// Captures the picker's onPick so tests can simulate a search hit or a bare
// map click directly, without standing up react-leaflet.
let capturedOnPick: ((p: LatLng, hit?: AddressHit) => void) | null = null;
vi.mock('src/components/common/AddressMapPicker', () => ({
  AddressMapPicker: ({ onPick }: { onPick: (p: LatLng, hit?: AddressHit) => void }) => {
    capturedOnPick = onPick;
    return <div data-testid="address-map-picker-stub" />;
  },
}));

const { DeliveryPlaceDialog } = await import('./DeliveryPlaceDialog');

function renderDialog(over: Partial<Parameters<typeof DeliveryPlaceDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MuiThemeProvider theme={theme}>
      <DeliveryPlaceDialog open clientId="client-1" onClose={onClose} onSaved={onSaved} {...over} />
    </MuiThemeProvider>,
  );
  return { onClose, onSaved };
}

function hit(parts: Partial<NonNullable<AddressHit['parts']>>): AddressHit {
  return { label: 'some hit', lat: 50.1, lng: 14.2, parts: { ...parts } };
}

beforeEach(() => {
  vi.clearAllMocks();
  createMutateAsync.mockResolvedValue('new-place-id');
  updateMutateAsync.mockResolvedValue('place-1');
  createPending = false;
  updatePending = false;
  capturedOnPick = null;
});

describe('DeliveryPlaceDialog validation', () => {
  it('warns and refuses to save when no point has been picked', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/Název místa/), { target: { value: 'Letní zahrádka' } });
    fireEvent.click(screen.getByRole('button', { name: /Uložit místo/ }));

    expect(enqueueSnackbar).toHaveBeenCalledWith('Určete bod v mapě nebo vyberte adresu', { variant: 'warning' });
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });

  it('warns and refuses to save when no name has been entered', () => {
    renderDialog();

    // A point alone is not enough — leave the name field blank.
    act(() => capturedOnPick!({ lat: 50.1, lng: 14.2 }));
    fireEvent.click(screen.getByRole('button', { name: /Uložit místo/ }));

    expect(enqueueSnackbar).toHaveBeenCalledWith('Zadejte název místa', { variant: 'warning' });
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });
});

describe('DeliveryPlaceDialog address prefill', () => {
  it('prefills the address fields from a search hit, and leaves them alone on a bare map click', () => {
    renderDialog();

    act(() => capturedOnPick!(
      { lat: 50.1, lng: 14.2 },
      hit({ streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', country: Country.Germany }),
    ));

    expect(screen.getByLabelText('Ulice')).toHaveValue('Nábřežní');
    expect(screen.getByLabelText('Číslo')).toHaveValue('3');
    expect(screen.getByLabelText('Město')).toHaveValue('Žitava');
    expect(screen.getByLabelText('PSČ')).toHaveValue('02763');

    // A bare map click (no hit) only moves the point — the address fields
    // the search hit just filled in must survive untouched.
    act(() => capturedOnPick!({ lat: 51.0, lng: 15.0 }));

    expect(screen.getByLabelText('Ulice')).toHaveValue('Nábřežní');
    expect(screen.getByLabelText('Číslo')).toHaveValue('3');
    expect(screen.getByLabelText('Město')).toHaveValue('Žitava');
    expect(screen.getByLabelText('PSČ')).toHaveValue('02763');
  });
});

describe('DeliveryPlaceDialog client name', () => {
  it('renders the client name in bold in the helper line when supplied', () => {
    renderDialog({ clientName: 'Hospoda U Netopýra' });
    expect(screen.getByText('Hospoda U Netopýra').tagName).toBe('B');
  });

  it('omits the name entirely when not supplied', () => {
    renderDialog();
    expect(screen.queryByText(/Hospoda/)).not.toBeInTheDocument();
    expect(screen.getByText(/Místo se uloží ke klientovi a půjde vybrat/)).toBeInTheDocument();
  });
});

describe('DeliveryPlaceDialog save', () => {
  it('calls the create mutation and onSaved with the new id once name and point are set', async () => {
    const { onSaved, onClose } = renderDialog();

    fireEvent.change(screen.getByLabelText(/Název místa/), { target: { value: 'Letní zahrádka' } });
    act(() => capturedOnPick!({ lat: 50.1, lng: 14.2 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Uložit místo/ }));
    });

    expect(createMutateAsync).toHaveBeenCalledTimes(1);
    const [{ clientId, data }] = createMutateAsync.mock.calls[0];
    expect(clientId).toBe('client-1');
    expect(data.name).toBe('Letní zahrádka');
    expect(data.latitude).toBe(50.1);
    expect(data.longitude).toBe(14.2);
    expect(onSaved).toHaveBeenCalledWith('new-place-id');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls the update mutation (not create) when editing an existing place', async () => {
    const existing = {
      id: 'place-1',
      name: 'Stará zahrádka',
      note: undefined,
      address: { streetName: '', streetNumber: '', city: '', zip: '', country: Country.Czechia, latitude: 50.5, longitude: 14.5 },
    } as unknown as ClientDeliveryPlaceDto;

    const { onSaved } = renderDialog({ place: existing });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Uložit místo/ }));
    });

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith('place-1');
  });
});
