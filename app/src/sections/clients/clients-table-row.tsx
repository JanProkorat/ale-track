import { memo } from 'react';

import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import type { ClientListItemDto } from '../../api/Client';

// ----------------------------------------------------------------------

type ClientsTableRowProps = {
     row: ClientListItemDto;
     selected: boolean;
     isSelected: boolean;
     onSelectRow: (id: string) => void;
     onRowClick: (id: string) => void;
};

export const ClientsTableRow = memo(function ClientsTableRow({
     row,
     selected,
     isSelected,
     onSelectRow,
     onRowClick,
}: Readonly<ClientsTableRowProps>) {
     return (
          <TableRow
               hover
               tabIndex={-1}
               role="checkbox"
               selected={selected}
               sx={{ bgcolor: isSelected ? 'primary.lighter' : undefined }}
          >
               <TableCell padding="checkbox">
                    <Checkbox
                         disableRipple
                         checked={selected}
                         onChange={(event) => {
                              event.stopPropagation();
                              onSelectRow(row.id!);
                         }}
                    />
               </TableCell>

               <TableCell onClick={() => onRowClick(row.id!)}>{row.name}</TableCell>
          </TableRow>
     );
});
