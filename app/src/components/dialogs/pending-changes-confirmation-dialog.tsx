import type { ReactNode } from "react";

import { useTranslation } from "react-i18next";

import { Dialog, Button, DialogTitle, DialogActions } from "@mui/material";

export type PendingChangesConfirmationDialogProps = {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    onDiscard: () => void;
    cancelLabel: ReactNode;
    discardLabel: ReactNode;
    saveLabel: ReactNode;
};

export function PendingChangesConfirmationDialog({
    open,
    onClose,
    onSave,
    onDiscard,
    cancelLabel,
    discardLabel,
    saveLabel
}: PendingChangesConfirmationDialogProps) {
    const { t } = useTranslation();
    
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                {t('common.pendingChangesConfirm')}
            </DialogTitle>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {cancelLabel}
                </Button>
                <Button onClick={onDiscard} color="inherit">
                    {discardLabel}
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onSave}
                >
                    {saveLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
