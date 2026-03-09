import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import CircularProgress from '@mui/material/CircularProgress';

import { useClient, useUpdateClient, useDeleteClient } from 'src/hooks/useClients';

import { Region, ContactType, UpdateClientDto, UpdateClientContactDto } from 'src/generated/api-client';

import { useEnumLabel } from 'src/utils/enumTranslations';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import ClientInlineForm from './ClientInlineForm';
import { buildAddressDto } from '../clientFormSchema';

import type { ClientFormValues } from '../clientFormSchema';
import type { ClientInlineFormHandle, FormHeaderState } from './ClientInlineForm';

// ---------------------------------------------------------------------------

interface ClientInlineDetailProps {
     clientId: string | null;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function ClientInlineDetail({ clientId, onDeleted, onDirtyChange }: ClientInlineDetailProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const { data: client, isLoading } = useClient(clientId ?? '');
     const updateMutation = useUpdateClient();
     const deleteMutation = useDeleteClient();

     const formRef = useRef<ClientInlineFormHandle>(null);
     const [deleteOpen, setDeleteOpen] = useState(false);
     const [headerState, setHeaderState] = useState<FormHeaderState>({
          isDirty: false,
          name: '',
          region: '',
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

     // No client selected
     if (!clientId) {
          return (
               <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    {t('clients.selectClient')}
               </Typography>
          );
     }

     if (isLoading) {
          return <LoadingSpinner />;
     }

     if (!client) return null;

     const handleSave = (data: ClientFormValues) => {
          const officialAddress = buildAddressDto(data.officialAddress);
          const contactAddress =
               data.hasContactAddress && data.contactAddress
                    ? buildAddressDto(data.contactAddress)
                    : undefined;

          const dto = new UpdateClientDto();
          dto.name = data.name;
          dto.businessName = data.businessName || undefined;
          dto.region = data.region as unknown as Region;
          dto.officialAddress = officialAddress;
          dto.contactAddress = contactAddress;
          dto.contacts = data.contacts.map((c) => {
               const contactDto = new UpdateClientContactDto();
               contactDto.type = c.type as unknown as ContactType;
               contactDto.value = c.value;
               contactDto.description = c.description || undefined;
               return contactDto;
          });

          updateMutation.mutate({ id: clientId, data: dto });
     };

     const handleDelete = () => {
          deleteMutation.mutate(clientId, {
               onSuccess: () => {
                    setDeleteOpen(false);
                    onDeleted();
               },
          });
     };

     const handleReset = () => {
          formRef.current?.resetForm();
     };

     const displayName = headerState.name || client.name || '';
     const displayBusiness = client.businessName || '';
     const displayRegion = headerState.region || (client.region as unknown as string);

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
                              {displayRegion && (
                                   <Chip
                                        label={enumLabel.region(displayRegion)}
                                        size="small"
                                        variant="outlined"
                                   />
                              )}
                         </Stack>
                         {displayBusiness && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                   {displayBusiness}
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
               <Box
                    sx={{
                         flexGrow: 1,
                         overflowY: 'auto',
                    }}
               >
                    <ClientInlineForm
                         ref={formRef}
                         client={client}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('clients.deleteConfirm', { name: client.name })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />

          </Box>
     );
}
