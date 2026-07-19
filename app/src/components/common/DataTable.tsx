import { type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
} from '@mui/material';
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
 * push the page body sideways. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyState,
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  dense?: boolean;
}) {
  if (rows.length === 0) {
    return <>{emptyState ?? <EmptyState title="Žádné záznamy" dense />}</>;
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
