import type { ReactNode } from "react";

import {useTranslation} from "react-i18next";

import { Dialog, Button, DialogTitle, DialogActions } from "@mui/material";

export type ResetConfirmationDialogProps = {
    open: boolean;
    onClose: () => void;
    onReset: () => void;
    cancelLabel: ReactNode;
    resetLabel: ReactNode;
};

export function ResetConfirmationDialog({
    open,
    onClose,
    onReset,
    cancelLabel,
    resetLabel
}: Readonly<ResetConfirmationDialogProps>) {
    const {t} = useTranslation();

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                {t('common.resetConfirm')}
            </DialogTitle>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {cancelLabel}
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onReset}
                >
                    {resetLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

