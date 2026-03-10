import type { ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column<T> {
     id: string;
     label: string;
     render?: (row: T) => ReactNode;
     minWidth?: number;
     width?: number | string;
     align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
     columns: Column<T>[];
     rows: T[];
     getId: (row: T) => string;
     loading?: boolean;
     searchValue?: string;
     onSearchChange?: (value: string) => void;
     onRowClick?: (row: T) => void;
     selectedId?: string | null;
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export default function DataTable<T>({
     columns,
     rows,
     getId,
     loading = false,
     searchValue,
     onSearchChange,
     onRowClick,
     selectedId,
}: DataTableProps<T>) {
     const { t } = useTranslation();

     return (
          <Box>
               {/* Search field */}
               {onSearchChange && (
                    <Box sx={{ p: 1 }}>
                         <TextField
                              size="small"
                              fullWidth
                              placeholder={t('common.search')}
                              value={searchValue ?? ''}
                              onChange={(e) => onSearchChange(e.target.value)}
                              slotProps={{
                                   input: {
                                        startAdornment: (
                                             <InputAdornment position="start">
                                                  <SearchIcon fontSize="small" />
                                             </InputAdornment>
                                        ),
                                   },
                              }}
                         />
                    </Box>
               )}

               {/* Loading state */}
               {loading && <LoadingSpinner />}

               {/* Empty state */}
               {!loading && rows.length === 0 && <EmptyState />}

               {/* Table */}
               {!loading && rows.length > 0 && (
                    <TableContainer>
                         <Table>
                              <TableHead>
                                   <TableRow>
                                        {columns.map((col) => (
                                             <TableCell
                                                  key={col.id}
                                                  align={col.align ?? 'left'}
                                                  sx={{ minWidth: col.minWidth, width: col.width }}
                                             >
                                                  {col.label}
                                             </TableCell>
                                        ))}
                                   </TableRow>
                              </TableHead>

                              <TableBody>
                                   {rows.map((row) => (
                                        <TableRow
                                             key={getId(row)}
                                             hover
                                             selected={selectedId != null && getId(row) === selectedId}
                                             onClick={onRowClick ? () => onRowClick(row) : undefined}
                                             sx={{
                                                  cursor: onRowClick ? 'pointer' : 'default',
                                             }}
                                        >
                                             {columns.map((col) => (
                                                  <TableCell key={col.id} align={col.align ?? 'left'}>
                                                       {col.render
                                                            ? col.render(row)
                                                            : (row as Record<string, unknown>)[col.id] != null
                                                              ? String((row as Record<string, unknown>)[col.id])
                                                              : ''}
                                                  </TableCell>
                                             ))}
                                        </TableRow>
                                   ))}
                              </TableBody>
                         </Table>
                    </TableContainer>
               )}
          </Box>
     );
}
