import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';

import { Box } from '@mui/material';

import { useAuthorizedClient } from 'src/api/use-authorized-client';

import { useApiCall } from '../../../hooks/use-api-call';
import { FormField } from '../../../components/forms/form-field';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { DrawerLayout } from '../../../layouts/components/drawer-layout';
import { useEntityStatsRefresh } from '../../../providers/EntityStatsContext';
import { VehicleDto, CreateVehicleDto, UpdateVehicleDto } from '../../../api/Client';

type VehicleDetailViewProps = {
     id: string | null;
     onClose: () => void;
     onSave: () => void;
};

export function VehicleDetailView({ id, onClose, onSave }: Readonly<VehicleDetailViewProps>) {
     const { showSnackbar } = useSnackbar();
     const { t } = useTranslation();
     const { triggerRefresh } = useEntityStatsRefresh();
     const { executeApiCall } = useApiCall();
     const clientApi = useAuthorizedClient();

     const [isLoading, setIsLoading] = useState<boolean>(false);
     const [vehicle, setVehicle] = useState<VehicleDto>(
          new VehicleDto({
               name: '',
               maxWeight: 0,
          })
     );
     const [errors, setErrors] = useState<Record<string, string>>({});

     const fetchVehicle = useCallback(async () => {
          setIsLoading(true);
          const data = await executeApiCall(() => clientApi.getVehicleDetailEndpoint(id!));
          if (data) {
               setVehicle(data);
          }
          setIsLoading(false);
     }, [clientApi, executeApiCall, id]);

     useEffect(() => {
          if (id !== null) void fetchVehicle();
     }, [fetchVehicle, id]);

     const saveVehicle = async (): Promise<void> => {
          const { name, maxWeight } = vehicle;

          const newErrors: Record<string, string> = {};
          if (!name) newErrors.name = t('common.required');
          if (!maxWeight) newErrors.maxWeight = t('common.required');

          if (Object.keys(newErrors).length > 0) {
               setErrors(newErrors);
               showSnackbar(t('common.validationError'), 'error');
               return;
          }

          setErrors({});

          let result;

          if (id === null) {
               const createDto = new CreateVehicleDto({
                    name: vehicle.name!,
                    maxWeight: vehicle.maxWeight!,
               });

               result = await executeApiCall(() => clientApi.createVehicleEndpoint(createDto.toJSON()));
               if (result) {
                    triggerRefresh();
               }
          } else {
               const updateDto = new UpdateVehicleDto({
                    name: vehicle.name!,
                    maxWeight: vehicle.maxWeight!,
               });

               let hasError = false;
               await executeApiCall(() => clientApi.updateVehicleEndpoint(id, updateDto.toJSON()), undefined, {
                    onError: () => {
                         hasError = true;
                    },
               });

               if (!hasError) {
                    result = true;
               }
          }

          if (result) {
               showSnackbar(t('vehicles.saveSuccess'), 'success');
               onSave();
          }
     };

     return (
          <DrawerLayout
               title={t('vehicles.detailTitle')}
               isLoading={isLoading}
               onClose={onClose}
               onSaveAndClose={saveVehicle}
          >
               <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormField
                         id="vehicle-name"
                         label={t('vehicles.name')}
                         value={vehicle.name || ''}
                         onChange={(value) => setVehicle((prev) => new VehicleDto({ ...prev, name: value }))}
                         error={errors.name}
                         sx={{ mt: 1 }}
                    />

                    <FormField
                         id="vehicle-weight"
                         label={t('vehicles.maxWeight')}
                         value={vehicle.maxWeight || ''}
                         type="number"
                         onChange={(value) =>
                              setVehicle(
                                   (prev) =>
                                        new VehicleDto({
                                             ...prev,
                                             maxWeight: value === '' ? 0 : parseFloat(value),
                                        })
                              )
                         }
                         error={errors.maxWeight}
                         endAdornment="Kg"
                    />
               </Box>
          </DrawerLayout>
     );
}
