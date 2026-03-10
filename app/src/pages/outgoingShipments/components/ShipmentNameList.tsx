import type { Column } from 'src/components/common/DataTable';
import type { OutgoingShipmentListItemDto } from 'src/generated/api-client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';

import { useEnumLabel } from 'src/utils/enumTranslations';

import DataTable from 'src/components/common/DataTable';

// ---------------------------------------------------------------------------

interface ShipmentNameListProps {
     shipments: OutgoingShipmentListItemDto[];
     loading: boolean;
     selectedId: string | null;
     onSelect: (id: string) => void;
}

export default function ShipmentNameList({
     shipments,
     loading,
     selectedId,
     onSelect,
}: ShipmentNameListProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const columns: Column<OutgoingShipmentListItemDto>[] = useMemo(
          () => [
               {
                    id: 'name',
                    label: t('outgoingShipments.name'),
                    render: (row) => (
                         <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                              {row.name || '-'}
                         </Box>
                    ),
               },
               {
                    id: 'state',
                    label: t('outgoingShipments.state'),
                    render: (row) =>
                         row.state != null ? (
                              <Chip label={enumLabel.outgoingShipmentState(row.state)} size="small" variant="outlined" />
                         ) : null,
               },
               {
                    id: 'deliveryDate',
                    label: t('outgoingShipments.deliveryDate'),
                    width: 90,
                    render: (row) => (
                         <Box sx={{ whiteSpace: 'nowrap' }}>
                              {row.deliveryDate
                                   ? new Date(row.deliveryDate).toLocaleDateString()
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
                    rows={shipments}
                    getId={(row) => row.id ?? ''}
                    loading={loading}
                    selectedId={selectedId}
                    onRowClick={(row) => row.id && onSelect(row.id)}
               />
          </Card>
     );
}
