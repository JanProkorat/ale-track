import type {
     OrderState,
     OrderItemReminderState} from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import SaveIcon from '@mui/icons-material/Save';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import CircularProgress from '@mui/material/CircularProgress';

import { useOrder, useUpdateOrder, useDeleteOrder } from 'src/hooks/useOrders';

import { useEnumLabel } from 'src/utils/enumTranslations';

import {
     UpdateOrderDto,
     UpdateOrderItemDto
} from 'src/generated/api-client';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import OrderInlineForm from './OrderInlineForm';

import type { OrderFormValues } from '../orderFormSchema';
import type { FormHeaderState, OrderInlineFormHandle } from './OrderInlineForm';

// ---------------------------------------------------------------------------

interface OrderInlineDetailProps {
     orderId: string | null;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function OrderInlineDetail({ orderId, onDeleted, onDirtyChange }: OrderInlineDetailProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const { data: order, isLoading } = useOrder(orderId ?? '');
     const updateMutation = useUpdateOrder();
     const deleteMutation = useDeleteOrder();

     const formRef = useRef<OrderInlineFormHandle>(null);
     const [deleteOpen, setDeleteOpen] = useState(false);
     const [headerState, setHeaderState] = useState<FormHeaderState>({
          isDirty: false,
          clientName: '',
          state: '',
     });

     const handleFormStateChange = useCallback((state: FormHeaderState) => {
          setHeaderState(state);
     }, []);

     // Ctrl+S / Cmd+S to save
     const handleKeyDown = useCallback(
          (e: KeyboardEvent) => {
               if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    formRef.current?.submit();
               }
          },
          [],
     );

     useEffect(() => {
          window.addEventListener('keydown', handleKeyDown);
          return () => window.removeEventListener('keydown', handleKeyDown);
     }, [handleKeyDown]);

     const { isDirty } = headerState;

     useEffect(() => {
          onDirtyChange?.(isDirty);
     }, [isDirty, onDirtyChange]);

     // No order selected
     if (!orderId) {
          return (
               <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    {t('orders.selectOrder')}
               </Typography>
          );
     }

     if (isLoading) {
          return <LoadingSpinner />;
     }

     if (!order) return null;

     const handleSave = (data: OrderFormValues) => {
          const dto = new UpdateOrderDto();
          dto.clientId = data.clientId;
          dto.state = data.state as unknown as OrderState;
          dto.requiredDeliveryDate = data.requiredDeliveryDate
               ? new Date(data.requiredDeliveryDate)
               : undefined;
          dto.actualDeliveryDate = data.actualDeliveryDate
               ? new Date(data.actualDeliveryDate)
               : undefined;
          dto.orderItems = data.orderItems.map((item) => {
               const itemDto = new UpdateOrderItemDto();
               itemDto.productId = item.productId;
               itemDto.quantity = item.quantity;
               itemDto.reminderState = item.reminderState
                    ? (item.reminderState as unknown as OrderItemReminderState)
                    : undefined;
               return itemDto;
          });

          updateMutation.mutate({ id: orderId, data: dto });
     };

     const handleDelete = () => {
          deleteMutation.mutate(orderId, {
               onSuccess: () => {
                    setDeleteOpen(false);
                    onDeleted();
               },
          });
     };

     const handleReset = () => {
          formRef.current?.resetForm();
     };

     const displayClientName = headerState.clientName || order.client?.name || '';
     const displayState = headerState.state || (order.state as unknown as string);

     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
               }}
          >
               {/* Header */}
               <Stack direction="row" alignItems="flex-start" sx={{ mb: 2 }} spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                         <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="h6" noWrap>
                                   {displayClientName}
                              </Typography>
                              {displayState && (
                                   <Chip
                                        label={enumLabel.orderState(displayState)}
                                        size="small"
                                        variant="outlined"
                                   />
                              )}
                         </Stack>
                         {order.requiredDeliveryDate && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                   {t('orders.requiredDeliveryDate')}: {new Date(order.requiredDeliveryDate).toLocaleDateString()}
                              </Typography>
                         )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                         <Tooltip title={t('common.cancel')}>
                              <span>
                                   <IconButton size="small" onClick={handleReset} color="primary" disabled={!isDirty}>
                                        <RestoreIcon fontSize="small" />
                                   </IconButton>
                              </span>
                         </Tooltip>

                         <Tooltip title={t('common.save')}>
                              <span>
                                   <IconButton
                                        size="small"
                                        onClick={() => formRef.current?.submit()}
                                        disabled={!isDirty || updateMutation.isPending}
                                        color="primary"
                                        sx={{ position: 'relative' }}
                                   >
                                        {updateMutation.isPending ? (
                                             <CircularProgress size={18} />
                                        ) : (
                                             <SaveIcon fontSize="small" />
                                        )}
                                        {isDirty && !updateMutation.isPending && (
                                             <Box
                                                  sx={{
                                                       position: 'absolute',
                                                       top: 2,
                                                       right: 2,
                                                       width: 8,
                                                       height: 8,
                                                       borderRadius: '50%',
                                                       bgcolor: 'warning.main',
                                                  }}
                                             />
                                        )}
                                   </IconButton>
                              </span>
                         </Tooltip>

                         <Tooltip title={t('common.delete')}>
                              <IconButton
                                   size="small"
                                   onClick={() => setDeleteOpen(true)}
                                   color="error"
                              >
                                   <DeleteIcon fontSize="small" />
                              </IconButton>
                         </Tooltip>
                    </Box>
               </Stack>

               {/* Inline form */}
               <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <OrderInlineForm
                         ref={formRef}
                         order={order}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('orders.deleteConfirm')}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
