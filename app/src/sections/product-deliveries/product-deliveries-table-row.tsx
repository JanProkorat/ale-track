import {useTranslation} from "react-i18next";

import {Chip} from "@mui/material";
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import {formatDate} from "../../locales/formatDate";

import type {ProductDeliveryListItemDto} from "../../api/Client";

// ----------------------------------------------------------------------

type ProductDeliveriesTableRowProps = {
    row: ProductDeliveryListItemDto;
    selected: boolean;
    isSelected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
};

export function ProductDeliveriesTableRow({row, selected, isSelected, onSelectRow, onRowClick}: Readonly<ProductDeliveriesTableRowProps>) {
    const {t} = useTranslation();

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

            <TableCell onClick={onRowClick}>{row.deliveryDate !== undefined ? formatDate(row.deliveryDate) : ""}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                <Chip label={t('deliveryState.' + row.state)} />
            </TableCell>
        </TableRow>
    );
}
