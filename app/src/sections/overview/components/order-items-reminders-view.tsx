import { useTranslation } from 'react-i18next';
import { varAlpha } from 'minimal-shared/utils';
import React, { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import { EventNote } from '@mui/icons-material';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Card, IconButton, CardContent, ListItemIcon } from '@mui/material';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

import { useRouter } from '../../../routes/hooks';
import { formatDate } from '../../../locales/formatDate';
import { Scrollbar } from '../../../components/scrollbar';
import { AuthorizedClient } from '../../../api/AuthorizedClient';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { SectionHeader } from '../../../components/label/section-header';

import type { ClientOrderReminderDto } from '../../../api/Client';

export function OrderItemsRemindersView() {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [clientOrderReminder, setClientOrderReminder] = useState<ClientOrderReminderDto[]>([]);

  const fetchReminders = useCallback(async () => {
    try {
      const client = new AuthorizedClient();
      return await client.fetchOrderItemsRemindersOverview();
    } catch (error) {
      showSnackbar(t('clientOrders.fetchError'), 'error');
      console.error('Error fetching order items clientOrders:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, t]);

  useEffect(() => {
    fetchReminders().then(setClientOrderReminder);
  }, [fetchReminders]);

  return (
    <Card sx={{ minHeight: 400, maxHeight: 700 }}>
      <CardContent sx={{ height: '100%' }}>
        <SectionHeader text={t('orderItemReminders.title')} headerVariant="h6" />
        {loading ? (
          <Box
            sx={{ minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <LinearProgress
              sx={{
                width: '50%',
                bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
              }}
            />
          </Box>
        ) : (
          <Scrollbar sx={{ minHeight: 400, ml: 1, mr: 1 }}>
            <Box sx={{ mt: 2 }}>
              {clientOrderReminder.length === 0 && (
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', textAlign: 'center', mt: 2 }}
                >
                  {t('clientOrders.noUpcomingReminders')}
                </Typography>
              )}
              {clientOrderReminder.length > 0 &&
                clientOrderReminder.map((section) => (
                  <Box key={section.clientId} sx={{ mb: 1 }}>
                    <SectionHeader
                      text={section.clientName ?? ''}
                      headerVariant="subtitle1"
                      bottomLineVisible={false}
                    >
                      <IconButton
                        onClick={() => router.push(`/clients/${section.clientId}`)}
                        sx={{ ml: 1 }}
                        size="small"
                        color="inherit"
                      >
                        <OpenInNewIcon />
                      </IconButton>
                    </SectionHeader>
                    <List sx={{ listStyleType: 'disc', pl: 2 }}>
                      {(section.orderItems ?? []).map((reminder) => (
                        <ListItem
                          key={`${reminder.orderId}-${reminder.productId}}`}
                          sx={{
                            py: 0,
                            pl: 0,
                          }}
                          secondaryAction={
                            <IconButton
                              onClick={() => router.push(`/orders/${reminder.orderId}`)}
                              sx={{ ml: 2}}
                              size="small"
                              color="inherit"
                            >
                              <OpenInNewIcon sx={{fontSize: 19}}/>
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            <EventNote color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body1">
                                <strong>{`${reminder.productName} ${reminder.packageSize}L - ${reminder.quantity}x`}</strong>
                              </Typography>
                            }
                            secondary={
                              reminder.deliveryDate != undefined
                                ? `${t('common.until')}: ${formatDate(reminder.deliveryDate)}`
                                : undefined
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
            </Box>
          </Scrollbar>
        )}
      </CardContent>
    </Card>
  );
}
