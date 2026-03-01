import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';

import Drawer from '@mui/material/Drawer';
import { linearProgressClasses } from '@mui/material/LinearProgress';
import { Box, Card, Button, IconButton, Typography, LinearProgress } from '@mui/material';

import { mapEnumValue } from 'src/utils/format-enum-value';

import { ResetConfirmationDialog } from 'src/components/dialogs/reset-confirmation-dialog';
import { DeleteConfirmationDialog } from 'src/components/dialogs/delete-confirmation-dialog';
import { PendingChangesConfirmationDialog } from 'src/components/dialogs/pending-changes-confirmation-dialog';

import { Iconify } from '../../../components/iconify';
import { useApiCall } from '../../../hooks/use-api-call';
import { DashboardContent } from '../../../layouts/dashboard';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { useAuthorizedClient } from '../../../api/use-authorized-client';
import { SectionHeader } from '../../../components/label/section-header';
import { OutgoingShipmentSelect } from '../components/outgoing-shipment-select';
import { CreateOutgoingShipmentView } from '../detail-view/create-outgoing-shipment-view';
import { OutgoingShipmentDetailView } from '../detail-view/outgoing-shipment-detail-view';
import {
     type DriverDto,
     type VehicleDto,
     OutgoingShipmentState,
     ClientOrderShipmentDto,
     UpdateOutgoingShipmentDto,
     type OutgoingShipmentOrderDto,
     type OutgoingShipmentListItemDto,
} from '../../../api/Client';

export function OutgoingShipmentsView() {
     const { t } = useTranslation();
     const { showSnackbar } = useSnackbar();
     const { executeApiCall, executeApiCallWithDefault } = useApiCall();
     const client = useAuthorizedClient();

     const [initialLoading, setInitialLoading] = useState<boolean>(false);
     const [outgoingShipments, setOutgoingShipments] = useState<OutgoingShipmentListItemDto[]>([]);
     const [selectedShipmentId, setSelectedShipmentId] = useState<string | undefined>(undefined);
     const [pendingShipmentId, setPendingShipmentId] = useState<string | null>(null);
     const [createShipmentDrawerVisible, setCreateShipmentDrawerVisible] = useState<boolean>(false);
     const [isPendingChangesDialogOpen, setIsPendingChangesDialogOpen] = useState<boolean>(false);
     const [isResetDialogVisible, setIsResetDialogVisible] = useState<boolean>(false);
     const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);

     const [drivers, setDrivers] = useState<DriverDto[]>([]);
     const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
     const [orders, setOrders] = useState<OutgoingShipmentOrderDto[]>([]);

     const [currentShipment, setCurrentShipment] = useState<UpdateOutgoingShipmentDto | undefined>(undefined);
     const [currentInitialShipment, setCurrentInitialShipment] = useState<UpdateOutgoingShipmentDto | undefined>(
          undefined
     );

     const hasDetailChanges = JSON.stringify(currentShipment) !== JSON.stringify(currentInitialShipment);
     const [errors, setErrors] = useState<Record<string, string>>({});

     const blocker = useBlocker(
          ({ currentLocation, nextLocation }) =>
               !!hasDetailChanges && currentLocation.pathname !== nextLocation.pathname
     );

     useEffect(() => {
          if (blocker.state === 'blocked') {
               setIsPendingChangesDialogOpen(true);
          }
     }, [blocker.state]);

     const fetchOutgoingShipments = useCallback(
          async () => await executeApiCallWithDefault(() => client.fetchOutgoingShipments({}), []),
          [client, executeApiCallWithDefault]
     );

     const fetchShipment = useCallback(
          async (shipmentId: string) => {
               const data = await executeApiCall(() => client.getOutgoingShipmentDetailEndpoint(shipmentId));

               if (data) {
                    const updateRequest = new UpdateOutgoingShipmentDto({
                         name: data.name!,
                         deliveryDate: data.deliveryDate!,
                         state: data.state!,
                         vehicleId: data.vehicleId!,
                         driverIds: data.driverIds!,
                         clientOrderShipments: (data.stops ?? []).map(
                              (stop) =>
                                   new ClientOrderShipmentDto({
                                        order: stop.order!,
                                        clientOrderId: stop.orderId!,
                                        selectedAddressKind: stop.selectedAddressKind!,
                                   })
                         ),
                    });
                    setCurrentShipment(updateRequest);
                    setCurrentInitialShipment(updateRequest);
               }
          },
          [client, executeApiCall]
     );

     useEffect(() => {
          setInitialLoading(true);
          const loadInitial = async () => {
               const loaded = await fetchOutgoingShipments();
               setOutgoingShipments(loaded);
               const firstId = loaded.length > 0 ? loaded[0].id : undefined;
               setSelectedShipmentId(firstId);
               if (firstId) {
                    await fetchShipment(firstId);
               }
               setInitialLoading(false);
          };
          void loadInitial();
     }, [fetchOutgoingShipments, fetchShipment]);

     useEffect(() => {
          const refetchShipments = async () => {
               const loaded = await fetchOutgoingShipments();
               setOutgoingShipments(loaded);
               const firstId = loaded.length > 0 ? loaded[0].id : undefined;
               setSelectedShipmentId(firstId);
               if (firstId) {
                    await fetchShipment(firstId);
               }
          };
          void refetchShipments();
     }, [fetchOutgoingShipments, fetchShipment]);

     const fetchOrders = useCallback(
          async (shipmentId: string) => {
               const fetchedOrders = await executeApiCall(() => client.fetOrdersForOutgoingShipments(shipmentId, {}));

               if (fetchedOrders) {
                    setOrders(fetchedOrders);
               }
          },
          [client, executeApiCall]
     );

     useEffect(() => {
          if (selectedShipmentId) {
               void fetchOrders(selectedShipmentId);
               void fetchShipment(selectedShipmentId);
          }
     }, [selectedShipmentId, fetchShipment, fetchOrders]);

     const fetchMultiselectData = useCallback(async () => {
          const [driversData, vehiclesData] = await Promise.all([
               executeApiCallWithDefault(() => client.fetchDrivers({}), []),
               executeApiCallWithDefault(() => client.fetchVehicles({}), []),
          ]);

          setDrivers(driversData);
          setVehicles(vehiclesData);
     }, [client, executeApiCallWithDefault]);

     useEffect(() => {
          void fetchMultiselectData();
     }, [fetchMultiselectData]);

     const handleRowClick = (id: string) => {
          if (selectedShipmentId === id) return;

          if (hasDetailChanges) {
               setPendingShipmentId(id);
               setIsPendingChangesDialogOpen(true);
          } else {
               setSelectedShipmentId(id);
          }
     };

     const handleReset = useCallback(() => {
          setCurrentShipment(currentInitialShipment);
          setIsResetDialogVisible(false);
     }, [currentInitialShipment]);

     const saveCurrentShipment = async (): Promise<boolean> => {
          if (!selectedShipmentId || !currentShipment) {
               return false;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const deliveryDate = currentShipment.deliveryDate ? new Date(currentShipment.deliveryDate) : undefined;
          deliveryDate?.setHours(0, 0, 0, 0);

          const formattedState = mapEnumValue(OutgoingShipmentState, currentShipment.state);
          if (formattedState === OutgoingShipmentState.Loaded && currentShipment.clientOrderShipments.length == 0) {
               showSnackbar(t('common.validationError'), 'error');
               setErrors({ orders: t('common.required') });
               return false;
          }

          if (
               formattedState !== OutgoingShipmentState.Created &&
               formattedState !== OutgoingShipmentState.Loaded &&
               formattedState !== OutgoingShipmentState.Cancelled &&
               (deliveryDate === undefined ||
                    deliveryDate < today ||
                    currentShipment.vehicleId == undefined ||
                    currentShipment.driverIds?.length == 0 ||
                    currentShipment.clientOrderShipments.length == 0)
          ) {
               const validationErrors: Record<string, string> = {};
               if (deliveryDate === undefined || deliveryDate < today)
                    validationErrors.deliveryDate = t('common.required');
               if (currentShipment.vehicleId == undefined) validationErrors.vehicle = t('common.required');
               if (currentShipment.driverIds?.length == 0) validationErrors.drivers = t('common.required');
               if (currentShipment.clientOrderShipments.length == 0) validationErrors.orders = t('common.required');

               showSnackbar(t('common.validationError'), 'error');
               setErrors(validationErrors);
               return false;
          }

          setErrors({});

          currentShipment.deliveryDate = deliveryDate;

          // For endpoints that return void (204), we need to check if the call threw an error
          // executeApiCall returns null both for errors and for successful void responses
          // We use a flag to track if an error occurred
          let hasError = false;
          await executeApiCall(
               () => client.updateOutgoingShipmentEndpoint(selectedShipmentId, currentShipment),
               undefined,
               {
                    onError: () => {
                         hasError = true;
                    },
               }
          );

          if (hasError) {
               return false;
          }

          showSnackbar(t('outgoingShipments.saveSuccess'), 'success');

          // If the state or date has changed, reload the list
          if (
               currentShipment?.state !== currentInitialShipment?.state ||
               currentShipment?.name !== currentInitialShipment?.name ||
               currentShipment?.deliveryDate !== currentInitialShipment?.deliveryDate
          ) {
               const updated = await fetchOutgoingShipments();
               setOutgoingShipments(updated);
          }
          setCurrentInitialShipment(currentShipment);
          return true;
     };

     const handleNewShipmentClick = () => {
          if (hasDetailChanges) {
               setPendingShipmentId('new');
               setIsPendingChangesDialogOpen(true);
          } else {
               setCreateShipmentDrawerVisible(true);
          }
     };

     const closeDrawer = () => {
          fetchOutgoingShipments().then(setOutgoingShipments);
          setCreateShipmentDrawerVisible(false);
     };

     const handleShipmentCreated = async (newDeliveryId: string) => {
          await fetchOutgoingShipments().then(setOutgoingShipments);
          setSelectedShipmentId(newDeliveryId);
          setCreateShipmentDrawerVisible(false);
     };

     const deleteShipment = async () => {
          const success = await executeApiCall(() => client.deleteOutgoingShipmentEndpoint(selectedShipmentId!));

          if (success) {
               showSnackbar(t('outgoingShipments.shipmentDeleted'), 'success');
               const filtered = outgoingShipments.filter((d) => d.id !== selectedShipmentId);
               setOutgoingShipments(filtered);
               setSelectedShipmentId(filtered.length > 0 ? filtered[0].id : undefined);
          }

          setIsDeleteDialogVisible(false);
     };

     const handlePendingChangesConfirmation = async (shouldSave: boolean, shouldLoadNewDetail: boolean) => {
          if (shouldSave) {
               void saveCurrentShipment();
          }

          setIsPendingChangesDialogOpen(false);

          if (blocker.state === 'blocked') {
               if (shouldLoadNewDetail) {
                    blocker.proceed();
               } else {
                    blocker.reset();
               }
          }

          if (pendingShipmentId !== null && shouldLoadNewDetail) {
               // After saving (or when discarding changes) set the new shipment
               if (pendingShipmentId === 'new') {
                    setCreateShipmentDrawerVisible(true);
               } else {
                    setSelectedShipmentId(pendingShipmentId);
               }

               setPendingShipmentId(null);
          }
     };

     return (
          <DashboardContent>
               <Box sx={{ mb: 5, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('outgoingShipments.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<Iconify icon="mingcute:add-line" />}
                         onClick={handleNewShipmentClick}
                    >
                         {t('outgoingShipments.new')}
                    </Button>
               </Box>
               <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
                    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                         <Box
                              sx={{
                                   position: 'relative',
                                   alignItems: 'center',
                                   flex: 1,
                                   display: 'flex',
                                   flexDirection: 'column',
                              }}
                         >
                              {initialLoading ? (
                                   <LinearProgress
                                        sx={{
                                             zIndex: 1,
                                             position: 'absolute',
                                             top: 190,
                                             left: '50%',
                                             transform: 'translateX(-50%)',
                                             width: '40%',
                                             bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                             [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
                                        }}
                                   />
                              ) : (
                                   <Card
                                        sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}
                                   >
                                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' } }}>
                                             <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                                                  <OutgoingShipmentSelect
                                                       shipments={outgoingShipments}
                                                       selectedShipmentId={selectedShipmentId}
                                                       onSelect={handleRowClick}
                                                  />
                                             </Box>
                                             <SectionHeader
                                                  text={t('outgoingShipments.detailTitle')}
                                                  headerVariant="h5"
                                                  sx={{ m: 2, ml: 3, width: '100%' }}
                                             >
                                                  <Box sx={{ alignItems: 'right' }}>
                                                       <IconButton
                                                            onClick={() => setIsResetDialogVisible(true)}
                                                            color="primary"
                                                            disabled={!hasDetailChanges}
                                                       >
                                                            <Iconify icon="solar:restart-bold" />
                                                       </IconButton>
                                                       <IconButton
                                                            onClick={() => void saveCurrentShipment()}
                                                            color="primary"
                                                            disabled={!hasDetailChanges}
                                                       >
                                                            <Iconify icon="solar:floppy-disk-bold" />
                                                       </IconButton>
                                                       <IconButton
                                                            onClick={() => setIsDeleteDialogVisible(true)}
                                                            color="error"
                                                            disabled={false}
                                                       >
                                                            <Iconify icon="solar:trash-bin-trash-bold" />
                                                       </IconButton>
                                                  </Box>
                                             </SectionHeader>
                                        </Box>
                                        {outgoingShipments.length === 0 && selectedShipmentId === undefined && (
                                             <Box
                                                  sx={{
                                                       display: 'flex',
                                                       alignItems: 'center',
                                                       width: '100%',
                                                       alignContent: 'center',
                                                       p: 5,
                                                       minHeight: 400,
                                                  }}
                                             >
                                                  <Typography
                                                       variant="subtitle2"
                                                       sx={{ flexGrow: 1, textAlign: 'center' }}
                                                  >
                                                       {t('outgoingShipments.noShipmentsToDisplay')}
                                                  </Typography>
                                             </Box>
                                        )}
                                        {selectedShipmentId !== undefined && (
                                             <OutgoingShipmentDetailView
                                                  drivers={drivers}
                                                  vehicles={vehicles}
                                                  orders={orders}
                                                  shipment={currentShipment!}
                                                  errors={errors}
                                                  onChange={setCurrentShipment}
                                                  changesMade={hasDetailChanges}
                                             />
                                        )}
                                   </Card>
                              )}
                         </Box>
                    </Box>
               </Box>
               <Drawer anchor="right" open={createShipmentDrawerVisible} onClose={closeDrawer}>
                    <Box sx={{ width: { xs: '100vw', md: 1200 }, p: 2 }}>
                         <CreateOutgoingShipmentView
                              drivers={drivers}
                              vehicles={vehicles}
                              width={1200}
                              onClose={closeDrawer}
                              onSave={handleShipmentCreated}
                         />
                    </Box>
               </Drawer>
               {/* Delete confirmation dialog */}
               <DeleteConfirmationDialog
                    open={isDeleteDialogVisible}
                    onClose={() => setIsDeleteDialogVisible(false)}
                    onDelete={deleteShipment}
                    deleteConfirmMessage={t('outgoingShipments.deleteConfirm')}
                    cancelLabel={t('common.cancel')}
                    deleteLabel={t('common.delete')}
               />

               {/* Reset confirmation dialog */}
               <ResetConfirmationDialog
                    open={isResetDialogVisible}
                    onClose={() => setIsResetDialogVisible(false)}
                    onReset={handleReset}
                    cancelLabel={t('common.cancel')}
                    resetLabel={t('common.reset')}
               />

               {/* Pending changes confirmation dialog */}
               <PendingChangesConfirmationDialog
                    open={isPendingChangesDialogOpen}
                    onClose={() => handlePendingChangesConfirmation(false, false)}
                    onSave={() => handlePendingChangesConfirmation(true, true)}
                    onDiscard={() => handlePendingChangesConfirmation(false, true)}
                    cancelLabel={t('common.cancel')}
                    discardLabel={t('common.discard')}
                    saveLabel={t('common.save')}
               />
          </DashboardContent>
     );
}
