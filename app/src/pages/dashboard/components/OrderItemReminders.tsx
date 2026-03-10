import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { useOrderItemReminders } from 'src/hooks/useOrderItemReminders';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

function formatDate(date: Date | undefined | null): string {
     if (!date) return '';
     return new Date(date).toLocaleDateString();
}

export default function OrderItemReminders() {
     const { t } = useTranslation();
     const { data = [], isLoading } = useOrderItemReminders();
     const navigate = useNavigate();

     return (
          <SectionCard title={t('reminders.orderItemReminders')}>
               {isLoading ? (
                    <LoadingSpinner />
               ) : data.length === 0 ? (
                    <EmptyState />
               ) : (
                    <Box>
                         {data.map((client) => (
                              <Box key={client.clientId} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                                   <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                        {client.clientName}
                                   </Typography>
                                   <List dense disablePadding>
                                        {client.orderItems?.map((item, idx) => (
                                             <ListItemButton
                                                  key={`${item.orderId}-${item.productId}-${idx}`}
                                                  onClick={() => navigate(`/orders?id=${item.orderId}`)}
                                                  sx={{ borderRadius: 1, py: 0.5 }}
                                             >
                                                  <ListItemText
                                                       primary={item.productName}
                                                       secondary={
                                                            [
                                                                 item.packageSize != null ? `${item.packageSize}L` : null,
                                                                 `${t('orders.quantity')}: ${item.quantity}`,
                                                            ]
                                                                 .filter(Boolean)
                                                                 .join(' · ')
                                                       }
                                                  />
                                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 1 }}>
                                                       {formatDate(item.deliveryDate)}
                                                  </Typography>
                                             </ListItemButton>
                                        ))}
                                   </List>
                              </Box>
                         ))}
                    </Box>
               )}
          </SectionCard>
     );
}
