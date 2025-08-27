import Box from "@mui/material/Box";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";

import {Iconify} from "../../components/iconify";

import type {DriverAvailabilityListItemDto} from "../../api/Client";

export type DriversProps = {
    id: string;
    firstName: string;
    lastName: string;
    color: string;
    availableDates: DriverAvailabilityListItemDto[];
};

type DriversTableRowProps = {
    row: DriversProps;
    selected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
    onDeleteClick: () => void;
};

export function DriversTableRow(
    {
        row,
        selected,
        onSelectRow,
        onRowClick,
        onDeleteClick
    }: Readonly<DriversTableRowProps>) {

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

            <TableCell onClick={onRowClick}>{row.firstName}</TableCell>
            <TableCell onClick={onRowClick}>{row.lastName}</TableCell>
            <TableCell align="center" onClick={onRowClick}>
                <Box
                    sx={{
                        width: 16,
                        height: 16,
                        backgroundColor: row.color,
                        borderRadius: 0.5,
                        border: '1px solid #ccc',
                        display: 'inline-block',
                    }}
                />
            </TableCell>

            <TableCell align="center">
                <IconButton onClick={() => {
                    onDeleteClick()
                }} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
}
