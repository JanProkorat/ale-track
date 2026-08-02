import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ClientDto, Country } from 'src/generated/api-client';
import { ClientFormDrawer } from './ClientFormDrawer';

const createMutation = vi.fn().mockResolvedValue(undefined);
const updateMutation = vi.fn().mockResolvedValue(undefined);

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/lib/geo', () => ({ geocodeAddress: vi.fn().mockResolvedValue({ lat: 50.9, lng: 14.8 }) }));
vi.mock('src/hooks/useClients', () => ({
  useCreateClient: () => ({ mutateAsync: createMutation, isPending: false }),
  useUpdateClient: () => ({ mutateAsync: updateMutation, isPending: false }),
}));

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Built through `fromJS` on purpose: the API serializes enums as their member
 * name, and the generated DTO copies that wire value through untouched — so an
 * edited client's `country` is the string `"Czechia"`, not the numeric 1 the
 * generated enum declares. Constructing the DTO by hand would hide that. */
function existingClient() {
  return ClientDto.fromJS({
    id: 'c1',
    name: 'Standa Dlouhý',
    businessName: 'Bar Panorama',
    region: 'ZittauCity',
    officialAddress: {
      streetName: 'Lidická', streetNumber: '321', city: 'Hrádek nad Nisou', zip: '46334',
      country: 'Czechia', latitude: 50.85, longitude: 14.84,
    },
    contacts: [],
  });
}

describe('ClientFormDrawer', () => {
  beforeEach(() => {
    createMutation.mockClear();
    updateMutation.mockClear();
  });

  it('submits a new client that has no separate contact address', async () => {
    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    fill('Název', 'Standa Dlouhý');
    fill('Ulice', 'Lidická');
    fill('Č.p.', '321');
    fill('Město', 'Hrádek nad Nisou');
    fill('PSČ', '46334');

    fireEvent.click(screen.getByRole('button', { name: 'Přidat klienta' }));

    await waitFor(() => expect(createMutation).toHaveBeenCalledTimes(1));
    expect(createMutation.mock.calls[0][0]).toMatchObject({
      name: 'Standa Dlouhý',
      contactAddress: undefined,
    });
  });

  it('prefills the country when editing and submits it as the enum value', async () => {
    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open client={existingClient()} onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(screen.getByLabelText('Země')).toHaveValue('Česko');

    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    await waitFor(() => expect(updateMutation).toHaveBeenCalledTimes(1));
    expect(updateMutation.mock.calls[0][0].data.officialAddress.country).toBe(Country.Czechia);
  });

  it('still requires the contact address once the toggle is on', async () => {
    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    fill('Název', 'Standa Dlouhý');
    fill('Ulice', 'Lidická');
    fill('Č.p.', '321');
    fill('Město', 'Hrádek nad Nisou');
    fill('PSČ', '46334');
    fireEvent.click(screen.getByLabelText('Odlišná kontaktní adresa'));

    fireEvent.click(screen.getByRole('button', { name: 'Přidat klienta' }));

    // The second "Ulice" is the contact block's — it must be flagged invalid.
    await waitFor(() => expect(screen.getAllByLabelText('Ulice')[1]).toHaveAttribute('aria-invalid', 'true'));
    expect(createMutation).not.toHaveBeenCalled();
  });
});
