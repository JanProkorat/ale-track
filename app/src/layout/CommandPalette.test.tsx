import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { CommandPalette } from './CommandPalette';

vi.mock('src/auth/AuthProvider', () => ({ useAuth: () => ({ canSee: () => true }) }));
vi.mock('src/api/dataSource', () => ({ useDataSource: () => ({}) }));

// The palette calls useQuery directly rather than going through a resource hook, so
// this stands in for all three record sources. `data: undefined` is the pre-fetch
// state every one of them starts in.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false, error: null }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

/** MUI's useMediaQuery reads window.matchMedia; happy-dom resolves it against a
 * 1024px window, so force the answer rather than depend on that default. */
function setCompact(compact: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: compact && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

const onClose = vi.fn();

function renderPalette() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <CommandPalette open onClose={onClose} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Below `compact` the theme makes the dialog full-bleed, which leaves no backdrop to
   * tap — and a phone has no Esc key. Without this button the sheet is a dead end.
   */
  it('offers a close button for the full-bleed sheet', () => {
    setCompact(true);
    renderPalette();

    fireEvent.click(screen.getByRole('button', { name: 'Zavřít hledání' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves the close button out where a backdrop and Esc already exist', () => {
    setCompact(false);
    renderPalette();

    expect(screen.queryByRole('button', { name: 'Zavřít hledání' })).not.toBeInTheDocument();
  });

  it('lists the modules the user can see before anything is typed', () => {
    setCompact(false);
    renderPalette();

    expect(screen.getByText('Nástěnka')).toBeInTheDocument();
    expect(screen.getByText('Objednávky')).toBeInTheDocument();
  });
});
