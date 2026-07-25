import { type ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';

/** Confirmation for destructive/irreversible actions (delete, cancel). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Smazat',
  cancelLabel = 'Zrušit',
  destructive = true,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box component="span" sx={{ flex: 1 }}>{title}</Box>
        <IconButton onClick={onClose} disabled={busy} aria-label="Zavřít" size="small">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} color="inherit">
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
        >
          {busy ? 'Provádím…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
