import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ClientDto, ClientListItemDto, Country } from 'src/generated/api-client';
import { ClientFormDrawer } from './ClientFormDrawer';

const createMutation = vi.fn().mockResolvedValue(undefined);
const updateMutation = vi.fn().mockResolvedValue(undefined);
// A fn rather than a fixed object, so individual tests can point it at whatever
// client list the payer picker needs to filter — same convention as the two
// mutation mocks above.
const useClientsMock = vi.fn(() => ({ data: [] as ClientListItemDto[] }));

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/lib/geo', () => ({ geocodeAddress: vi.fn().mockResolvedValue({ lat: 50.9, lng: 14.8 }) }));
vi.mock('src/hooks/useClients', () => ({
  useClients: () => useClientsMock(),
  useCreateClient: () => ({ mutateAsync: createMutation, isPending: false }),
  useUpdateClient: () => ({ mutateAsync: updateMutation, isPending: false }),
}));

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Opens a `Combobox` (MUI Autocomplete) by its label and picks the option with
 * the given text — same pattern as OrderEditor.test.tsx's `pickClient`: the
 * shared Combobox has no custom popup control, so the default "Open" icon
 * button is what's there to click. */
function pickCombobox(label: string, optionText: string) {
  const input = screen.getByLabelText(label);
  const root = input.closest('.MuiAutocomplete-root') as HTMLElement;
  fireEvent.click(within(root).getByRole('button', { name: /open/i }));
  fireEvent.click(screen.getByText(optionText));
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
    useClientsMock.mockReturnValue({ data: [] });
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

  // A client that is billed through a payer needs no billing address of its own — the address
  // is required "unless a payer is chosen", so this only submits validly once one is.
  it('saves a client with no official address', async () => {
    useClientsMock.mockReturnValue({
      data: [ClientListItemDto.fromJS({ id: 'payer-1', name: 'Hlavní kancelář' })],
    });

    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    fill('Název', 'Bez adresy s.r.o.');
    pickCombobox('Propojený klient', 'Hlavní kancelář');

    fireEvent.click(screen.getByRole('button', { name: 'Přidat klienta' }));

    await waitFor(() => expect(createMutation).toHaveBeenCalledTimes(1));
    expect(createMutation.mock.calls[0][0]).toMatchObject({
      name: 'Bez adresy s.r.o.',
      officialAddress: undefined,
      invoicingClientId: 'payer-1',
    });
  });

  it('offers only clients that can be a payer', async () => {
    useClientsMock.mockReturnValue({
      data: [
        // Eligible: no payer of its own, not itself a payer, not the client being edited.
        ClientListItemDto.fromJS({ id: 'plain-1', name: 'Volný klient' }),
        // Ineligible: already has a payer.
        ClientListItemDto.fromJS({ id: 'has-payer-1', name: 'Má plátce', invoicingClientId: 'someone-else' }),
        // Ineligible: is itself a payer — named as another row's invoicingClientId, which is
        // the only signal the list DTO carries for that.
        ClientListItemDto.fromJS({ id: 'is-payer-1', name: 'Je plátce' }),
        ClientListItemDto.fromJS({ id: 'sub-1', name: 'Podřízený', invoicingClientId: 'is-payer-1' }),
        // Ineligible: the client being edited itself.
        ClientListItemDto.fromJS({ id: 'c1', name: 'Standa Dlouhý' }),
      ],
    });

    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open client={existingClient()} onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    const input = screen.getByLabelText('Propojený klient');
    const root = input.closest('.MuiAutocomplete-root') as HTMLElement;
    fireEvent.click(within(root).getByRole('button', { name: /open/i }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    expect(within(listbox).getByText('Volný klient')).toBeInTheDocument();
  });

  it('sends the chosen payer', async () => {
    useClientsMock.mockReturnValue({
      data: [ClientListItemDto.fromJS({ id: 'payer-9', name: 'Hlavní pobočka' })],
    });

    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open client={existingClient()} onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    pickCombobox('Propojený klient', 'Hlavní pobočka');

    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    await waitFor(() => expect(updateMutation).toHaveBeenCalledTimes(1));
    expect(updateMutation.mock.calls[0][0].data.invoicingClientId).toBe('payer-9');
  });

  // The three halves of "official address required and complete unless a payer is chosen,
  // and a payer never excuses a half-filled address": each must independently block submit.
  it('rejects a blank official address when no payer is chosen', async () => {
    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    fill('Název', 'Bez adresy a bez plátce');

    fireEvent.click(screen.getByRole('button', { name: 'Přidat klienta' }));

    await waitFor(() => expect(screen.getByLabelText('Ulice')).toHaveAttribute('aria-invalid', 'true'));
    expect(createMutation).not.toHaveBeenCalled();
  });

  it('rejects a half-filled official address when no payer is chosen', async () => {
    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    fill('Název', 'Napůl vyplněná adresa');
    fill('Ulice', 'Lidická');
    // Č.p., Město and PSČ deliberately left blank.

    fireEvent.click(screen.getByRole('button', { name: 'Přidat klienta' }));

    await waitFor(() => expect(screen.getByLabelText('Město')).toHaveAttribute('aria-invalid', 'true'));
    expect(createMutation).not.toHaveBeenCalled();
  });

  it('rejects a half-filled official address even when a payer is chosen', async () => {
    useClientsMock.mockReturnValue({
      data: [ClientListItemDto.fromJS({ id: 'payer-1', name: 'Hlavní kancelář' })],
    });

    render(
      <MuiThemeProvider theme={theme}>
        <ClientFormDrawer open onClose={vi.fn()} />
      </MuiThemeProvider>,
    );

    fill('Název', 'Napůl vyplněná adresa s plátcem');
    fill('Ulice', 'Lidická');
    // Č.p., Město and PSČ deliberately left blank.
    pickCombobox('Propojený klient', 'Hlavní kancelář');

    fireEvent.click(screen.getByRole('button', { name: 'Přidat klienta' }));

    await waitFor(() => expect(screen.getByLabelText('Město')).toHaveAttribute('aria-invalid', 'true'));
    expect(createMutation).not.toHaveBeenCalled();
  });
});
