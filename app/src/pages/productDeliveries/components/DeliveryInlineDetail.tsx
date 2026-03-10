import type { ProductDeliveryState } from 'src/generated/api-client';

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

import {
     useProductDelivery,
     useUpdateProductDelivery,
     useDeleteProductDelivery,
} from 'src/hooks/useProductDeliveries';

import { useEnumLabel } from 'src/utils/enumTranslations';

import {
     UpdateProductDeliveryDto,
     UpdateProductDeliveryStopDto,
     UpdateProductDeliveryItemDto,
} from 'src/generated/api-client';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import DeliveryInlineForm from './DeliveryInlineForm';

import type { ProductDeliveryFormValues } from '../productDeliveryFormSchema';
import type { FormHeaderState, DeliveryInlineFormHandle } from './DeliveryInlineForm';

// ---------------------------------------------------------------------------

interface DeliveryInlineDetailProps {
     deliveryId: string | null;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function DeliveryInlineDetail({
     deliveryId,
     onDeleted,
     onDirtyChange,
}: DeliveryInlineDetailProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const { data: delivery, isLoading } = useProductDelivery(deliveryId ?? '');
     const updateMutation = useUpdateProductDelivery();
     const deleteMutation = useDeleteProductDelivery();

     const formRef = useRef<DeliveryInlineFormHandle>(null);
     const [deleteOpen, setDeleteOpen] = useState(false);
     const [headerState, setHeaderState] = useState<FormHeaderState>({
          isDirty: false,
          deliveryDate: '',
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

     if (!deliveryId) {
          return (
               <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    {t('productDeliveries.selectDelivery')}
               </Typography>
          );
     }

     if (isLoading) {
          return <LoadingSpinner />;
     }

     if (!delivery) return null;

     const handleSave = (data: ProductDeliveryFormValues) => {
          const dto = new UpdateProductDeliveryDto();
          dto.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : new Date();
          dto.state = data.state as unknown as ProductDeliveryState;
          dto.driverIds = data.driverIds;
          dto.vehicleId = data.vehicleId || undefined;
          dto.note = data.note || undefined;
          dto.stops = data.stops.map((stop) => {
               const stopDto = new UpdateProductDeliveryStopDto();
               stopDto.publicId = stop.publicId || undefined;
               stopDto.breweryId = stop.breweryId;
               stopDto.note = stop.note || undefined;
               stopDto.products = stop.products.map((p) => {
                    const itemDto = new UpdateProductDeliveryItemDto();
                    itemDto.productId = p.productId;
                    itemDto.quantity = p.quantity;
                    itemDto.note = p.note || undefined;
                    return itemDto;
               });
               return stopDto;
          });

          updateMutation.mutate({ id: deliveryId, data: dto });
     };

     const handleDelete = () => {
          deleteMutation.mutate(deliveryId, {
               onSuccess: () => {
                    setDeleteOpen(false);
                    onDeleted();
               },
          });
     };

     const handleReset = () => {
          formRef.current?.resetForm();
     };

     const displayState = headerState.state || (delivery.state as unknown as string);
     const displayDate = headerState.deliveryDate || (delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString() : '');

     return (
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
               {/* Header */}
               <Stack direction="row" alignItems="flex-start" sx={{ mb: 2 }} spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                         <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="h6" noWrap>
                                   {displayDate
                                        ? `${t('productDeliveries.deliveryDate')}: ${headerState.deliveryDate ? new Date(headerState.deliveryDate).toLocaleDateString() : new Date(delivery.deliveryDate!).toLocaleDateString()}`
                                        : t('productDeliveries.title')}
                              </Typography>
                              {displayState && (
                                   <Chip
                                        label={enumLabel.productDeliveryState(displayState)}
                                        size="small"
                                        variant="outlined"
                                   />
                              )}
                         </Stack>
                         {delivery.vehicle?.name && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                   {delivery.vehicle.name}
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
                    <DeliveryInlineForm
                         ref={formRef}
                         delivery={delivery}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('productDeliveries.deleteConfirm')}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
