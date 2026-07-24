import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import { useSnackbar } from 'notistack';
import { DEPOT, searchAddresses, type AddressHit } from 'src/lib/geo';

/** Min. characters before an address search fires, and the debounce after the
 * last keystroke — keeps us within Nominatim's ~1 request/second guidance. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 350;

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

/** Recenter the map when an address is picked from search. Fires only when the
 * coordinates change (effect deps), so manual map clicks and unrelated
 * re-renders don't yank the view. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [map, lat, lng]);
  return null;
}

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
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  // Set only when the point comes from address search — drives map recentering.
  const [searchedPoint, setSearchedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AddressHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  const cancelSearch = () => {
    if (debounce.current) clearTimeout(debounce.current);
    abort.current?.abort();
  };

  // Type-ahead: debounce a Nominatim lookup as the user types (reason 'input').
  // Programmatic input changes (selection reset / clear) don't reach here.
  const onType = (value: string) => {
    setQuery(value);
    cancelSearch();
    const q = value.trim();
    if (q.length < MIN_QUERY) { setOptions([]); setSearched(false); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      const hits = await searchAddresses(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setOptions(hits);
      setSearching(false);
      setSearched(true);
    }, DEBOUNCE_MS);
  };

  const reset = () => {
    cancelSearch();
    setPoint(null);
    setSearchedPoint(null);
    setLabel('');
    setNote('');
    setQuery('');
    setOptions([]);
    setSearching(false);
    setSearched(false);
  };
  const close = () => { reset(); onClose(); };

  // Cancel any in-flight/debounced search if the dialog unmounts.
  useEffect(() => () => cancelSearch(), []);

  const pickResult = (hit: AddressHit) => {
    cancelSearch();
    setPoint({ lat: hit.lat, lng: hit.lng });
    setSearchedPoint({ lat: hit.lat, lng: hit.lng });
    setQuery(hit.label);
    setOptions([]);
    setSearched(false);
    setSearching(false);
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

  const noOptionsText =
    query.trim().length < MIN_QUERY ? `Zadejte alespoň ${MIN_QUERY} znaky` : searched ? 'Adresu se nepodařilo najít' : 'Hledám…';

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Vlastní zastávka</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
          Najděte místo podle adresy, nebo klikněte přímo do mapy, poté zastávku pojmenujte.
        </Typography>
        <Autocomplete<AddressHit>
          size="small"
          fullWidth
          openOnFocus={false}
          options={options}
          loading={searching}
          filterOptions={(x) => x}
          inputValue={query}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.lat === b.lat && a.lng === b.lng}
          noOptionsText={noOptionsText}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') onType(value);
            else if (reason === 'clear') { setQuery(''); setOptions([]); setSearched(false); cancelSearch(); }
          }}
          onChange={(_, value) => { if (value) pickResult(value); }}
          sx={{ mb: 2 }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Najít podle adresy (např. Pražská 12, Liberec)…"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {searching ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
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
