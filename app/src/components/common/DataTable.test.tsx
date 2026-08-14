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

describe('DataTable rowSx', () => {
  const flagRows: Row[] = [
    { id: '1', name: 'Po splatnosti', secret: '—' },
    { id: '2', name: 'V pořádku', secret: '—' },
  ];
  const flagged = (r: Row) => (r.id === '1' ? { bgcolor: 'brand.critTint' } : undefined);

  it('styles only the rows the callback flags', () => {
    setCompact(false);
    renderTable(<DataTable columns={columns} rows={flagRows} getRowKey={(r) => r.id} rowSx={flagged} />);

    const flaggedRow = screen.getByText('Po splatnosti').closest('tr') as HTMLElement;
    const plainRow = screen.getByText('V pořádku').closest('tr') as HTMLElement;

    expect(getComputedStyle(flaggedRow).backgroundColor).toBeTruthy();
    expect(getComputedStyle(plainRow).backgroundColor).toBeFalsy();
  });

  it('carries the flag into the compact layout, where the table is gone', () => {
    setCompact(true);
    renderTable(
      <DataTable
        columns={columns}
        rows={flagRows}
        getRowKey={(r) => r.id}
        rowSx={flagged}
        mobileCard={(r) => <span>{r.name}</span>}
      />,
    );

    // The block, not the clickable inner region — that is where the row's sx lands.
    const [flaggedBlock, plainBlock] = screen.getAllByTestId('list-row').map((el) => el.parentElement!);

    expect(getComputedStyle(flaggedBlock).backgroundColor).toBeTruthy();
    expect(getComputedStyle(plainBlock).backgroundColor).toBeFalsy();
  });
});

type SortRow = { id: string; name: string; count: number };

const sortColumns: Column<SortRow>[] = [
  { key: 'name', header: 'Jméno', render: (r) => <span>{r.name}</span>, sortValue: (r) => r.name },
  { key: 'count', header: 'Počet', render: (r) => <span>{r.count}</span>, sortValue: (r) => r.count },
  // No sortValue: an action column must never become clickable-to-sort.
  { key: 'actions', header: '', render: () => <span>akce</span> },
];

const makeRows = (count: number): SortRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: String(i), name: `Klient ${i}`, count: i }));

/** Body-row order by the first cell's text, so a reordering is directly observable. */
function renderedNames(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1) // drop the header row
    .map((row) => row.querySelectorAll('td')[0]?.textContent ?? '');
}

describe('DataTable sorting', () => {
  beforeEach(() => setCompact(false));

  it('leaves the incoming order alone until a sort is chosen', () => {
    renderTable(<DataTable columns={sortColumns} rows={makeRows(3)} getRowKey={(r) => r.id} />);

    expect(renderedNames()).toEqual(['Klient 0', 'Klient 1', 'Klient 2']);
    // Sortable but not yet sorted: the header is clickable (otherwise no sort could ever be
    // started) while nothing claims to be ordered.
    expect(screen.getByRole('columnheader', { name: 'Jméno' })).not.toHaveAttribute('aria-sort');
  });

  it('adds no sort affordance at all to columns that opt out', () => {
    // The guard for every existing caller: shipment detail and the Reporty tables define no
    // sortValue and pass no paging, so their headers must stay plain text.
    renderTable(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);

    expect(screen.queryByRole('button', { name: 'Jméno' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Jméno' })).not.toHaveAttribute('aria-sort');
  });

  it('makes only columns with a sortValue clickable', () => {
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={makeRows(3)}
        getRowKey={(r) => r.id}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Jméno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Počet' })).toBeInTheDocument();
    // The headerless action column has no sortValue, so nothing to press.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('applies defaultSort on first render', () => {
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={[
          { id: 'a', name: 'Zlín', count: 1 },
          { id: 'b', name: 'Brno', count: 2 },
        ]}
        getRowKey={(r) => r.id}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    );

    expect(renderedNames()).toEqual(['Brno', 'Zlín']);
  });

  it('cycles ascending, descending, then back to unsorted', () => {
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={[
          { id: 'a', name: 'Zlín', count: 1 },
          { id: 'b', name: 'Brno', count: 2 },
        ]}
        getRowKey={(r) => r.id}
      />,
    );

    const header = screen.getByRole('button', { name: 'Jméno' });
    const cell = () => screen.getByRole('columnheader', { name: 'Jméno' });

    fireEvent.click(header);
    expect(renderedNames()).toEqual(['Brno', 'Zlín']);
    // aria-sort lives on the cell, so screen-reader users get the ordering too.
    expect(cell()).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(header);
    expect(renderedNames()).toEqual(['Zlín', 'Brno']);
    expect(cell()).toHaveAttribute('aria-sort', 'descending');

    // Third click clears it: the incoming order returns and nothing claims to be sorted.
    fireEvent.click(header);
    expect(renderedNames()).toEqual(['Zlín', 'Brno']);
    expect(cell()).not.toHaveAttribute('aria-sort');

    // ...and a fourth starts the cycle over rather than sticking.
    fireEvent.click(header);
    expect(cell()).toHaveAttribute('aria-sort', 'ascending');
  });

  it('restores the incoming order on the third click, not an alphabetical one', () => {
    // The point of the unsorted state: get back to the order the page supplied (newest-first
    // on the orders list) without reloading.
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={[
          { id: 'c', name: 'Zlín', count: 3 },
          { id: 'a', name: 'Brno', count: 1 },
          { id: 'b', name: 'Praha', count: 2 },
        ]}
        getRowKey={(r) => r.id}
      />,
    );

    const header = screen.getByRole('button', { name: 'Jméno' });
    fireEvent.click(header);
    expect(renderedNames()).toEqual(['Brno', 'Praha', 'Zlín']);

    fireEvent.click(header);
    fireEvent.click(header);

    expect(renderedNames()).toEqual(['Zlín', 'Brno', 'Praha']);
  });

  it('clears a defaultSort too, once cycled past descending', () => {
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={[
          { id: 'a', name: 'Zlín', count: 1 },
          { id: 'b', name: 'Brno', count: 2 },
        ]}
        getRowKey={(r) => r.id}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    );

    expect(renderedNames()).toEqual(['Brno', 'Zlín']);

    fireEvent.click(screen.getByRole('button', { name: 'Jméno' })); // -> desc
    fireEvent.click(screen.getByRole('button', { name: 'Jméno' })); // -> unsorted

    expect(screen.getByRole('columnheader', { name: 'Jméno' })).not.toHaveAttribute('aria-sort');
    expect(renderedNames()).toEqual(['Zlín', 'Brno']);
  });

  it('starts a newly clicked column ascending and drops the old column marker', () => {
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={makeRows(3)}
        getRowKey={(r) => r.id}
        defaultSort={{ key: 'name', direction: 'desc' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Počet' }));

    expect(screen.getByRole('columnheader', { name: 'Počet' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: 'Jméno' })).not.toHaveAttribute('aria-sort');
  });

  it('hands sort state to the caller when controlled, without reordering itself', () => {
    // ClientsPage needs this: one header click has to reorder every per-region table.
    const onSortChange = vi.fn();
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={[
          { id: 'a', name: 'Zlín', count: 1 },
          { id: 'b', name: 'Brno', count: 2 },
        ]}
        getRowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );

    expect(renderedNames()).toEqual(['Brno', 'Zlín']);

    fireEvent.click(screen.getByRole('button', { name: 'Jméno' }));

    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
    // Controlled: the order only changes when the caller passes a new sort back down.
    expect(renderedNames()).toEqual(['Brno', 'Zlín']);
  });

  it('reports the cleared third state to a controlled caller as undefined', () => {
    const onSortChange = vi.fn();
    renderTable(
      <DataTable
        columns={sortColumns}
        rows={makeRows(3)}
        getRowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'desc' }}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Jméno' }));

    expect(onSortChange).toHaveBeenCalledWith(undefined);
  });

  it('honours a controlled caller clearing the sort, rather than falling back to its own', () => {
    // Regression guard: resolving the effective sort with `controlled ?? internal` would
    // quietly resurrect a stale internal sort the moment the parent cleared its own.
    const rows = [
      { id: 'c', name: 'Zlín', count: 3 },
      { id: 'a', name: 'Brno', count: 1 },
    ];
    const { rerender } = renderTable(
      <DataTable
        columns={sortColumns}
        rows={rows}
        getRowKey={(r) => r.id}
        defaultSort={{ key: 'name', direction: 'asc' }}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={vi.fn()}
      />,
    );

    expect(renderedNames()).toEqual(['Brno', 'Zlín']);

    rerender(
      <ThemeProvider theme={theme}>
        <DataTable
          columns={sortColumns}
          rows={rows}
          getRowKey={(r) => r.id}
          defaultSort={{ key: 'name', direction: 'asc' }}
          sort={undefined}
          onSortChange={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(renderedNames()).toEqual(['Zlín', 'Brno']);
  });
});

describe('DataTable paging', () => {
  beforeEach(() => setCompact(false));

  it('renders every row and no pager when paging is off', () => {
    renderTable(<DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} />);

    expect(renderedNames()).toHaveLength(25);
    expect(screen.queryByText(/Řádků na stránku/)).not.toBeInTheDocument();
  });

  it('shows ten rows by default and a pager reporting the full count', () => {
    renderTable(<DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />);

    expect(renderedNames()).toHaveLength(10);
    expect(renderedNames()[0]).toBe('Klient 0');
    expect(screen.getByText('1–10 z 25')).toBeInTheDocument();
  });

  it('hides the pager when everything fits on one page', () => {
    // Keeps the small per-region clients tables from each growing their own pager.
    renderTable(<DataTable columns={sortColumns} rows={makeRows(10)} getRowKey={(r) => r.id} paginated />);

    expect(renderedNames()).toHaveLength(10);
    expect(screen.queryByText(/Řádků na stránku/)).not.toBeInTheDocument();
  });

  it('moves to the next page', () => {
    renderTable(<DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />);

    fireEvent.click(screen.getByLabelText('Další stránka'));

    expect(renderedNames()[0]).toBe('Klient 10');
    expect(screen.getByText('11–20 z 25')).toBeInTheDocument();
  });

  it('renders the short remainder on the last page', () => {
    renderTable(<DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />);

    fireEvent.click(screen.getByLabelText('Další stránka'));
    fireEvent.click(screen.getByLabelText('Další stránka'));

    expect(renderedNames()).toHaveLength(5);
    expect(screen.getByText('21–25 z 25')).toBeInTheDocument();
  });

  it('returns to the first page when the caller signals a filter change', () => {
    const { rerender } = renderTable(
      <DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated pageResetKey="all" />,
    );

    fireEvent.click(screen.getByLabelText('Další stránka'));
    expect(screen.getByText('11–20 z 25')).toBeInTheDocument();

    // A narrowed search: fewer rows AND a new reset key.
    rerender(
      <ThemeProvider theme={theme}>
        <DataTable
          columns={sortColumns}
          rows={makeRows(25).slice(0, 12)}
          getRowKey={(r) => r.id}
          paginated
          pageResetKey="filtered"
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('1–10 z 12')).toBeInTheDocument();
    expect(renderedNames()[0]).toBe('Klient 0');
  });

  it('falls back to a valid page when the rows shrink without a reset key', () => {
    // Filtering while on a later page must not leave an empty table with no way back.
    const { rerender } = renderTable(
      <DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />,
    );

    fireEvent.click(screen.getByLabelText('Další stránka'));
    fireEvent.click(screen.getByLabelText('Další stránka'));
    expect(screen.getByText('21–25 z 25')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <DataTable columns={sortColumns} rows={makeRows(11)} getRowKey={(r) => r.id} paginated />
      </ThemeProvider>,
    );

    expect(screen.getByText('11–11 z 11')).toBeInTheDocument();
    expect(renderedNames()).toHaveLength(1);
  });

  it('returns to the first page when the ordering changes', () => {
    renderTable(
      <DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />,
    );

    fireEvent.click(screen.getByLabelText('Další stránka'));
    expect(screen.getByText('11–20 z 25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Jméno' }));

    // Staying on page 2 after a re-sort would show rows unrelated to what was on screen.
    expect(screen.getByText('1–10 z 25')).toBeInTheDocument();
  });

  it('sorts across the whole list, not just the visible page', () => {
    renderTable(
      <DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Počet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Počet' }));

    // Descending by count: the highest row in the list must lead, not the highest of page 1.
    expect(renderedNames()[0]).toBe('Klient 24');
  });

  it('pages the card list on a phone too', () => {
    setCompact(true);
    renderTable(<DataTable columns={sortColumns} rows={makeRows(25)} getRowKey={(r) => r.id} paginated />);

    expect(screen.getAllByTestId('list-row')).toHaveLength(10);
    expect(screen.getByText('1–10 z 25')).toBeInTheDocument();
  });

  it('still shows the empty state when there are no rows at all', () => {
    renderTable(<DataTable columns={sortColumns} rows={[]} getRowKey={(r) => r.id} paginated />);

    expect(screen.getByText('Žádné záznamy')).toBeInTheDocument();
    expect(screen.queryByText(/Řádků na stránku/)).not.toBeInTheDocument();
  });
});

describe('DataTable remembered page size', () => {
  const realLocalStorage = window.localStorage;

  beforeEach(() => setCompact(false));

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: realLocalStorage, configurable: true });
  });

  function useMemoryStorage(seed?: string) {
    const entries = new Map<string, string>();
    if (seed) {
      entries.set('aletrack.table.pageSize.orders', seed);
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, String(value)),
        removeItem: (key: string) => entries.delete(key),
        clear: () => entries.clear(),
        key: () => null,
        length: 0,
      },
    });
    return entries;
  }

  it('opens at a previously remembered size instead of ten', () => {
    useMemoryStorage('25');

    renderTable(
      <DataTable columns={sortColumns} rows={makeRows(40)} getRowKey={(r) => r.id} paginated pageSizeKey="orders" />,
    );

    expect(renderedNames()).toHaveLength(25);
    expect(screen.getByText('1–25 z 40')).toBeInTheDocument();
  });

  it('remembers a new choice under its own list key', () => {
    const entries = useMemoryStorage();

    renderTable(
      <DataTable columns={sortColumns} rows={makeRows(40)} getRowKey={(r) => r.id} paginated pageSizeKey="orders" />,
    );
    expect(renderedNames()).toHaveLength(10);

    // MUI's Select opens on mouseDown, not click (see app/CLAUDE.md).
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: '50' }));

    expect(renderedNames()).toHaveLength(40);
    expect(entries.get('aletrack.table.pageSize.orders')).toBe('50');
  });

  it('does not inherit another list’s remembered size', () => {
    // The reported bug: choosing 50 on one list silently set 50 everywhere else.
    useMemoryStorage('50');

    renderTable(
      <DataTable columns={sortColumns} rows={makeRows(40)} getRowKey={(r) => r.id} paginated pageSizeKey="clients" />,
    );

    expect(renderedNames()).toHaveLength(10);
  });

  it('remembers nothing when the table supplies no key', () => {
    useMemoryStorage('50');

    renderTable(<DataTable columns={sortColumns} rows={makeRows(40)} getRowKey={(r) => r.id} paginated />);

    expect(renderedNames()).toHaveLength(10);
  });

  it('defaults to ten when the store is unusable, which is what this environment does', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {} });

    renderTable(
      <DataTable columns={sortColumns} rows={makeRows(40)} getRowKey={(r) => r.id} paginated pageSizeKey="orders" />,
    );

    expect(renderedNames()).toHaveLength(10);
  });
});
