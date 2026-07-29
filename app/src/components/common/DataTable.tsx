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
    return (
      <Stack divider={<Divider />}>
        {rows.map((row) => (
          <ButtonBase
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            disableRipple={!onRowClick}
            sx={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              px: 1.75,
              py: 1.5,
              ...(onRowClick && { cursor: 'pointer' }),
            }}
          >
            {mobileCard ? mobileCard(row) : <GenericCard columns={columns} row={row} />}
          </ButtonBase>
        ))}
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

/** Fallback mobile block: the first column carries the record's identity, the
 * rest become label/value lines. Columns with no header (chevrons, action cells)
 * carry no meaning without their row, so they are dropped. */
function GenericCard<T>({ columns, row }: { columns: Column<T>[]; row: T }) {
  const [lead, ...rest] = columns;
  return (
    <Box>
      {lead && <Box sx={{ fontWeight: 700, mb: 0.75 }}>{lead.render(row)}</Box>}
      <Stack spacing={0.5}>
        {rest
          .filter((c) => Boolean(c.header))
          .map((c) => (
            <Stack key={c.key} direction="row" spacing={1.5} alignItems="baseline">
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'text.secondary',
                  flex: '0 0 34%',
                }}
              >
                {c.header}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>{c.render(row)}</Box>
            </Stack>
          ))}
      </Stack>
    </Box>
  );
}
