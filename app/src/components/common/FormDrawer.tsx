import { type ReactNode } from 'react';
import {
  Drawer,
  Box,
  Stack,
  Typography,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';

/** Right-side drawer scaffold for create/edit forms. The caller supplies the
 * form fields as children and wires submit via `onSubmit`; the drawer renders
 * the header, scrollable body, and a sticky footer with cancel/save. */
export function FormDrawer({
  open,
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitLabel = 'Uložit',
  busy = false,
  submitDisabled = false,
  width = 460,
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  busy?: boolean;
  submitDisabled?: boolean;
  width?: number;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: width }, maxWidth: '100%' } } }}
    >
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ px: 3, py: 2.25 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontSize: 18 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} disabled={busy} edge="end" aria-label="Zavřít">
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
          <Stack spacing={2.25}>{children}</Stack>
        </Box>
        <Divider />
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={busy} color="inherit">
            Zrušit
          </Button>
          <Button type="submit" variant="contained" disabled={busy || submitDisabled}>
            {busy ? 'Ukládám…' : submitLabel}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
