import type {TableRowProps} from '@mui/material/TableRow';

import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type TableNoDataProps = TableRowProps & {
  colSpan: number;
};

export function TableNoData({ colSpan, ...other }: TableNoDataProps) {
    const { t } = useTranslation();

    return (
        <TableRow {...other}>
            <TableCell align="center" colSpan={colSpan + 1}>
                <Box sx={{py: 15, textAlign: 'center', width: '100%'}}>
                    <Typography variant="h6" sx={{mb: 1}}>
                        {t('table.noDataTitle')}
                    </Typography>

                    <Typography variant="body2" whiteSpace="pre-line">
                        {t('table.noDataMessage')}
                    </Typography>
                </Box>
            </TableCell>
        </TableRow>
    );
}
