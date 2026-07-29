import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton, ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { DataTable, type Column } from './DataTable';

type Row = { id: string; name: string; secret: string };

const rows: Row[] = [{ id: '1', name: 'Šárka Prokorátová', secret: '8 úprav' }];

const onAction = vi.fn();

const columns: Column<Row>[] = [
  { key: 'name', header: 'Jméno', render: (r) => <span>{r.name}</span> },
  // Flagged hidden on mobile — the table shows it, a phone must not.
  { key: 'perms', header: 'Práva k modulům', hideOnMobile: true, render: (r) => <span>{r.secret}</span> },
  // Headerless action cell: dropping it would lose the row's only controls.
  {
    key: 'actions',
    header: '',
    render: () => (
      <IconButton aria-label="Upravit" onClick={onAction}>
        <span>edit</span>
      </IconButton>
    ),
  },
];

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

const original = window.matchMedia;
beforeEach(() => onAction.mockClear());
afterEach(() => {
  window.matchMedia = original;
});

/** DataTable resolves `compact` off the app theme, so it needs the real one —
 * MUI's default has no such breakpoint and a bare render gets a null theme. */
const renderTable = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('DataTable mobile fallback', () => {
  it('keeps a headerless action column, and its button works', () => {
    setCompact(true);
    renderTable(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);

    const action = screen.getByLabelText('Upravit');
    expect(action).toBeInTheDocument();
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('honours hideOnMobile the same way the table does', () => {
    setCompact(true);
    renderTable(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);

    expect(screen.getByText('Šárka Prokorátová')).toBeInTheDocument();
    expect(screen.queryByText('8 úprav')).not.toBeInTheDocument();
  });

  it('does not nest a row action inside a row button when the row is not clickable', () => {
    setCompact(true);
    renderTable(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);

    // An action button inside a row button is invalid HTML and swallows clicks.
    expect(screen.getByLabelText('Upravit').closest('button[data-testid="list-row"]')).toBeNull();
  });

  it('makes the row itself clickable when onRowClick is given', () => {
    setCompact(true);
    const onRowClick = vi.fn();
    renderTable(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} onRowClick={onRowClick} />);

    fireEvent.click(screen.getByTestId('list-row'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('renders a real table above the breakpoint, including the hideOnMobile column', () => {
    setCompact(false);
    renderTable(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('8 úprav')).toBeInTheDocument();
    expect(screen.queryByTestId('list-row')).not.toBeInTheDocument();
  });

  it('prefers a caller-supplied mobileCard over the fallback', () => {
    setCompact(true);
    renderTable(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        mobileCard={(r) => <span>card:{r.name}</span>}
      />,
    );

    expect(screen.getByText('card:Šárka Prokorátová')).toBeInTheDocument();
    expect(screen.queryByText('Jméno')).not.toBeInTheDocument();
  });
});
