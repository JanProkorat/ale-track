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

import { useBrewery, useUpdateBrewery, useDeleteBrewery } from 'src/hooks/useBreweries';

import { UpdateBreweryDto } from 'src/generated/api-client';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import BreweryInlineForm from './BreweryInlineForm';
import { buildAddressDto } from '../breweryFormSchema';

import type { BreweryFormValues } from '../breweryFormSchema';
import type { BreweryInlineFormHandle, FormHeaderState } from './BreweryInlineForm';

// ---------------------------------------------------------------------------

interface BreweryInlineDetailProps {
     breweryId: string | null;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function BreweryInlineDetail({ breweryId, onDeleted, onDirtyChange }: BreweryInlineDetailProps) {
     const { t } = useTranslation();

     const { data: brewery, isLoading } = useBrewery(breweryId ?? '');
     const updateMutation = useUpdateBrewery();
     const deleteMutation = useDeleteBrewery();

     const formRef = useRef<BreweryInlineFormHandle>(null);
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

     // No brewery selected
     if (!breweryId) {
          return (
               <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    {t('breweries.selectBrewery')}
               </Typography>
          );
     }

     if (isLoading) {
          return <LoadingSpinner />;
     }

     if (!brewery) return null;

     const handleSave = (data: BreweryFormValues) => {
          const officialAddress = buildAddressDto(data.officialAddress);
          const contactAddress =
               data.hasContactAddress && data.contactAddress
                    ? buildAddressDto(data.contactAddress)
                    : undefined;

          const dto = new UpdateBreweryDto();
          dto.name = data.name;
          dto.color = data.color;
          dto.officialAddress = officialAddress;
          dto.contactAddress = contactAddress;

          updateMutation.mutate({ id: breweryId, data: dto });
     };

     const handleDelete = () => {
          deleteMutation.mutate(breweryId, {
               onSuccess: () => {
                    setDeleteOpen(false);
                    onDeleted();
               },
          });
     };

     const handleReset = () => {
          formRef.current?.resetForm();
     };

     const displayName = headerState.name || brewery.name || '';

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
                                   {displayName}
                              </Typography>
                              {brewery.color && (
                                   <Box
                                        sx={{
                                             width: 20,
                                             height: 20,
                                             borderRadius: '50%',
                                             backgroundColor: brewery.color,
                                             border: '1px solid',
                                             borderColor: 'divider',
                                             flexShrink: 0,
                                        }}
                                   />
                              )}
                         </Stack>
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
                    <BreweryInlineForm
                         ref={formRef}
                         brewery={brewery}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('breweries.deleteConfirm', { name: brewery.name })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />

          </Box>
     );
}
