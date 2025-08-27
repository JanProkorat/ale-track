import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";

import type {UserListItemDto} from "../../api/Client";

type UsersTableRowProps = {
    row: UserListItemDto;
    selected: boolean;
    isSelected: boolean;
    onSelectRow: () => void;
    onRowClick: () => void;
};

export function UsersTableRow({row, selected, isSelected, onSelectRow, onRowClick}: Readonly<UsersTableRowProps>) {

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

            <TableCell onClick={onRowClick}>{row.userName}</TableCell>
        </TableRow>
    );
}
