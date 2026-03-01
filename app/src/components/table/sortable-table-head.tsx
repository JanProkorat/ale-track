import Box from '@mui/material/Box';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableHead from '@mui/material/TableHead';
import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';

import { visuallyHidden } from '../../providers/utils';

// ----------------------------------------------------------------------

type SortableTableHeadProps = {
     orderBy: string;
     rowCount: number;
     numSelected: number;
     order: 'asc' | 'desc';
     onSort: (id: string) => void;
     headLabel: Record<string, any>[];
     onSelectAllRows?: (checked: boolean) => void;
     checkboxVisible?: boolean;
     checkboxSticky?: boolean;
};

export function SortableTableHead({
     order,
     onSort,
     orderBy,
     rowCount,
     headLabel,
     numSelected,
     onSelectAllRows,
     checkboxVisible,
     checkboxSticky,
}: Readonly<SortableTableHeadProps>) {
     return (
          <TableHead>
               <TableRow>
                    {(checkboxVisible === undefined || checkboxVisible === true) && (
                         <TableCell
                              padding="checkbox"
                              sx={{
                                   position: checkboxSticky ? 'sticky' : undefined,
                                   left: checkboxSticky ? 0 : undefined,
                                   zIndex: checkboxSticky ? 103 : undefined,
                              }}
                         >
                              <Checkbox
                                   indeterminate={numSelected > 0 && numSelected < rowCount}
                                   checked={rowCount > 0 && numSelected === rowCount}
                                   onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        if (onSelectAllRows) onSelectAllRows(event.target.checked);
                                   }}
                              />
                         </TableCell>
                    )}

                    {headLabel.map((headCell, index) => (
                         <TableCell
                              key={headCell.id}
                              align={headCell.align || 'left'}
                              sortDirection={orderBy === headCell.id ? order : false}
                              sx={{
                                   width: headCell.width,
                                   minWidth: headCell.minWidth,
                                   position:
                                        headCell.id == 'name' && checkboxSticky
                                             ? 'sticky'
                                             : headCell.id == '' && index === headLabel.length - 1
                                               ? 'sticky'
                                               : undefined,
                                   left: headCell.id == 'name' && checkboxSticky ? 42 : undefined,
                                   right: headCell.id == '' && index === headLabel.length - 1 ? 0 : undefined,
                                   zIndex:
                                        headCell.id == 'name' && checkboxSticky
                                             ? 102
                                             : headCell.id == '' && index === headLabel.length - 1
                                               ? 103
                                               : undefined,
                              }}
                         >
                              <TableSortLabel
                                   hideSortIcon
                                   active={orderBy === headCell.id}
                                   direction={orderBy === headCell.id ? order : 'asc'}
                                   onClick={() => onSort(headCell.id)}
                              >
                                   {headCell.label}
                                   {orderBy === headCell.id ? (
                                        <Box sx={{ ...visuallyHidden }}>
                                             {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                                        </Box>
                                   ) : null}
                              </TableSortLabel>
                         </TableCell>
                    ))}
               </TableRow>
          </TableHead>
     );
}
