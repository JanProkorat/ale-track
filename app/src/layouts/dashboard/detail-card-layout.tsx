import type {ReactNode} from "react";

import { useState, useEffect} from "react";
import {useBlocker} from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Box, Button, Dialog, IconButton, Typography, DialogTitle, DialogActions } from "@mui/material";

import { Iconify } from "src/components/iconify";

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
    resetConfirmMessage: string;
    pendingChangesConfirmMessage: string;
    disabled?: boolean;

    children: ReactNode;
};

export function DetailCardLayout<T>(
    {
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
        resetConfirmMessage,
        pendingChangesConfirmMessage,
        disabled,
        children
    }: Readonly<DetailCardLayoutProps<T>>) {
    const {t} = useTranslation();

    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
    const [isResetDialogVisible, setIsResetDialogVisible] = useState<boolean>(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    const hasChanges = initialEntity && JSON.stringify(initialEntity) !== JSON.stringify(entity);

    const blocker = useBlocker(
        ({currentLocation, nextLocation}) =>
            !!hasChanges && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (blocker.state === "blocked") {
            setIsConfirmDialogOpen(true);
        }
    }, [blocker.state]);

    useEffect(() => {
        if (shouldCheckPendingChanges)
            setIsConfirmDialogOpen(true);
    }, [shouldCheckPendingChanges]);

    useEffect(() => {
        onHasChangesChange?.(!!hasChanges);
    }, [entity, initialEntity, hasChanges, onHasChangesChange]);

    useEffect(() => {
        if (id !== null)
            void onFetchEntity();
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
        if (shouldSave)
            void onSaveEntity();

        setIsConfirmDialogOpen(false);

        if (blocker.state === "blocked") {
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
                pl: 2,
                pr: 2
            }}
        >
            {/* Header */}
            <Box sx={{
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #eee',
                mb: 2
            }}>
                <Typography variant="h5" sx={{fontWeight: 'bold'}}>
                    {title}
                </Typography>
                <Box sx={{alignItems: 'right'}}>
                    <IconButton
                        onClick={() => setIsResetDialogVisible(true)}
                        color="primary"
                        disabled={!hasChanges || disabled}
                    >
                        <Iconify icon="solar:restart-bold"/>
                    </IconButton>
                    <IconButton
                        onClick={handleUpdateSave}
                        color="primary"
                        disabled={!hasChanges || disabled}
                    >
                        <Iconify icon="solar:floppy-disk-bold"/>
                    </IconButton>
                    <IconButton
                        onClick={() => setIsDeleteDialogVisible(true)}
                        color="error"
                        disabled={disabled}
                    >
                        <Iconify icon="solar:trash-bin-trash-bold"/>
                    </IconButton>
                </Box>
            </Box>

            {/* Content */}
            {id === null ? (
                <Typography sx={{mt: 2, ml: 2}}>
                    {noDetailMessage}
                </Typography>
            ) : (
                <Box sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                }}>
                    {children}
                </Box>
            )}

            {/* Delete confirmation dialog */}
            <Dialog
                open={isDeleteDialogVisible}
                onClose={() => setIsDeleteDialogVisible(false)}
            >
                <DialogTitle>
                    {deleteConfirmMessage}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setIsDeleteDialogVisible(false)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteEntity}
                    >
                        {t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reset confirmation dialog */}
            <Dialog
                open={isResetDialogVisible}
                onClose={() => setIsResetDialogVisible(false)}
            >
                <DialogTitle>
                    {resetConfirmMessage}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setIsResetDialogVisible(false)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleReset}
                    >
                        {t('common.reset')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Pending changes confirmation dialog */}
            <Dialog
                open={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
            >
                <DialogTitle>
                    {pendingChangesConfirmMessage}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => handleConfirmation(false, false)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={() => handleConfirmation(false, true)} color="inherit">
                        {t('common.discard')}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleConfirmation(true, true)}
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
