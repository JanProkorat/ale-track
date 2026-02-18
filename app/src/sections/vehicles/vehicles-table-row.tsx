import { memo } from 'react';

import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type VehiclesProps = {
     id: string;
     name: string;
     maxWeight: number;
};

type VehiclesTableRowProps = {
     row: VehiclesProps;
     selected: boolean;
     onSelectRow: (id: string) => void;
     onRowClick: (id: string) => void;
     onDeleteClick: (id: string) => void;
};

export const VehiclesTableRow = memo(function VehiclesTableRow({
     row,
     selected,
     onSelectRow,
     onRowClick,
     onDeleteClick,
}: Readonly<VehiclesTableRowProps>) {
     return (
          <TableRow hover tabIndex={-1} role="checkbox" selected={selected}>
               <TableCell padding="checkbox">
                    <Checkbox
                         disableRipple
                         checked={selected}
                         onChange={(event) => {
                              event.stopPropagation();
                              onSelectRow(row.id);
                         }}
                    />
               </TableCell>

               <TableCell onClick={() => onRowClick(row.id)}>{row.name}</TableCell>
               <TableCell onClick={() => onRowClick(row.id)}>{row.maxWeight} Kg</TableCell>

               <TableCell align="right">
                    <IconButton onClick={() => onDeleteClick(row.id)} color="error">
                         <Iconify icon="solar:trash-bin-trash-bold" />
                    </IconButton>
               </TableCell>
          </TableRow>
     );
});
