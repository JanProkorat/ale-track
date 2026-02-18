import { memo, useState } from "react";
import {useTranslation} from "react-i18next";

import {Chip} from "@mui/material";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";

import {Iconify} from "../../components/iconify";
import {useCurrency} from "../../providers/currency-provider";

import type {BreweryProductListItemDto} from "../../api/Client";

type ProductsTableRowProps = {
    row: BreweryProductListItemDto;
    selected: boolean;
    onSelectRow: (id: string) => void;
    onRowClick: (id: string) => void;
    onDeleteClick: (id: string) => void;
};

export const ProductsTableRow = memo(function ProductsTableRow(
    {
        row,
        selected,
        onSelectRow,
        onRowClick,
        onDeleteClick
    }: Readonly<ProductsTableRowProps>) {
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const {t} = useTranslation();
    const { formatPrice } = useCurrency();

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
                    zIndex: '101 !important',
                    backgroundColor: isHovered ? '#f5f5f5 !important' : '#fff !important',
                    backgroundImage: 'none !important',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                    boxShadow: '2px 0 5px -2px rgba(0, 0, 0, 0.1)',
                }}
            >
                <Checkbox
                    disableRipple
                    checked={selected}
                    onChange={(event) => {
                        event.stopPropagation();
                        onSelectRow(row.id!);
                    }}
                />
            </TableCell>

            <TableCell
                onClick={() => onRowClick(row.id!)}
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
            <TableCell 
                onClick={() => onRowClick(row.id!)} 
                sx={{
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                {row.platoDegree != undefined ? row.platoDegree + "%" : ""}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)} 
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                <Chip label={t('productKind.' + row.kind)}/>
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)}
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
                >
                    {row.packageSize ? row.packageSize + " L" : ""}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)}
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                {row.weight ? row.weight + " Kg" : ""}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)}
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                {row.alcoholPercentage ? row.alcoholPercentage + "%" : ""}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)} 
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                {formatPrice(row.priceWithVat)}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)}
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                {formatPrice(row.priceForUnitWithVat)}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)}
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                {formatPrice(row.priceForUnitWithoutVat)}
            </TableCell>
            <TableCell 
                onClick={() => onRowClick(row.id!)} 
                sx={{
                    whiteSpace: 'nowrap', 
                    minWidth: 'fit-content',
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                }}
            >
                <Chip label={t('productType.' + row.type)}/>
            </TableCell>

            <TableCell 
                align="right"
                sx={{
                    position: 'sticky !important',
                    right: '0 !important',
                    zIndex: '101 !important',
                    backgroundColor: isHovered ? '#f5f5f5 !important' : '#fff !important',
                    backgroundImage: 'none !important',
                    transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
                    boxShadow: '-2px 0 5px -2px rgba(0, 0, 0, 0.1)',
                }}
            >
                <IconButton onClick={() => onDeleteClick(row.id!)} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
});