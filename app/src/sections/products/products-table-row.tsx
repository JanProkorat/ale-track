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
    onSelectRow: () => void;
    onRowClick: () => void;
    onDeleteClick: () => void;
};

export function ProductsTableRow(
    {
        row,
        selected,
        onSelectRow,
        onRowClick,
        onDeleteClick
    }: Readonly<ProductsTableRowProps>) {
    const {t} = useTranslation();
    const { formatPrice } = useCurrency();

    return (
        <TableRow hover tabIndex={-1} selected={selected}>
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

            <TableCell
                onClick={onRowClick}
                sx={{
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1
                }}
            >
                {row.name}
            </TableCell>
            <TableCell onClick={onRowClick} sx={{
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
            }}>{row.platoDegree != undefined ? row.platoDegree + "%" : ""}</TableCell>

            <TableCell onClick={onRowClick} sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                <Chip label={t('productKind.' + row.kind)}/>
            </TableCell>
            <TableCell onClick={onRowClick}
                       sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>{row.packageSize}L</TableCell>
            <TableCell onClick={onRowClick}
                       sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>{row.alcoholPercentage}%</TableCell>
            <TableCell onClick={onRowClick} sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                {formatPrice(row.priceWithVat)}
            </TableCell>
            <TableCell onClick={onRowClick}
                       sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                {formatPrice(row.priceForUnitWithVat)}
            </TableCell>
            <TableCell onClick={onRowClick}
                       sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                {formatPrice(row.priceForUnitWithoutVat)}
            </TableCell>
            <TableCell onClick={onRowClick} sx={{whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                <Chip label={t('productType.' + row.type)}/>
            </TableCell>

            <TableCell align="right">
                <IconButton onClick={onDeleteClick} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
}