import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import { useSnackbar } from 'notistack';
import { AddressMapPicker } from 'src/components/common/AddressMapPicker';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { type AddressHit, type LatLng } from 'src/lib/geo';
import { AddressDto, Country, SaveClientDeliveryPlaceDto, type ClientDeliveryPlaceDto } from 'src/generated/api-client';
import { useCreateDeliveryPlace, useUpdateDeliveryPlace } from 'src/hooks/useDeliveryPlaces';

// Duplicated locally rather than shared — same small, one-off list as
// ClientFormDrawer's COUNTRY_OPTIONS.
const COUNTRY_OPTIONS = [
  { value: String(Country.Czechia), label: 'Česko' },
  { value: String(Country.Germany), label: 'Německo' },
];

/** Create/edit a client's own delivery place — a named drop-off point offered
 * alongside the official/contact address when picking a shipment stop.
 * Ports `deliveryPlaceForm`/`dpRender` from the prototype: helper line, the
 * shared address map picker, a coordinate readout with a "clear point"
 * action, the name/note fields, then an optional address section. */
export function DeliveryPlaceDialog({
  open,
  clientId,
  clientName,
  place,
  onClose,
  onSaved,
}: {
  open: boolean;
  clientId: string;
  /** Shown bold in the helper line, matching the prototype's
   * `${esc(cl.name)}` — optional since not every caller has it in hand
   * (e.g. a bare clientId with no loaded client record). */
  clientName?: string;
  place?: ClientDeliveryPlaceDto;
  onClose: () => void;
  onSaved?: (placeId: string) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateDeliveryPlace();
  const update = useUpdateDeliveryPlace();
  const busy = create.isPending || update.isPending;

  const [point, setPoint] = useState<LatLng | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [streetName, setStreetName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState<Country>(Country.Czechia);

  // Snapshot the dialog's fields from `place` on the open transition only —
  // deliberately keyed on `open` alone (not on `place`), so a background
  // refetch of the places list while the dialog is open doesn't hand us a
  // new `place` object reference and wipe out in-progress edits.
  useEffect(() => {
    if (!open) return;
    const a = place?.address;
    setName(place?.name ?? '');
    setNote(place?.note ?? '');
    setStreetName(a?.streetName ?? '');
    setStreetNumber(a?.streetNumber ?? '');
    setCity(a?.city ?? '');
    setZip(a?.zip ?? '');
    setCountry(a?.country ?? Country.Czechia);
    setPoint(a?.latitude != null && a?.longitude != null ? { lat: a.latitude, lng: a.longitude } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fires for both a search selection (with the hit) and a bare map click.
  // Only a search hit carries structured postal parts, so only that path
  // prefills the address fields — a bare click just moves the point.
  const handlePick = (p: LatLng, hit?: AddressHit) => {
    setPoint(p);
    if (hit?.parts) {
      setStreetName(hit.parts.streetName ?? '');
      setStreetNumber(hit.parts.streetNumber ?? '');
      setCity(hit.parts.city ?? '');
      setZip(hit.parts.zip ?? '');
      if (hit.parts.country != null) setCountry(hit.parts.country);
    }
  };

  const confirm = async () => {
    if (!name.trim()) {
      enqueueSnackbar('Zadejte název místa', { variant: 'warning' });
      return;
    }
    if (!point) {
      enqueueSnackbar('Určete bod v mapě nebo vyberte adresu', { variant: 'warning' });
      return;
    }
    const data = new SaveClientDeliveryPlaceDto({
      name: name.trim(),
      note: note.trim() || undefined,
      address: new AddressDto({
        streetName: streetName.trim(),
        streetNumber: streetNumber.trim(),
        city: city.trim(),
        zip: zip.trim(),
        country,
        latitude: point.lat,
        longitude: point.lng,
      }),
      latitude: point.lat,
      longitude: point.lng,
      country,
    });
    try {
      if (place?.id) {
        await update.mutateAsync({ id: place.id, clientId, data });
        enqueueSnackbar('Místo upraveno.', { variant: 'success' });
        onSaved?.(place.id);
      } else {
        const id = await create.mutateAsync({ clientId, data });
        enqueueSnackbar('Místo přidáno ke klientovi.', { variant: 'success' });
        onSaved?.(id);
      }
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box component="span" sx={{ flex: 1 }}>{place ? 'Upravit místo doručení' : 'Nové místo doručení'}</Box>
        <IconButton onClick={onClose} disabled={busy} aria-label="Zavřít" size="small">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ fontSize: 12.5, mb: 1.5 }}>
          Místo se uloží ke klientovi{clientName ? <> <Box component="b">{clientName}</Box></> : null} a půjde vybrat u kterékoli jeho zastávky.
        </Typography>

        <AddressMapPicker point={point} onPick={handlePick} />

        {point && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip size="small" label={`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`} sx={{ fontFamily: 'monospace' }} />
            <Button size="small" color="inherit" startIcon={<CloseIcon sx={{ fontSize: 14 }} />} onClick={() => setPoint(null)}>
              Zrušit bod
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Název místa"
            required
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Letní zahrádka"
          />
          <TextField
            label="Poznámka pro řidiče"
            fullWidth
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Vjezd zezadu, brána od 8:00"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary', mb: 1.5 }}>
          Adresa{' '}
          <Box component="span" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
            — nepovinná, místo bez adresy stačí určit bodem v mapě
          </Box>
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField label="Ulice" fullWidth size="small" value={streetName} onChange={(e) => setStreetName(e.target.value)} placeholder="Nábřežní" />
          <TextField label="Číslo" fullWidth size="small" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} placeholder="3" />
          <TextField label="Město" fullWidth size="small" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Žitava" />
          <TextField label="PSČ" fullWidth size="small" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="02763" />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Combobox
              label="Země"
              value={String(country)}
              onChange={(v) => setCountry(v ? (Number(v) as Country) : Country.Czechia)}
              options={COUNTRY_OPTIONS}
              clearable={false}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} color="inherit">Zrušit</Button>
        <Button variant="contained" startIcon={<CheckIcon />} onClick={confirm} disabled={busy}>
          {busy ? 'Ukládám…' : 'Uložit místo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
