import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from "@mui/material/IconButton";

import {Iconify} from 'src/components/iconify';

// ----------------------------------------------------------------------

export type VehiclesProps = {
    id: string;
    name: string;
    maxWeight: number;
};

type VehiclesTableRowProps = {
    row: VehiclesProps;
    selected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
    onDeleteClick: () => void;
};

export function VehiclesTableRow({row, selected, onSelectRow, onRowClick, onDeleteClick}: Readonly<VehiclesTableRowProps>) {

    return (
        <TableRow hover tabIndex={-1} role="checkbox" selected={selected}>
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
            <TableCell onClick={onRowClick}>{row.maxWeight}</TableCell>

            <TableCell align="right">
                <IconButton onClick={() => {
                    onDeleteClick()
                }} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
}
