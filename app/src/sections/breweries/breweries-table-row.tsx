import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

// ----------------------------------------------------------------------

export type BreweriesProps = {
    id: string;
    name: string;
};

type BreweriesTableRowProps = {
    row: BreweriesProps;
    selected: boolean;
    isSelected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
};

export function BreweriesTableRow({row, selected, isSelected, onSelectRow, onRowClick}: Readonly<BreweriesTableRowProps>) {

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
