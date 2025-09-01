import Box from '@mui/material/Box';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableHead from '@mui/material/TableHead';
import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';

import {visuallyHidden} from '../../providers/utils';

// ----------------------------------------------------------------------

type SortableTableHeadProps = {
    orderBy: string;
    rowCount: number;
    numSelected: number;
    order: 'asc' | 'desc';
    onSort: (id: string) => void;
    headLabel: Record<string, any>[];
    onSelectAllRows: (checked: boolean) => void;
    checkboxVisible?: boolean;
};

export function SortableTableHead(
    {
        order,
        onSort,
        orderBy,
        rowCount,
        headLabel,
        numSelected,
        onSelectAllRows,
        checkboxVisible
    }: Readonly<SortableTableHeadProps>) {
    return (
        <TableHead>
            <TableRow>
                {
                    (checkboxVisible === undefined || !checkboxVisible) &&
                    <TableCell padding="checkbox">
                        <Checkbox
                            indeterminate={numSelected > 0 && numSelected < rowCount}
                            checked={rowCount > 0 && numSelected === rowCount}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                onSelectAllRows(event.target.checked)
                            }
                        />
                    </TableCell>
                }

                {headLabel.map((headCell) => (
                    <TableCell
                        key={headCell.id}
                        align={headCell.align || 'left'}
                        sortDirection={orderBy === headCell.id ? order : false}
                        sx={{
                            width: headCell.width,
                            minWidth: headCell.minWidth,
                            position: headCell.id == "name" ? 'sticky' : undefined,
                            left: headCell.id == "name" ? 0 : undefined,
                            zIndex: headCell.id == "name" ? 1 : undefined
                    }}
                    >
                        <TableSortLabel
                            hideSortIcon
                            active={orderBy === headCell.id}
                            direction={orderBy === headCell.id ? order : 'asc'}
                            onClick={() => onSort(headCell.id)}
                        >
                            {headCell.label}
                            {orderBy === headCell.id ? (
                                <Box sx={{...visuallyHidden}}>
                                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                                </Box>
                            ) : null}
                        </TableSortLabel>
                    </TableCell>
                ))}
            </TableRow>
        </TableHead>
    );
}
