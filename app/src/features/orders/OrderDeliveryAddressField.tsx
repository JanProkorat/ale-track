import { useState } from 'react';
import { Box, ListSubheader, MenuItem, Select, Stack, Typography } from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { DeliveryAddressKind } from 'src/generated/api-client';
import { useClient } from 'src/hooks/useClients';
import { useClientDeliveryPlaces } from 'src/hooks/useDeliveryPlaces';
import { DeliveryPlaceDialog } from 'src/components/common/DeliveryPlaceDialog';
import { NEW_PLACE_CHOICE, decodeStopChoice, encodeStopChoice, resolveOrderDeliveryAddress } from 'src/features/clients/deliveryAddress';

// The order's delivery address picker. Deliberately a near-copy of the
// shipment editor's stop picker (ShipmentEditor.tsx) — same options, same
// wording, same `place:<id>` encoding — because they are the same choice made
// at two moments, and a user who learns one must recognise the other.

export function OrderDeliveryAddressField({
  clientId,
  value,
  onChange,
  disabled,
  deletedPlaceName,
}: {
  clientId: string | null;
  value: { kind: DeliveryAddressKind; placeId?: string };
  onChange: (v: { kind: DeliveryAddressKind; placeId?: string }) => void;
  disabled?: boolean;
  /** Name of the order's chosen place as it was when the order was loaded —
   *  `OrderDto.deliveryAddress.placeName`, which the backend sets even when
   *  the place has since been soft-deleted. Labels the "(smazáno)" entry with
   *  the real name instead of a generic placeholder. Undefined for a
   *  freshly-created order (there is nothing loaded to remember). */
  deletedPlaceName?: string;
}) {
  const clientQuery = useClient(clientId ?? undefined);
  const placesQuery = useClientDeliveryPlaces(clientId ?? undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const places = placesQuery.data ?? [];
  const official = clientQuery.data?.officialAddress;
  const contact = clientQuery.data?.contactAddress;
  const resolved = resolveOrderDeliveryAddress(official, contact, places, value.kind, value.placeId);

  // A place soft-deleted since this order chose it is absent from `places`.
  // Without a disabled entry carrying it, the Select's value matches no option
  // and re-saving would silently relocate the delivery to the billing address.
  //
  // Gated on the places query not being in-flight: while it's still loading,
  // `places` is coerced to `[]` and a perfectly valid place would otherwise
  // flash as "gone" — the field briefly shows a disabled "Smazané místo" entry
  // and the caption briefly falls back to the billing address.
  const isGone = !placesQuery.isLoading
    && value.kind === DeliveryAddressKind.DeliveryPlace
    && value.placeId != null
    && !places.some((p) => p.id === value.placeId);

  // The kind the order is already saved with, when the client can no longer satisfy it: an
  // Official order whose client lost its official address on being linked to a payer. Same
  // shape as `isGone` one level up — the backend accepts it (every read path falls back to the
  // other address), so it stays visibly selected instead of leaving the <Select> blank.
  const goneKind = clientQuery.isLoading ? null
    : value.kind === DeliveryAddressKind.Official && !official ? DeliveryAddressKind.Official
      : value.kind === DeliveryAddressKind.Contact && !contact ? DeliveryAddressKind.Contact
        : null;

  // A client with none of the three hides every standard option — only "+ Nové místo…" is
  // left — while the form still defaults `value.kind` to `Official` (see `defaultAddressKind`
  // in deliveryAddress.ts), so the <Select> shows no visible text at all with nothing else on
  // screen to say why. This is the one screen that actually causes that state (a freshly
  // linked sub-client with no delivery place yet is a normal state this feature introduces),
  // so it is the one that warns about it rather than leaving a silently blank control.
  // Gated on neither query still loading, same reasoning as `isGone` above.
  const hasNoAddressAtAll = !clientQuery.isLoading && !placesQuery.isLoading
    && !official && !contact && places.length === 0;

  const handleChange = (raw: string) => {
    if (raw === NEW_PLACE_CHOICE) { setDialogOpen(true); return; }
    const { addressKind, deliveryPlaceId } = decodeStopChoice(raw);
    onChange({ kind: addressKind, placeId: deliveryPlaceId });
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.75 }}>Adresa doručení</Typography>
      <Select
        size="small"
        fullWidth
        disabled={disabled || !clientId}
        value={encodeStopChoice(value.kind, value.placeId)}
        onChange={(e) => handleChange(e.target.value)}
      >
        {official && <MenuItem value="Official">Fakturační</MenuItem>}
        {contact && <MenuItem value="Contact">Kontaktní</MenuItem>}
        {goneKind === DeliveryAddressKind.Official
          && <MenuItem value="Official" disabled>Fakturační (chybí adresa)</MenuItem>}
        {goneKind === DeliveryAddressKind.Contact
          && <MenuItem value="Contact" disabled>Kontaktní (chybí adresa)</MenuItem>}
        {places.length > 0 && [
          <ListSubheader key="places-header">Vlastní místa</ListSubheader>,
          ...places.map((p) => (
            <MenuItem key={p.id} value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, p.id)}>{p.name}</MenuItem>
          )),
        ]}
        {isGone && [
          <ListSubheader key="gone-header">Smazané</ListSubheader>,
          <MenuItem key="gone-item" value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, value.placeId)} disabled>
            {(deletedPlaceName ?? 'Smazané místo') + ' (smazáno)'}
          </MenuItem>,
        ]}
        <MenuItem value={NEW_PLACE_CHOICE}>+ Nové místo…</MenuItem>
      </Select>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {clientId ? resolved.text : 'Nejprve vyberte klienta.'}
      </Typography>
      {hasNoAddressAtAll && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
          <WarningAmberOutlinedIcon
            aria-label="Klient nemá vyplněnou dodací adresu"
            sx={{ fontSize: 13, color: 'warning.main' }}
          />
          <Typography sx={{ fontSize: 11.5, color: 'warning.main' }}>
            Klient nemá vyplněnou dodací adresu
          </Typography>
        </Stack>
      )}
      {resolved.placeNote && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {resolved.placeNote}
        </Typography>
      )}
      {clientId && (
        <DeliveryPlaceDialog
          open={dialogOpen}
          clientId={clientId}
          clientName={clientQuery.data?.name}
          onClose={() => setDialogOpen(false)}
          onSaved={(placeId) => {
            setDialogOpen(false);
            onChange({ kind: DeliveryAddressKind.DeliveryPlace, placeId });
          }}
        />
      )}
    </Box>
  );
}
