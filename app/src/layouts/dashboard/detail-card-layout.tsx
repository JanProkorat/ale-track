import type { ReactNode } from 'react';

import { useState, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Box, IconButton, Typography } from '@mui/material';

import { Iconify } from 'src/components/iconify';
import { ResetConfirmationDialog } from 'src/components/dialogs/reset-confirmation-dialog';
import { DeleteConfirmationDialog } from 'src/components/dialogs/delete-confirmation-dialog';
import { PendingChangesConfirmationDialog } from 'src/components/dialogs/pending-changes-confirmation-dialog';

import { SectionHeader } from '../../components/label/section-header';

type DetailCardLayoutProps<T> = {
     id: string | null;
     shouldCheckPendingChanges: boolean;
     onDelete: () => void;
     onConfirmed: (shouldLoadNewDetail: boolean) => void;
     onHasChangesChange?: (hasChanges: boolean) => void;
     onProgressbarVisibilityChange: (isVisible: boolean) => void;

     title: string;
     noDetailMessage: string;
     entity: T;
     initialEntity: T | null;

     onFetchEntity: () => Promise<void>;
     onSaveEntity: () => Promise<boolean>;
     onDeleteEntity: () => Promise<void>;
     onResetEntity: () => void;

     deleteConfirmMessage: string;
     disabled?: boolean;

     children: ReactNode;
};

export function DetailCardLayout<T>({
     id,
     shouldCheckPendingChanges,
     onDelete,
     onConfirmed,
     onHasChangesChange,
     onProgressbarVisibilityChange,
     title,
     noDetailMessage,
     entity,
     initialEntity,
     onFetchEntity,
     onSaveEntity,
     onDeleteEntity,
     onResetEntity,
     deleteConfirmMessage,
     disabled,
     children,
}: Readonly<DetailCardLayoutProps<T>>) {
     const { t } = useTranslation();

     const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
     const [isResetDialogVisible, setIsResetDialogVisible] = useState<boolean>(false);
     const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

     const hasChanges = initialEntity && JSON.stringify(initialEntity) !== JSON.stringify(entity);

     const blocker = useBlocker(
          ({ currentLocation, nextLocation }) => !!hasChanges && currentLocation.pathname !== nextLocation.pathname
     );

     useEffect(() => {
          if (blocker.state === 'blocked') {
               setIsConfirmDialogOpen(true);
          }
     }, [blocker.state]);

     useEffect(() => {
          if (shouldCheckPendingChanges) setIsConfirmDialogOpen(true);
     }, [shouldCheckPendingChanges]);

     useEffect(() => {
          onHasChangesChange?.(!!hasChanges);
     }, [entity, initialEntity, hasChanges, onHasChangesChange]);

     useEffect(() => {
          if (id !== null) void onFetchEntity();
     }, [id, onFetchEntity]);

     const handleDeleteEntity = async () => {
          try {
               onProgressbarVisibilityChange(true);
               await onDeleteEntity();
               onDelete();
          } catch (e) {
               console.error('Error deleting entity', e);
          } finally {
               setIsDeleteDialogVisible(false);
               onProgressbarVisibilityChange(false);
          }
     };

     const handleReset = async () => {
          onResetEntity();
          setIsResetDialogVisible(false);
     };

     const handleConfirmation = async (shouldSave: boolean, shouldLoadNewDetail: boolean) => {
          if (shouldSave) void onSaveEntity();

          setIsConfirmDialogOpen(false);

          if (blocker.state === 'blocked') {
               if (shouldLoadNewDetail) {
                    blocker.proceed();
               } else {
                    blocker.reset();
               }
          }
          onConfirmed(shouldLoadNewDetail);
     };

     const handleUpdateSave = async () => {
          const success = await onSaveEntity();
          if (success) {
               await onFetchEntity();
          }
     };

     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    px: { xs: 1, md: 2 },
               }}
          >
               {/* Header */}
               <SectionHeader text={title} headerVariant="h5" sx={{ mb: 2 }}>
                    <Box sx={{ alignItems: 'right' }}>
                         <IconButton
                              onClick={() => setIsResetDialogVisible(true)}
                              color="primary"
                              disabled={!hasChanges || disabled}
                         >
                              <Iconify icon="solar:restart-bold" />
                         </IconButton>
                         <IconButton onClick={handleUpdateSave} color="primary" disabled={!hasChanges || disabled}>
                              <Iconify icon="solar:floppy-disk-bold" />
                         </IconButton>
                         <IconButton onClick={() => setIsDeleteDialogVisible(true)} color="error" disabled={disabled}>
                              <Iconify icon="solar:trash-bin-trash-bold" />
                         </IconButton>
                    </Box>
               </SectionHeader>

               {/* Content */}
               {id === null ? (
                    <Typography sx={{ mt: 2, ml: 2 }}>{noDetailMessage}</Typography>
               ) : (
                    <Box
                         sx={{
                              flexGrow: 1,
                              overflowY: 'auto',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                         }}
                    >
                         {children}
                    </Box>
               )}

               {/* Delete confirmation dialog */}
               <DeleteConfirmationDialog
                    open={isDeleteDialogVisible}
                    onClose={() => setIsDeleteDialogVisible(false)}
                    onDelete={handleDeleteEntity}
                    deleteConfirmMessage={deleteConfirmMessage}
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
                    open={isConfirmDialogOpen}
                    onClose={() => setIsConfirmDialogOpen(false)}
                    onSave={() => handleConfirmation(true, true)}
                    onDiscard={() => handleConfirmation(false, true)}
                    cancelLabel={t('common.cancel')}
                    discardLabel={t('common.discard')}
                    saveLabel={t('common.save')}
               />
          </Box>
     );
}
