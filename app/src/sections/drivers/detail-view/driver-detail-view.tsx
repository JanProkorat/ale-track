import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';

import { useAuthorizedClient } from 'src/api/use-authorized-client';

import { useApiCall } from '../../../hooks/use-api-call';
import { FormField } from '../../../components/forms/form-field';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { ColorPicker } from '../../../components/color/color-picker';
import { DriverAvailabilityEditor } from './driver-availability-editor';
import { DrawerLayout } from '../../../layouts/components/drawer-layout';
import { useEntityStatsRefresh } from '../../../providers/EntityStatsContext';
import { DriverDto, CreateDriverDto, UpdateDriverDto } from '../../../api/Client';

interface DriverDetailViewProps {
     id: string | null;
     onClose: () => void | undefined;
}

export const DriverDetailView: React.FC<DriverDetailViewProps> = ({ id, onClose }) => {
     const { t } = useTranslation();
     const { showSnackbar } = useSnackbar();
     const { triggerRefresh } = useEntityStatsRefresh();
     const { executeApiCall } = useApiCall();
     const clientApi = useAuthorizedClient();

     const [isLoading, setIsLoading] = useState<boolean>(false);
     const [errors, setErrors] = useState<Record<string, string>>({});
     const [driver, setDriver] = useState<DriverDto>(
          new DriverDto({
               firstName: '',
               lastName: '',
               phoneNumber: '',
               availableDates: [],
               color: '#aabbcc',
          })
     );

     const fetchDriver = useCallback(async () => {
          setIsLoading(true);
          const data = await executeApiCall(() => clientApi.getDriverDetailEndpoint(id!));
          if (data) {
               setDriver(data);
          }
          setIsLoading(false);
     }, [executeApiCall, id, clientApi]);

     useEffect(() => {
          if (id !== null && id !== undefined) void fetchDriver();
     }, [fetchDriver, id]);

     const saveDriver = async () => {
          const { firstName, lastName } = driver;

          const newErrors: Record<string, string> = {};
          if (!firstName) newErrors.firstName = t('common.required');
          if (!lastName) newErrors.lastName = t('common.required');

          const intervals = driver
               .availableDates!.filter((x) => x.from && x.until)
               .map((x) => ({ from: new Date(x.from!), until: new Date(x.until!) }))
               .sort((a, b) => a.from.getTime() - b.from.getTime());

          for (let i = 0; i < intervals.length - 1; i++) {
               if (intervals[i].until > intervals[i + 1].from) {
                    newErrors.availableDates = t('drivers.dateIntervalsOverlap');
               }
          }

          if (Object.keys(newErrors).length > 0) {
               setErrors(newErrors);

               if (newErrors.firstName || newErrors.lastName) {
                    showSnackbar(t('common.validationError'), 'error');
               }

               if (newErrors.availableDates) {
                    showSnackbar(t('common.overlappingIntervals'), 'error');
               }

               return;
          }

          setErrors({});

          let result;

          if (id === null) {
               const createDto = new CreateDriverDto({
                    firstName: driver.firstName!,
                    lastName: driver.lastName!,
                    phoneNumber: driver.phoneNumber,
                    availableDates: driver.availableDates,
                    color: driver.color!,
               });

               result = await executeApiCall(() => clientApi.createDriverEndpoint(createDto.toJSON()));
               if (result) {
                    triggerRefresh();
               }
          } else {
               const updateDto = new UpdateDriverDto({
                    firstName: driver.firstName!,
                    lastName: driver.lastName!,
                    phoneNumber: driver.phoneNumber,
                    availableDates: driver.availableDates,
                    color: driver.color!,
               });

               let hasError = false;
               await executeApiCall(() => clientApi.updateDriverEndpoint(id, updateDto.toJSON()), undefined, {
                    onError: () => {
                         hasError = true;
                    },
               });

               if (!hasError) {
                    result = true;
               }
          }

          if (result) {
               showSnackbar(t('drivers.saveSuccess'), 'success');
               onClose();
          }
     };

     return (
          <DrawerLayout
               title={t('drivers.detailTitle')}
               isLoading={isLoading}
               onClose={onClose}
               onSaveAndClose={saveDriver}
          >
               <Box sx={{ mt: 1 }}>
                    {/* Driver name */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                         <FormField
                              id="firstName"
                              label={t('drivers.firstName')}
                              value={driver.firstName ?? ''}
                              onChange={(value) => setDriver((prev) => new DriverDto({ ...prev, firstName: value }))}
                              error={errors.firstName}
                         />
                         <FormField
                              id="lastName"
                              label={t('drivers.lastName')}
                              value={driver.lastName ?? ''}
                              onChange={(value) => setDriver((prev) => new DriverDto({ ...prev, lastName: value }))}
                              error={errors.lastName}
                         />
                    </Box>

                    {/* driver's phone */}
                    <FormField
                         id="phone"
                         label={t('drivers.phone')}
                         value={driver.phoneNumber ?? ''}
                         onChange={(value) => setDriver((prev) => new DriverDto({ ...prev, phoneNumber: value }))}
                         error={errors.phoneNumber}
                         sx={{ mt: 2 }}
                    />

                    {/* driver's color */}
                    <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2 }}>
                         <Box
                              sx={{
                                   width: 46,
                                   height: 46,
                                   backgroundColor: driver.color,
                                   borderRadius: 1,
                                   border: '1px solid #ccc',
                              }}
                         />
                         <ColorPicker
                              color={driver.color ?? ''}
                              errors={errors}
                              onChange={(color) =>
                                   setDriver(
                                        (prev) =>
                                             new DriverDto({
                                                  ...prev,
                                                  color,
                                             })
                                   )
                              }
                         />
                    </Box>

                    <Box>
                         <DriverAvailabilityEditor
                              availableDates={driver.availableDates || []}
                              onChange={(slots) =>
                                   setDriver(
                                        (prev) =>
                                             new DriverDto({
                                                  ...prev,
                                                  availableDates: slots,
                                             })
                                   )
                              }
                         />
                    </Box>
               </Box>
          </DrawerLayout>
     );
};
