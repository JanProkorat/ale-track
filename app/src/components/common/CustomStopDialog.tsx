import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import { useSnackbar } from 'notistack';
import type { LatLng } from 'src/lib/geo';
import { AddressMapPicker } from 'src/components/common/AddressMapPicker';

/** Dialog to add a custom (non-order) stop. Set the point either by typing an
 * address and picking a match from the dropdown, or by clicking the map
 * directly; then name it. Returns lat/lng + label + note to the caller. */
export function CustomStopDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (stop: { label: string; note?: string; lat: number; lng: number }) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [point, setPoint] = useState<LatLng | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const reset = () => {
    setPoint(null);
    setLabel('');
    setNote('');
  };
  const close = () => { reset(); onClose(); };

  const confirm = () => {
    if (!point) { enqueueSnackbar('Určete místo zastávky vyhledáním adresy nebo kliknutím do mapy.', { variant: 'warning' }); return; }
    if (!label.trim()) { enqueueSnackbar('Zadejte název zastávky.', { variant: 'warning' }); return; }
    onAdd({ label: label.trim(), note: note.trim() || undefined, lat: point.lat, lng: point.lng });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box component="span" sx={{ flex: 1 }}>Vlastní zastávka</Box>
        <IconButton onClick={onClose} aria-label="Zavřít" size="small">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
          Najděte místo podle adresy, nebo klikněte přímo do mapy, poté zastávku pojmenujte.
        </Typography>
        <AddressMapPicker point={point} onPick={(p) => setPoint(p)} />
        <Stack spacing={2}>
          <TextField label="Název zastávky" required fullWidth size="small" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Např. Čerpací stanice, sklad…" />
          <TextField label="Poznámka" fullWidth size="small" value={note} onChange={(e) => setNote(e.target.value)} />
          {point && (
            <Typography sx={{ fontSize: 12, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} color="inherit">Zrušit</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={confirm}>Přidat zastávku</Button>
      </DialogActions>
    </Dialog>
  );
}
