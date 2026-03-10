import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

import { OutgoingShipmentState } from 'src/generated/api-client';
import { useOutgoingShipments } from 'src/hooks/useOutgoingShipments';
import { useEnumLabel } from 'src/utils/enumTranslations';
import SectionCard from 'src/components/common/SectionCard';
import StatusChip from 'src/components/common/StatusChip';
import LoadingSpinner from 'src/components/common/LoadingSpinner';
import EmptyState from 'src/components/common/EmptyState';

function shipmentStateColor(state?: OutgoingShipmentState): 'info' | 'warning' | 'success' | 'default' {
     switch (state) {
          case OutgoingShipmentState.Created:
               return 'info';
          case OutgoingShipmentState.Loaded:
               return 'warning';
          case OutgoingShipmentState.InTransit:
               return 'warning';
          default:
               return 'default';
     }
}

export default function ActiveShipments() {
     const { t } = useTranslation();
     const { data: shipments = [], isLoading } = useOutgoingShipments();
     const { outgoingShipmentState } = useEnumLabel();
     const navigate = useNavigate();

     const active = useMemo(
          () =>
               shipments.filter((s) => {
                    const state = String(s.state);
                    return state !== String(OutgoingShipmentState.Delivered) &&
                         state !== 'Delivered' &&
                         state !== String(OutgoingShipmentState.Cancelled) &&
                         state !== 'Cancelled';
               }),
          [shipments],
     );

     return (
          <SectionCard title={t('dashboard.activeShipments')}>
               {isLoading ? (
                    <LoadingSpinner />
               ) : active.length === 0 ? (
                    <EmptyState />
               ) : (
                    <List dense disablePadding>
                         {active.map((s) => (
                              <ListItemButton
                                   key={s.id}
                                   onClick={() => navigate(`/outgoing-shipments?id=${s.id}`)}
                                   sx={{ borderRadius: 1 }}
                              >
                                   <ListItemText
                                        primary={s.name}
                                        secondary={
                                             s.deliveryDate
                                                  ? new Date(s.deliveryDate).toLocaleDateString()
                                                  : undefined
                                        }
                                   />
                                   <StatusChip
                                        label={outgoingShipmentState(s.state!)}
                                        color={shipmentStateColor(s.state)}
                                   />
                              </ListItemButton>
                         ))}
                    </List>
               )}
          </SectionCard>
     );
}
