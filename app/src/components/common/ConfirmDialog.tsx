import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
     open: boolean;
     title: string;
     message: string;
     onConfirm: () => void;
     onCancel: () => void;
     confirmLabel?: string;
     cancelLabel?: string;
     loading?: boolean;
}

export default function ConfirmDialog({
     open,
     title,
     message,
     onConfirm,
     onCancel,
     confirmLabel,
     cancelLabel,
     loading = false,
}: ConfirmDialogProps) {
     const { t } = useTranslation();

     return (
          <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
               <DialogTitle>{title}</DialogTitle>

               <DialogContent>
                    <DialogContentText>{message}</DialogContentText>
               </DialogContent>

               <DialogActions>
                    <Button onClick={onCancel} disabled={loading}>
                         {cancelLabel ?? t('common.cancel')}
                    </Button>

                    <LoadingButton
                         onClick={onConfirm}
                         loading={loading}
                         color="error"
                         variant="contained"
                    >
                         {confirmLabel ?? t('common.confirm')}
                    </LoadingButton>
               </DialogActions>
          </Dialog>
     );
}
