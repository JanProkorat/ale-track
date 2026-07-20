import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import { useSnackbar } from 'notistack';
import { DEPOT } from 'src/lib/geo';

function pinIcon(): L.DivIcon {
  const svg = `
    <svg width="32" height="38" viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0 L32 16 L16 30 L0 16 Z" fill="#1A2B4C" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  return L.divIcon({ html: svg, className: 'custom-stop-pin', iconSize: [32, 38], iconAnchor: [16, 30] });
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Dialog to add a custom (non-order) stop: click the map to drop the point,
 * then name it. Returns lat/lng + label + note to the caller. */
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
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const reset = () => { setPoint(null); setLabel(''); setNote(''); };
  const close = () => { reset(); onClose(); };

  const confirm = () => {
    if (!point) { enqueueSnackbar('Klikněte do mapy pro určení místa.', { variant: 'warning' }); return; }
    if (!label.trim()) { enqueueSnackbar('Zadejte název zastávky.', { variant: 'warning' }); return; }
    onAdd({ label: label.trim(), note: note.trim() || undefined, lat: point.lat, lng: point.lng });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Vlastní zastávka</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
          Klikněte do mapy pro určení místa zastávky, poté ji pojmenujte.
        </Typography>
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', mb: 2, '& .leaflet-container': { height: 280, width: '100%' } }}>
          <MapContainer center={[DEPOT.lat, DEPOT.lng]} zoom={10} attributionControl={false} style={{ height: 280, width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickCapture onPick={(lat, lng) => setPoint({ lat, lng })} />
            {point && <Marker position={[point.lat, point.lng]} icon={pinIcon()} />}
          </MapContainer>
        </Box>
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
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} color="inherit">Zrušit</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={confirm}>Přidat zastávku</Button>
      </DialogActions>
    </Dialog>
  );
}
