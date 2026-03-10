import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

import { ProductDeliveryState } from 'src/generated/api-client';
import { useProductDeliveries } from 'src/hooks/useProductDeliveries';
import { useEnumLabel } from 'src/utils/enumTranslations';
import SectionCard from 'src/components/common/SectionCard';
import StatusChip from 'src/components/common/StatusChip';
import LoadingSpinner from 'src/components/common/LoadingSpinner';
import EmptyState from 'src/components/common/EmptyState';

function deliveryStateColor(state?: ProductDeliveryState): 'info' | 'warning' | 'success' | 'default' {
     switch (state) {
          case ProductDeliveryState.InPlanning:
               return 'info';
          case ProductDeliveryState.OnTheWay:
               return 'warning';
          default:
               return 'default';
     }
}

export default function ActiveDeliveries() {
     const { t } = useTranslation();
     const { data: deliveries = [], isLoading } = useProductDeliveries();
     const { productDeliveryState } = useEnumLabel();
     const navigate = useNavigate();

     const active = useMemo(
          () =>
               deliveries.filter((d) => {
                    const state = String(d.state);
                    return state !== String(ProductDeliveryState.Finished) &&
                         state !== 'Finished' &&
                         state !== String(ProductDeliveryState.Cancelled) &&
                         state !== 'Cancelled';
               }),
          [deliveries],
     );

     return (
          <SectionCard title={t('dashboard.activeDeliveries')}>
               {isLoading ? (
                    <LoadingSpinner />
               ) : active.length === 0 ? (
                    <EmptyState />
               ) : (
                    <List dense disablePadding>
                         {active.map((d) => (
                              <ListItemButton
                                   key={d.id}
                                   onClick={() => navigate(`/product-deliveries?id=${d.id}`)}
                                   sx={{ borderRadius: 1 }}
                              >
                                   <ListItemText
                                        primary={d.stopNames?.join(', ') || '—'}
                                        secondary={
                                             d.deliveryDate
                                                  ? new Date(d.deliveryDate).toLocaleDateString()
                                                  : undefined
                                        }
                                   />
                                   <StatusChip
                                        label={productDeliveryState(d.state!)}
                                        color={deliveryStateColor(d.state)}
                                   />
                              </ListItemButton>
                         ))}
                    </List>
               )}
          </SectionCard>
     );
}
