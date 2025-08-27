import {useTranslation} from "react-i18next";

import {Chip} from "@mui/material";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";

import {Iconify} from "../../../components/iconify";

import type {BreweryProductListItemDto} from "../../../api/Client";

type ProductDeliveryStopProductRowProps = {
    row: BreweryProductListItemDto;
    quantity: number | undefined;
    onDeleteClick: () => void;
    onQuantityChange: (quantity: number | undefined) => void;
    disabled?: boolean;
};

export function ProductDeliveryStopProductRow(
    {
        row,
        quantity,
        onDeleteClick,
        onQuantityChange,
        disabled
    }: Readonly<ProductDeliveryStopProductRowProps>) {

    const { t } = useTranslation();

    return (
        <TableRow hover tabIndex={-1} role="checkbox">
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>{row.name}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content'}}>
                <TextField
                    disabled={disabled}
                    variant="outlined"
                    type="number"
                    value={quantity}
                    error={quantity == undefined || quantity == 0}
                    onChange={(event) => {
                        const val = event.target.value;
                        onQuantityChange(val === "" ? undefined : Number(val));
                    }}/>
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                <Chip label={t('productKind.' + row.kind)} />
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>{row.packageSize}L</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>{row.priceWithVat} Kč</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>{row.priceForUnitWithVat} Kč</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                <Chip label={t('productType.' + row.type)} />
            </TableCell>

            <TableCell align="right">
                <IconButton onClick={onDeleteClick} disabled={disabled} color="error">
                    <Iconify icon="solar:trash-bin-trash-bold"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
}