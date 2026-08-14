import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Box,
  Stack,
  Divider,
  ButtonBase,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { type Theme } from '@mui/material/styles';
import { type SystemStyleObject } from '@mui/system';
import { EmptyState } from './EmptyState';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  clampPage,
  pageSlice,
  readStoredPageSize,
  sortRows,
  storePageSize,
  type SortState,
  type SortValue,
} from './dataTableModel';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Hide below the sm breakpoint. */
  hideOnMobile?: boolean;
  /** Makes the column's header clickable to sort by it. Required because `render` returns a
   * ReactNode, which cannot be ordered — a sortable column has to expose the underlying
   * value. Columns without it (chips, action buttons, chevrons) stay inert. */
  sortValue?: (row: T) => SortValue;
}

/** Column-driven table with a built-in empty state and optional row click.
 * Wraps content in a horizontally-scrollable container so wide tables never
 * push the page body sideways.
 *
 * Below the `compact` breakpoint the table is replaced by a divided list of
 * per-row blocks, so a phone scrolls down through records instead of sideways
 * through columns. Callers shape that block with `mobileCard`; without one, a
 * generic title + label/value list is derived from the columns.
 *
 * Sorting and paging are both **opt-in**: with neither `paginated` nor a sort prop set the
 * component renders every row exactly as before, which is what keeps the nested tables
 * (shipment detail, the Reporty tabs) unchanged. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyState,
  dense = false,
  mobileCard,
  rowSx,
  paginated = false,
  pageSizeKey,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  pageResetKey,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  dense?: boolean;
  mobileCard?: (row: T) => ReactNode;
  /** Per-row styling, for a row whose whole record needs flagging rather than one cell — an
   * overdue sale, say. Returning `undefined` leaves the row at its default. Applied to the
   * table row and to the compact list block, so the flag survives the mobile layout. */
  rowSx?: (row: T) => SystemStyleObject<Theme> | undefined;
  /** Show a rows-per-page pager and render only the current page. */
  paginated?: boolean;
  /** Identifies this list for the remembered rows-per-page, e.g. 'orders'. Each list keeps
   * its own choice, so setting 50 here does not change any other list. Omitted means the
   * choice is not remembered at all. */
  pageSizeKey?: string;
  /** Initial ordering, for the uncontrolled case. Ignored once `sort` is supplied. */
  defaultSort?: SortState;
  /** Lifts sort state to the caller. Needed when several tables must sort in unison — the
   * clients list renders one table per region and all of them follow one header click.
   * `undefined` is the third, unsorted state, not "not wired up". */
  sort?: SortState;
  onSortChange?: (sort: SortState | undefined) => void;
  /** Change this when the caller's filters change to send the pager back to page one.
   * Without it, narrowing a search while on a later page leaves the user on a page that no
   * longer holds their results. */
  pageResetKey?: string | number;
}) {
  // A callback query keeps this a single render tree. Rendering both a table and
  // a card list behind CSS would double the DOM and make every text query in the
  // page tests ambiguous. happy-dom has no matchMedia, so tests see the table.
  const isCompact = useMediaQuery((t: Theme) => t.breakpoints.down('compact'));

  const [uncontrolledSort, setUncontrolledSort] = useState<SortState | undefined>(defaultSort);
  // Keyed on `onSortChange`, not on `controlledSort ?? uncontrolledSort`: undefined is now a
  // real state (the third, unsorted click), so a coalesce would fall back to stale internal
  // state the moment a controlled parent cleared its sort.
  const isSortControlled = onSortChange !== undefined;
  const sort = isSortControlled ? controlledSort : uncontrolledSort;

  // Read the remembered size only when this table actually pages; an unpaged table has no
  // pager to honour it and would just be reading storage for nothing.
  const [pageSize, setPageSize] = useState(() =>
    paginated ? readStoredPageSize(pageSizeKey) : DEFAULT_PAGE_SIZE
  );
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows;
    }
    const column = columns.find((c) => c.key === sort.key);
    // A sort key with no matching sortable column (a stale persisted key, a renamed column)
    // leaves the incoming order alone rather than throwing.
    if (!column?.sortValue) {
      return rows;
    }
    return sortRows(rows, column.sortValue, sort.direction);
  }, [rows, columns, sort]);

  useEffect(() => {
    setPage(0);
  }, [pageResetKey]);

  // Follow the row set down when it shrinks under the current page, so the state matches
  // what is rendered instead of springing back to a stale page if the rows return.
  useEffect(() => {
    setPage((current) => clampPage(current, sortedRows.length, pageSize));
  }, [sortedRows.length, pageSize]);

  // Three states per column, cycling ascending → descending → unsorted. The third click
  // clears the sort rather than returning to ascending, so the list can be put back to the
  // order it arrived in (newest-first on the orders list, for instance) without a reload.
  const changeSort = (key: string) => {
    let next: SortState | undefined;
    if (sort?.key !== key) {
      next = { key, direction: 'asc' };
    } else if (sort.direction === 'asc') {
      next = { key, direction: 'desc' };
    } else {
      next = undefined;
    }

    // A new ordering makes the current page meaningless — the rows the user was looking at
    // are somewhere else now.
    setPage(0);

    if (onSortChange) {
      onSortChange(next);
    } else {
      setUncontrolledSort(next);
    }
  };

  const safePage = clampPage(page, sortedRows.length, pageSize);
  const visibleRows = paginated ? pageSlice(sortedRows, safePage, pageSize) : sortedRows;

  // Nothing to page through: a single page of rows gets no pager, which is what keeps the
  // small per-region clients tables from each growing one.
  const pager =
    paginated && sortedRows.length > pageSize ? (
      <TablePagination
        component="div"
        count={sortedRows.length}
        page={safePage}
        onPageChange={(_, next) => setPage(next)}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
        onRowsPerPageChange={(event) => {
          const next = Number(event.target.value);
          setPageSize(next);
          storePageSize(pageSizeKey, next);
          setPage(0);
        }}
        labelRowsPerPage="Řádků na stránku:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} z ${count}`}
        getItemAriaLabel={(type) =>
          type === 'previous'
            ? 'Předchozí stránka'
            : type === 'next'
              ? 'Další stránka'
              : type === 'first'
                ? 'První stránka'
                : 'Poslední stránka'
        }
        sx={{ borderTop: 1, borderColor: 'divider' }}
      />
    ) : null;

  if (rows.length === 0) {
    return <>{emptyState ?? <EmptyState title="Žádné záznamy" dense />}</>;
  }

  if (isCompact) {
    // Headerless columns are action cells and chevrons. They render outside the
    // clickable region always: a button nested in a button is invalid HTML and the
    // inner one stops receiving its clicks. (Same reason CollapsibleCard keeps its
    // header actions outside the clickable title.) A caller-supplied mobileCard
    // owns its whole body, so it must place any buttons of its own — see UsersPage.
    const mobileColumns = columns.filter((c) => !c.hideOnMobile);
    const actionColumns = mobileCard ? [] : mobileColumns.slice(1).filter((c) => !c.header);
    const clickableSx = { display: 'block', flex: 1, minWidth: 0, textAlign: 'left' as const };

    return (
      <>
      <Stack divider={<Divider />}>
        {visibleRows.map((row) => {
          const body = mobileCard ? mobileCard(row) : <GenericCard columns={mobileColumns} row={row} />;
          return (
            <Stack
              key={getRowKey(row)}
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ px: 1.75, py: 1.5, ...rowSx?.(row) }}
            >
              {onRowClick ? (
                <ButtonBase
                  data-testid="list-row"
                  onClick={() => onRowClick(row)}
                  sx={{ ...clickableSx, cursor: 'pointer' }}
                >
                  {body}
                </ButtonBase>
              ) : (
                <Box data-testid="list-row" sx={clickableSx}>
                  {body}
                </Box>
              )}
              {actionColumns.length > 0 && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                  {actionColumns.map((c) => (
                    <Box key={c.key}>{c.render(row)}</Box>
                  ))}
                </Stack>
              )}
            </Stack>
          );
        })}
      </Stack>
      {pager}
      </>
    );
  }

  return (
    <>
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size={dense ? 'small' : 'medium'}>
        <TableHead>
          <TableRow>
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              return (
              <TableCell
                key={c.key}
                align={c.align}
                // Renders aria-sort, so assistive tech announces the ordering rather than
                // leaving the arrow as a purely visual cue.
                sortDirection={isSorted ? sort.direction : false}
                sx={{
                  width: c.width,
                  fontWeight: 700,
                  fontSize: 12,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  bgcolor: (t) => t.vars!.palette.brand.surface2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  ...(c.hideOnMobile && { display: { xs: 'none', sm: 'table-cell' } }),
                }}
              >
                {c.sortValue ? (
                  <TableSortLabel
                    active={isSorted}
                    direction={isSorted ? sort.direction : 'asc'}
                    onClick={() => changeSort(c.key)}
                    // The head is deliberately low-contrast; MUI's active state would
                    // override that, so keep the inherited colour and let the amber arrow
                    // carry the "sorted by this" signal.
                    sx={{
                      color: 'inherit',
                      '&:hover': { color: 'text.primary' },
                      '&.Mui-active': { color: 'text.primary' },
                      '&.Mui-active .MuiTableSortLabel-icon': { color: 'primary.main' },
                    }}
                  >
                    {c.header}
                  </TableSortLabel>
                ) : (
                  c.header
                )}
              </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              hover={Boolean(onRowClick)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={{
                ...(onRowClick && { cursor: 'pointer' }),
                '&:last-child td': { borderBottom: 0 },
                ...rowSx?.(row),
              }}
            >
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  align={c.align}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    ...(c.hideOnMobile && { display: { xs: 'none', sm: 'table-cell' } }),
                  }}
                >
                  <Box component="span" sx={{ display: 'block' }}>
                    {c.render(row)}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    {pager}
    </>
  );
}

/** Fallback mobile block: the first column carries the record's identity and the
 * remaining labelled ones become label/value rows. Headerless columns are handled
 * by the caller, outside the clickable region.
 *
 * Receives columns already filtered for `hideOnMobile`, which is honoured here
 * exactly as in the table — a column the table hides on mobile must not reappear
 * in the card. */
function GenericCard<T>({ columns, row }: { columns: Column<T>[]; row: T }) {
  const [lead, ...rest] = columns;
  const labelled = rest.filter((c) => Boolean(c.header));

  return (
    <Box>
      {lead && <Box sx={{ fontWeight: 700, mb: 0.75 }}>{lead.render(row)}</Box>}
      <Stack spacing={0.5}>
        {labelled.map((c) => (
          // Label left, value hard right: a fixed label column leaves a ragged gap
          // after short labels like "Role".
          <Stack key={c.key} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'text.secondary',
                flexShrink: 0,
              }}
            >
              {c.header}
            </Typography>
            <Box sx={{ minWidth: 0, textAlign: 'right' }}>{c.render(row)}</Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
