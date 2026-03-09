import dayjs from 'dayjs';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import CircularProgress from '@mui/material/CircularProgress';

import { useDriver, useUpdateDriver, useDeleteDriver } from 'src/hooks/useDrivers';

import { UpdateDriverDto, UpdateDriverAvailabilityDto } from 'src/generated/api-client';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import DriverInlineForm from './DriverInlineForm';

import type { DriverFormValues } from '../driverFormSchema';
import type { DriverInlineFormHandle, FormHeaderState } from './DriverInlineForm';

// ---------------------------------------------------------------------------

interface DriverInlineDetailProps {
     driverId: string | null;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function DriverInlineDetail({ driverId, onDeleted, onDirtyChange }: DriverInlineDetailProps) {
     const { t } = useTranslation();

     const { data: driver, isLoading } = useDriver(driverId ?? '');
     const updateMutation = useUpdateDriver();
     const deleteMutation = useDeleteDriver();

     const formRef = useRef<DriverInlineFormHandle>(null);
     const [deleteOpen, setDeleteOpen] = useState(false);
     const [headerState, setHeaderState] = useState<FormHeaderState>({
          isDirty: false,
          name: '',
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

     if (!driverId) {
          return (
               <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    {t('drivers.selectDriver')}
               </Typography>
          );
     }

     if (isLoading) {
          return <LoadingSpinner />;
     }

     if (!driver) return null;

     const handleSave = (data: DriverFormValues) => {
          const dto = new UpdateDriverDto();
          dto.firstName = data.firstName;
          dto.lastName = data.lastName;
          dto.phoneNumber = data.phoneNumber || undefined;
          dto.color = data.color;
          dto.availableDates = data.availableDates.map((avail) => {
               const a = new UpdateDriverAvailabilityDto();
               a.from = avail.from ? dayjs(avail.from).toDate() : undefined;
               a.until = avail.until ? dayjs(avail.until).toDate() : undefined;
               return a;
          });

          updateMutation.mutate({ id: driverId, data: dto });
     };

     const handleDelete = () => {
          deleteMutation.mutate(driverId, {
               onSuccess: () => {
                    setDeleteOpen(false);
                    onDeleted();
               },
          });
     };

     const handleReset = () => {
          formRef.current?.resetForm();
     };

     const displayName = headerState.name || `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim();

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
                              <Box
                                   sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        bgcolor: driver.color ?? '#ccc',
                                        flexShrink: 0,
                                   }}
                              />
                              <Typography variant="h6" noWrap>
                                   {displayName}
                              </Typography>
                         </Stack>
                         {driver.phoneNumber && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                   {driver.phoneNumber}
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
                    <DriverInlineForm
                         ref={formRef}
                         driver={driver}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('drivers.deleteConfirm', { name: displayName })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
