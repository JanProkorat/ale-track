import { type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Stack,
  Divider,
  ButtonBase,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { type Theme } from '@mui/material/styles';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Hide below the sm breakpoint. */
  hideOnMobile?: boolean;
}

/** Column-driven table with a built-in empty state and optional row click.
 * Wraps content in a horizontally-scrollable container so wide tables never
 * push the page body sideways.
 *
 * Below the `compact` breakpoint the table is replaced by a divided list of
 * per-row blocks, so a phone scrolls down through records instead of sideways
 * through columns. Callers shape that block with `mobileCard`; without one, a
 * generic title + label/value list is derived from the columns. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyState,
  dense = false,
  mobileCard,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  dense?: boolean;
  mobileCard?: (row: T) => ReactNode;
}) {
  // A callback query keeps this a single render tree. Rendering both a table and
  // a card list behind CSS would double the DOM and make every text query in the
  // page tests ambiguous. happy-dom has no matchMedia, so tests see the table.
  const isCompact = useMediaQuery((t: Theme) => t.breakpoints.down('compact'));

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
      <Stack divider={<Divider />}>
        {rows.map((row) => {
          const body = mobileCard ? mobileCard(row) : <GenericCard columns={mobileColumns} row={row} />;
          return (
            <Stack
              key={getRowKey(row)}
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ px: 1.75, py: 1.5 }}
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
    );
  }

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size={dense ? 'small' : 'medium'}>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                align={c.align}
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
                {c.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              hover={Boolean(onRowClick)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={{
                ...(onRowClick && { cursor: 'pointer' }),
                '&:last-child td': { borderBottom: 0 },
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
