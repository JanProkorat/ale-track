import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import { useSnackbar } from 'notistack';
import { DEPOT, searchAddresses, type AddressHit } from 'src/lib/geo';

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

/** Recenter the map when an address is picked from search. Keyed by lat/lng so it
 * only fires on a *searched* point — manual map clicks don't re-key it, so the
 * view stays put while the user clicks around. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [map, lat, lng]);
  return null;
}

/** Dialog to add a custom (non-order) stop. Set the point either by searching an
 * address and picking a match, or by clicking the map directly; then name it.
 * Returns lat/lng + label + note to the caller. */
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
  // Set only when the point comes from address search — drives map recentering.
  const [searchedPoint, setSearchedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  const reset = () => {
    searchAbort.current?.abort();
    setPoint(null);
    setSearchedPoint(null);
    setLabel('');
    setNote('');
    setQuery('');
    setResults([]);
    setSearching(false);
    setSearched(false);
  };
  const close = () => { reset(); onClose(); };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    setSearched(false);
    const hits = await searchAddresses(q, ctrl.signal);
    if (ctrl.signal.aborted) return;
    setResults(hits);
    setSearching(false);
    setSearched(true);
  };

  const pickResult = (hit: AddressHit) => {
    setPoint({ lat: hit.lat, lng: hit.lng });
    setSearchedPoint({ lat: hit.lat, lng: hit.lng });
    setLabel((prev) => prev.trim() || hit.label);
    setResults([]);
    setSearched(false);
  };

  const pickOnMap = (lat: number, lng: number) => {
    setPoint({ lat, lng });
    setSearchedPoint(null); // manual click shouldn't recenter the map
  };

  const confirm = () => {
    if (!point) { enqueueSnackbar('Určete místo zastávky vyhledáním adresy nebo kliknutím do mapy.', { variant: 'warning' }); return; }
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
          Najděte místo podle adresy, nebo klikněte přímo do mapy, poté zastávku pojmenujte.
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch(); } }}
          placeholder="Najít podle adresy (např. Pražská 12, Liberec)…"
          sx={{ mb: 1 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {searching ? (
                  <CircularProgress size={18} />
                ) : (
                  <IconButton size="small" edge="end" onClick={() => void runSearch()} aria-label="Hledat adresu">
                    <SearchIcon fontSize="small" />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
        />
        {searched && results.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>Adresu se nepodařilo najít.</Typography>
        )}
        {results.length > 0 && (
          <List dense disablePadding sx={{ mb: 1, maxHeight: 168, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {results.map((hit, i) => (
              <ListItemButton key={`${hit.lat},${hit.lng},${i}`} onClick={() => pickResult(hit)}>
                <ListItemText primary={hit.label} primaryTypographyProps={{ fontSize: 13 }} />
              </ListItemButton>
            ))}
          </List>
        )}
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', mb: 2, '& .leaflet-container': { height: 280, width: '100%' } }}>
          <MapContainer center={[DEPOT.lat, DEPOT.lng]} zoom={10} attributionControl={false} style={{ height: 280, width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickCapture onPick={pickOnMap} />
            {searchedPoint && <Recenter lat={searchedPoint.lat} lng={searchedPoint.lng} />}
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
