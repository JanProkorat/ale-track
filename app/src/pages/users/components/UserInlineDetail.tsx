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

import { UpdateUserDto } from 'src/generated/api-client';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useUsers, useUpdateUser, useDeleteUser } from 'src/hooks/useUsers';

import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import UserInlineForm from './UserInlineForm';

import type { UserFormValues } from '../userFormSchema';
import type { UserInlineFormHandle, FormHeaderState } from './UserInlineForm';

// ---------------------------------------------------------------------------

interface UserInlineDetailProps {
     userId: string | null;
     onDeleted: () => void;
     onDirtyChange?: (dirty: boolean) => void;
}

export default function UserInlineDetail({ userId, onDeleted, onDirtyChange }: UserInlineDetailProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     // No detail endpoint — find user from list
     const { data: users = [], isLoading } = useUsers();
     const user = users.find((u) => u.id === userId) ?? null;

     const updateMutation = useUpdateUser();
     const deleteMutation = useDeleteUser();

     const formRef = useRef<UserInlineFormHandle>(null);
     const [deleteOpen, setDeleteOpen] = useState(false);
     const [headerState, setHeaderState] = useState<FormHeaderState>({
          isDirty: false,
          userName: '',
          displayName: '',
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

     if (!userId) {
          return (
               <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    {t('users.selectUser')}
               </Typography>
          );
     }

     if (isLoading) {
          return <LoadingSpinner />;
     }

     if (!user) return null;

     const handleSave = (data: UserFormValues) => {
          const dto = new UpdateUserDto();
          dto.firstName = data.firstName || undefined;
          dto.lastName = data.lastName || undefined;
          dto.userRoles = data.userRoles;

          updateMutation.mutate({ id: userId, data: dto });
     };

     const handleDelete = () => {
          deleteMutation.mutate(userId, {
               onSuccess: () => {
                    setDeleteOpen(false);
                    onDeleted();
               },
          });
     };

     const handleReset = () => {
          formRef.current?.resetForm();
     };

     const displayName = headerState.displayName || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

     return (
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
               {/* Header */}
               <Stack direction="row" alignItems="flex-start" sx={{ mb: 2 }} spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                         <Typography variant="h6" noWrap>
                              {headerState.userName || user.userName}
                         </Typography>
                         {displayName && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                   {displayName}
                              </Typography>
                         )}
                         <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              {(user.userRoles ?? []).map((role) => (
                                   <Chip
                                        key={role}
                                        label={enumLabel.userRole(role)}
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                   />
                              ))}
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
                    <UserInlineForm
                         ref={formRef}
                         user={user}
                         onSubmit={handleSave}
                         onFormStateChange={handleFormStateChange}
                    />
               </Box>

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('users.deleteConfirm', { name: user.userName })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
