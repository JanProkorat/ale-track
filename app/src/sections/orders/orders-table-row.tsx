import { memo } from 'react';

import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";

import { formatDate } from "../../locales/formatDate";

import type { OrderListItemDto } from "../../api/Client";

type OrdersTableRowProps = {
  row: OrderListItemDto;
  selected: boolean;
  isSelected: boolean;
  onSelectRow: (id: string) => void;
  onRowClick: (id: string) => void;
};

export const OrdersTableRow = memo(function OrdersTableRow({ row, selected, isSelected, onSelectRow, onRowClick }: Readonly<OrdersTableRowProps>) {

  return (
    <TableRow hover tabIndex={-1} role="checkbox" selected={selected} sx={{ bgcolor: isSelected ? 'primary.lighter' : undefined }}>
      <TableCell padding="checkbox">
        <Checkbox
          disableRipple
          checked={selected}
          onChange={(event) => {
            event.stopPropagation();
            onSelectRow(row.id!);
          }}
        />
      </TableCell>
      <TableCell onClick={() => onRowClick(row.id!)} sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>{row.clientName}</TableCell>
      <TableCell onClick={() => onRowClick(row.id!)}>{row.requiredDeliveryDate !== null && row.requiredDeliveryDate !== undefined ? formatDate(row.requiredDeliveryDate) : ""}</TableCell>
    </TableRow>
  );
});