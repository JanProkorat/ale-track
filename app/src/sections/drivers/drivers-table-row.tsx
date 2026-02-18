import { memo } from 'react';

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
    onSelectRow: (id: string) => void;
    onRowClick: (id: string) => void;
    onDeleteClick: (id: string) => void;
};

export const DriversTableRow = memo(function DriversTableRow(
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
                        onSelectRow(row.id);
                    }}
                />
            </TableCell>

            <TableCell onClick={() => onRowClick(row.id)}>{row.firstName}</TableCell>
            <TableCell onClick={() => onRowClick(row.id)}>{row.lastName}</TableCell>
            <TableCell align="center" onClick={() => onRowClick(row.id)}>
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
                <IconButton onClick={() => onDeleteClick(row.id)} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
});
