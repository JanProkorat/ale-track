import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Autocomplete, Box, CircularProgress, TextField } from '@mui/material';
import { searchAddresses, type AddressHit, type LatLng } from 'src/lib/geo';

/** Min. characters before an address search fires, and the debounce after the
 * last keystroke — keeps us within Nominatim's ~1 request/second guidance. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 350;

/** Where the map centers before a point is picked — a Žitava-area default, the
 * business's home region. Only ever the initial view; it has no bearing on
 * the picked coordinates themselves. */
const DEFAULT_CENTER: LatLng = { lat: 50.897, lng: 14.807 };

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

/** Address search + clickable map, combined behind one controlled point. Set the
 * point either by typing an address and picking a match from the dropdown, or by
 * clicking the map directly. The selected point is controlled by the parent so
 * callers can validate on it before submitting their own form. */
export function AddressMapPicker({
  point,
  onPick,
  height = 280,
}: {
  point: LatLng | null;
  /** Fires for both a search selection (with the hit) and a bare map click. */
  onPick: (p: LatLng, hit?: AddressHit) => void;
  height?: number;
}) {
  // Set only when the point comes from address search — drives map recentering.
  const [searchedPoint, setSearchedPoint] = useState<LatLng | null>(null);
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

  // Cancel any in-flight/debounced search if the component unmounts.
  useEffect(() => () => cancelSearch(), []);

  const pickResult = (hit: AddressHit) => {
    cancelSearch();
    const p = { lat: hit.lat, lng: hit.lng };
    setSearchedPoint(p);
    setQuery(hit.label);
    setOptions([]);
    setSearched(false);
    setSearching(false);
    onPick(p, hit);
  };

  const pickOnMap = (lat: number, lng: number) => {
    setSearchedPoint(null); // manual click shouldn't recenter the map
    onPick({ lat, lng });
  };

  const noOptionsText =
    query.trim().length < MIN_QUERY ? `Zadejte alespoň ${MIN_QUERY} znaky` : searched ? 'Adresu se nepodařilo najít' : 'Hledám…';

  return (
    <>
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
      <Box sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', mb: 2, '& .leaflet-container': { height, width: '100%' } }}>
        <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={10} attributionControl={false} style={{ height, width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickCapture onPick={pickOnMap} />
          {searchedPoint && <Recenter lat={searchedPoint.lat} lng={searchedPoint.lng} />}
          {point && <Marker position={[point.lat, point.lng]} icon={pinIcon()} />}
        </MapContainer>
      </Box>
    </>
  );
}
