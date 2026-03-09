import type { ProductDeliveryListItemDto } from 'src/generated/api-client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';

import { useEnumLabel } from 'src/utils/enumTranslations';

import DataTable from 'src/components/common/DataTable';

import type { Column } from 'src/components/common/DataTable';

// ---------------------------------------------------------------------------

interface DeliveryNameListProps {
     deliveries: ProductDeliveryListItemDto[];
     loading: boolean;
     selectedId: string | null;
     onSelect: (id: string) => void;
}

export default function DeliveryNameList({
     deliveries,
     loading,
     selectedId,
     onSelect,
}: DeliveryNameListProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const columns: Column<ProductDeliveryListItemDto>[] = useMemo(
          () => [
               {
                    id: 'deliveryDate',
                    label: t('productDeliveries.deliveryDate'),
                    width: 100,
                    render: (row) => (
                         <Box sx={{ whiteSpace: 'nowrap' }}>
                              {row.deliveryDate
                                   ? new Date(row.deliveryDate).toLocaleDateString()
                                   : '-'}
                         </Box>
                    ),
               },
               {
                    id: 'stops',
                    label: t('productDeliveries.stops'),
                    render: (row) => (
                         <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                              {(row.stopNames ?? []).join(', ') || '-'}
                         </Box>
                    ),
               },
               {
                    id: 'state',
                    label: t('productDeliveries.state'),
                    render: (row) =>
                         row.state != null ? (
                              <Chip label={enumLabel.productDeliveryState(row.state)} size="small" variant="outlined" />
                         ) : null,
               },
          ],
          [t, enumLabel],
     );

     return (
          <Card sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
               <DataTable
                    columns={columns}
                    rows={deliveries}
                    getId={(row) => row.id ?? ''}
                    loading={loading}
                    selectedId={selectedId}
                    onRowClick={(row) => row.id && onSelect(row.id)}
               />
          </Card>
     );
}
