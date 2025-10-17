import type { ReactNode } from "react";

import { Dialog, Button, DialogTitle, DialogActions } from "@mui/material";

export type DeleteConfirmationDialogProps = {
    open: boolean;
    onClose: () => void;
    onDelete: () => void;
    deleteConfirmMessage: ReactNode;
    cancelLabel: ReactNode;
    deleteLabel: ReactNode;
};

export function DeleteConfirmationDialog({
    open,
    onClose,
    onDelete,
    deleteConfirmMessage,
    cancelLabel,
    deleteLabel
}: Readonly<DeleteConfirmationDialogProps>) {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                {deleteConfirmMessage}
            </DialogTitle>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {cancelLabel}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={onDelete}
                >
                    {deleteLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

