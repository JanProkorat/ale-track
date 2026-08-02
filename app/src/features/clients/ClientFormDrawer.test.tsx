import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
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

describe('ClientFormDrawer', () => {
  beforeEach(() => {
    createMutation.mockClear();
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
