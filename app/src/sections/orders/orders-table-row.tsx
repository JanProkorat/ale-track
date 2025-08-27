import {useTranslation} from "react-i18next";

import {Chip} from "@mui/material";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";

import {formatDate} from "../../locales/formatDate";

import type {OrderListItemDto} from "../../api/Client";

type OrdersTableRowProps = {
  row: OrderListItemDto;
    selected: boolean;
    isSelected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
};

export function OrdersTableRow({row, selected, isSelected, onSelectRow, onRowClick}: Readonly<OrdersTableRowProps>) {
  const { t } = useTranslation();

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
        <TableCell onClick={onRowClick} sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>{row.clientName}</TableCell>
        <TableCell onClick={onRowClick} sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
          <Chip label={t('orderState.' + row.state)} />
        </TableCell>
        <TableCell onClick={onRowClick}>{row.deliveryDate !== null && row.deliveryDate !== undefined ? formatDate(row.deliveryDate) : ""}</TableCell>
      </TableRow>
  );
}