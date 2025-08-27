import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';


// ----------------------------------------------------------------------

export type ClientsProps = {
    id: string;
    name: string;
};

type ClientsTableRowProps = {
    row: ClientsProps;
    selected: boolean;
    isSelected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
};

export function ClientsTableRow({row, selected, isSelected, onSelectRow, onRowClick}: Readonly<ClientsTableRowProps>) {

    return (
        <TableRow hover tabIndex={-1} role="checkbox" selected={selected} sx={{bgcolor: isSelected ? 'primary.lighter' : undefined}}>
            <TableCell padding="checkbox">
                <Checkbox
                    disableRipple
                    checked={selected}
                    onChange={(event) => {
                        event.stopPropagation();
                        onSelectRow();
                    }}
                />
            </TableCell>

            <TableCell onClick={onRowClick}>{row.name}</TableCell>
        </TableRow>
    );
}
