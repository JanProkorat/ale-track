import type {
     OutgoingShipmentState,
     OutgoingShipmentListItemDto,

     OutgoingShipmentStopAddressKind} from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import SaveIcon from '@mui/icons-material/Save';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import Autocomplete from '@mui/material/Autocomplete';
import RestoreIcon from '@mui/icons-material/Restore';
import CircularProgress from '@mui/material/CircularProgress';

import {
     useOutgoingShipment,
     useUpdateOutgoingShipment,
     useDeleteOutgoingShipment,
} from 'src/hooks/useOutgoingShipments';

import { useEnumLabel } from 'src/utils/enumTranslations';

import {
     OrderItemInfoDto,
     ExtraShipmentDto,
     ClientOrderShipmentDto,
     UpdateOutgoingShipmentDto
} from 'src/generated/api-client';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import ShipmentInlineForm from './ShipmentInlineForm';

import type { OutgoingShipmentFormValues } from '../outgoingShipmentFormSchema';
import type { FormHeaderState, ShipmentSubmitExtra, ShipmentInlineFormHandle } from './ShipmentInlineForm';

// ---------------------------------------------------------------------------

interface ShipmentInlineDetailProps {
     shipmentId: string | null;
     shipments: OutgoingShipmentListItemDto[];
     shipmentsLoading: boolean;
     onSelect: (id: string | null) => void;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function ShipmentInlineDetail({
     shipmentId,
     shipments,
     shipmentsLoading,
     onSelect,
     onDeleted,
     onDirtyChange,
}: ShipmentInlineDetailProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const { data: shipment, isLoading } = useOutgoingShipment(shipmentId ?? '');
     const updateMutation = useUpdateOutgoingShipment();
     const deleteMutation = useDeleteOutgoingShipment();

     const formRef = useRef<ShipmentInlineFormHandle>(null);
     const [deleteOpen, setDeleteOpen] = useState(false);
     const [headerState, setHeaderState] = useState<FormHeaderState>({
          isDirty: false,
          name: '',
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

     const displayState = shipmentId
          ? headerState.state || (shipment?.state as unknown as string) || ''
          : '';

     // -- Shipment select (always visible in header) --
     const selectedListItem = shipments.find((s) => s.id === shipmentId) ?? null;

     const shipmentSelect = (
          <Autocomplete
               options={shipments}
               getOptionLabel={(opt) =>
                    `${opt.name ?? ''} — ${opt.deliveryDate ? new Date(opt.deliveryDate).toLocaleDateString() : ''}`
               }
               loading={shipmentsLoading}
               value={selectedListItem}
               onChange={(_e, newValue) => onSelect(newValue?.id ?? null)}
               isOptionEqualToValue={(opt, val) => opt.id === val.id}
               size="small"
               sx={{ minWidth: 280, maxWidth: 400, flex: 1 }}
               renderInput={(params) => (
                    <TextField
                         {...params}
                         placeholder={t('outgoingShipments.selectShipment')}
                    />
               )}
          />
     );

     // -- Header row: select + state chip + action buttons --
     const header = (
          <Stack direction="row" alignItems="center" sx={{ mb: 2 }} spacing={1} flexWrap="wrap">
               {shipmentSelect}

               {displayState && (
                    <Chip
                         label={enumLabel.outgoingShipmentState(displayState)}
                         size="small"
                         variant="outlined"
                    />
               )}

               <Box sx={{ flex: 1 }} />

               {shipmentId && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                         <Tooltip title={t('common.cancel')}>
                              <span>
                                   <IconButton size="small" onClick={() => formRef.current?.resetForm()} color="primary" disabled={!isDirty}>
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
               )}
          </Stack>
     );

     // -- Body --
     if (!shipmentId) {
          return (
               <Box>
                    {header}
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                         {t('outgoingShipments.selectShipment')}
                    </Typography>
               </Box>
          );
     }

     if (isLoading) {
          return (
               <Box>
                    {header}
                    <LoadingSpinner />
               </Box>
          );
     }

     if (!shipment) return <Box>{header}</Box>;

     const handleSave = (data: OutgoingShipmentFormValues, extra: ShipmentSubmitExtra) => {
          const { confirmedProductIds, extraPiecesMap, availableOrders, extraProducts } = extra;
          // Build a lookup for custom product names
          const customNameMap = new Map(
               extraProducts.filter((ep) => ep.isCustom).map((ep) => [ep.productId, ep.name]),
          );
          const dto = new UpdateOutgoingShipmentDto();
          dto.name = data.name;
          dto.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : undefined;
          dto.state = data.state as unknown as OutgoingShipmentState;
          dto.vehicleId = data.vehicleId || undefined;
          dto.driverIds = data.driverIds;
          dto.clientOrderShipments = data.clientOrderShipments
               .filter((s) => s.clientOrderId)
               .map((s, i) => {
                    const stopDto = new ClientOrderShipmentDto();
                    stopDto.clientOrderId = s.clientOrderId;
                    stopDto.order = s.order ?? (i + 1);
                    stopDto.selectedAddressKind =
                         s.selectedAddressKind as unknown as OutgoingShipmentStopAddressKind;

                    // Map loading confirmations per order item
                    const order = availableOrders.find((o) => o.id === s.clientOrderId);
                    if (order?.items) {
                         stopDto.orderItems = order.items
                              .filter((item) => item.orderItemId)
                              .map((item) => {
                                   const itemDto = new OrderItemInfoDto();
                                   itemDto.orderItemId = item.orderItemId;
                                   itemDto.isLoadingConfirmed = confirmedProductIds.has(item.productId ?? '');
                                   return itemDto;
                              });
                    }

                    return stopDto;
               });

          // Map extra pieces to ExtraShipmentDto[]
          dto.extraShipments = Object.entries(extraPiecesMap)
               .filter(([, val]) => val !== '' && Number(val) > 0)
               .map(([productId, val]) => {
                    const extraDto = new ExtraShipmentDto();
                    extraDto.quantity = Number(val);
                    const customName = customNameMap.get(productId);
                    if (customName) {
                         // Custom product — send name only, no productId
                         extraDto.productName = customName;
                    } else {
                         extraDto.productId = productId;
                    }
                    extraDto.isLoadingConfirmed = confirmedProductIds.has(productId);
                    return extraDto;
               });

          updateMutation.mutate({ id: shipmentId, data: dto });
     };

     return (
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
               {header}

               <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <ShipmentInlineForm
                         ref={formRef}
                         shipment={shipment}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('outgoingShipments.deleteConfirm')}
                    onConfirm={() => {
                         deleteMutation.mutate(shipmentId, {
                              onSuccess: () => {
                                   setDeleteOpen(false);
                                   onDeleted();
                              },
                         });
                    }}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
