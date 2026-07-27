import { useState } from 'react';
import { Box, ListSubheader, MenuItem, Select, Typography } from '@mui/material';
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
}: {
  clientId: string | null;
  value: { kind: DeliveryAddressKind; placeId?: string };
  onChange: (v: { kind: DeliveryAddressKind; placeId?: string }) => void;
  disabled?: boolean;
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
  const isGone = value.kind === DeliveryAddressKind.DeliveryPlace
    && value.placeId != null
    && !places.some((p) => p.id === value.placeId);

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
        <MenuItem value="Official">Fakturační</MenuItem>
        {contact && <MenuItem value="Contact">Kontaktní</MenuItem>}
        {places.length > 0 && [
          <ListSubheader key="places-header">Vlastní místa</ListSubheader>,
          ...places.map((p) => (
            <MenuItem key={p.id} value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, p.id)}>{p.name}</MenuItem>
          )),
        ]}
        {isGone && [
          <ListSubheader key="gone-header">Smazané</ListSubheader>,
          <MenuItem key="gone-item" value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, value.placeId)} disabled>
            {'Smazané místo (smazáno)'}
          </MenuItem>,
        ]}
        <MenuItem value={NEW_PLACE_CHOICE}>+ Nové místo…</MenuItem>
      </Select>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {clientId ? resolved.text : 'Nejprve vyberte klienta.'}
      </Typography>
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
