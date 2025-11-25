import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import {Chip} from "@mui/material";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";

import {Iconify} from "../../../components/iconify";

import type {ProductListItemDto} from "../../../api/Client";

type OrderItemTableRowProps = {
    row: ProductListItemDto;
    quantity: number | undefined;
    onDeleteClick: () => void;
    onQuantityChange: (quantity: number | undefined) => void;
    disabled?: boolean;
};

export function OrderItemTableRow(
    {
        row,
        quantity,
        onDeleteClick,
        onQuantityChange,
        disabled
    }: Readonly<OrderItemTableRowProps>) {

    const [selected, setSelected] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const { t } = useTranslation();

    return (
        <TableRow
            tabIndex={-1}
            role="checkbox"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={{
                cursor: 'pointer',
            }}
        >
            <TableCell
                padding="checkbox"
                sx={{
                    position: 'sticky !important',
                    left: '0 !important',
                    zIndex: '100 !important',
                    backgroundColor: isHovered ? '#f5f5f5 !important' : '#fff !important',
                    backgroundImage: 'none !important',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                    boxShadow: '2px 0 5px -2px rgba(0, 0, 0, 0.1)',
                }}
            >
                <Checkbox
                    disableRipple
                    checked={selected}
                    onChange={(event: any) => {
                        event.stopPropagation();
                        setSelected(!selected);
                    }}
                />
            </TableCell>
            <TableCell
                sx={{
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                    position: 'sticky !important',
                    left: '42px !important',
                    zIndex: '100 !important',
                    backgroundColor: isHovered ? '#f5f5f5 !important' : '#fff !important',
                    backgroundImage: 'none !important',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                    boxShadow: '2px 0 5px -2px rgba(0, 0, 0, 0.1)',
                }}
            >
                {row.name}
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                <TextField
                    disabled={disabled}
                    variant="outlined"
                    type="number"
                    value={quantity ?? ""}
                    error={quantity == undefined || quantity == 0}
                    onChange={(event) => {
                        const val = event.target.value;
                        onQuantityChange(val === "" ? undefined : Number(val));
                    }}/>
            </TableCell>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>
                <Chip label={t('productKind.' + row.kind)} />
            </TableCell>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>{row.packageSize} L</TableCell>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>{row.weight} Kg</TableCell>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>{row.priceWithVat} Kč</TableCell>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>{row.priceForUnitWithVat} Kč</TableCell>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>
                <Chip label={t('productType.' + row.type)} />
            </TableCell>

            <TableCell align="right" sx={{
                backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            }}>
                <IconButton onClick={onDeleteClick} disabled={disabled} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
}