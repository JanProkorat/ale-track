import { useTranslation } from 'react-i18next';

import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from '../../components/iconify';
import { TableToolbar } from '../../components/table/table-toolbar';

type OrdersToolbarProps = {
     numSelected: number;
     filterClientName: string | null;
     onFilterClientName: (newName: string | null) => void;
};

export function OrdersTableToolbar({
     numSelected,
     filterClientName,
     onFilterClientName,
}: Readonly<OrdersToolbarProps>) {
     const { t } = useTranslation();

     const filters = [
          <OutlinedInput
               key="client"
               fullWidth
               value={filterClientName}
               onChange={(event) => onFilterClientName(event.target.value)}
               placeholder={t('orders.clientName') + `...`}
               startAdornment={
                    <InputAdornment position="start">
                         <Iconify width={20} icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
               }
          />,
     ];

     return <TableToolbar numSelected={numSelected} filters={filters} />;
}
