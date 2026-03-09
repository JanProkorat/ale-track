import type { OrderListItemDto } from 'src/generated/api-client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';

import { useEnumLabel } from 'src/utils/enumTranslations';

import DataTable from 'src/components/common/DataTable';

import type { Column } from 'src/components/common/DataTable';

// ---------------------------------------------------------------------------

interface OrderNameListProps {
     orders: OrderListItemDto[];
     loading: boolean;
     selectedId: string | null;
     onSelect: (id: string) => void;
}

export default function OrderNameList({
     orders,
     loading,
     selectedId,
     onSelect,
}: OrderNameListProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const columns: Column<OrderListItemDto>[] = useMemo(
          () => [
               {
                    id: 'clientName',
                    label: t('orders.client'),
                    render: (row) => (
                         <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                              {row.clientName}
                         </Box>
                    ),
               },
               {
                    id: 'state',
                    label: t('orders.state'),
                    render: (row) =>
                         row.state != null ? (
                              <Chip label={enumLabel.orderState(row.state)} size="small" variant="outlined" />
                         ) : null,
               },
               {
                    id: 'requiredDeliveryDate',
                    label: t('orders.requiredDeliveryDateShort'),
                    width: 90,
                    render: (row) => (
                         <Box sx={{ whiteSpace: 'nowrap' }}>
                              {row.requiredDeliveryDate
                                   ? new Date(row.requiredDeliveryDate).toLocaleDateString()
                                   : '-'}
                         </Box>
                    ),
               },
          ],
          [t, enumLabel],
     );

     return (
          <Card sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
               <DataTable
                    columns={columns}
                    rows={orders}
                    getId={(row) => row.id ?? ''}
                    loading={loading}
                    selectedId={selectedId}
                    onRowClick={(row) => row.id && onSelect(row.id)}
               />
          </Card>
     );
}
