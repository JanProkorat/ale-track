import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { type OutgoingShipmentStopDto } from 'src/generated/api-client';
import { apiErrorMessage } from 'src/api/errors';
import { useAcknowledgeAddressChanges } from 'src/hooks/useShipments';
import { formatAddressOrCoords } from 'src/features/clients/deliveryPlaceFormat';

// Raised when an order edit changed a delivery address under this shipment.
// Two messages, because an inherited stop has already been corrected while an
// overridden one has deliberately *not* been — and the second is the case
// nobody would otherwise notice.

/** For the overridden case, names what the order now wants rather than
 * merely asserting a difference — `stop.orderDeliveryAddress` is projected by
 * the backend precisely so this line doesn't have to guess. Mirrors
 * `resolveStopAddress`'s `name · address` shape for a saved place. */
function orderAddressLine(s: OutgoingShipmentStopDto): string {
  const addr = s.orderDeliveryAddress;
  if (!addr) return '';
  const formatted = formatAddressOrCoords(addr.address);
  return addr.placeName ? `${addr.placeName} · ${formatted}` : formatted;
}

export function AddressChangedBanner({
  shipmentId,
  stops,
}: {
  shipmentId: string;
  stops: OutgoingShipmentStopDto[];
}) {
  const acknowledge = useAcknowledgeAddressChanges();
  const { enqueueSnackbar } = useSnackbar();
  const changed = stops.filter((s) => s.addressChangedAt);
  if (changed.length === 0) return null;

  // The optimistic update in useAcknowledgeAddressChanges hides the banner
  // immediately and rolls back if the call fails, so a silent rejection would
  // look exactly like the notice reappearing for no reason. Say what happened.
  const dismiss = async () => {
    try {
      await acknowledge.mutateAsync(shipmentId);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, 'Upozornění se nepodařilo skrýt'), { variant: 'error' });
    }
  };

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button
          size="small"
          color="inherit"
          disabled={acknowledge.isPending}
          onClick={() => { void dismiss(); }}
        >
          Rozumím
        </Button>
      }
    >
      <AlertTitle sx={{ fontWeight: 700 }}>Změna adresy doručení</AlertTitle>
      {changed.map((s) => (
        <Typography key={s.id} sx={{ fontSize: 13.5 }}>
          <Box component="span" sx={{ fontWeight: 700 }}>{s.clientName ?? '—'}</Box>
          {': '}
          {s.isAddressOverridden
            ? `objednávka má jinou adresu doručení než tato zastávka (${orderAddressLine(s)}).`
            : 'adresa doručení byla aktualizována podle objednávky.'}
        </Typography>
      ))}
    </Alert>
  );
}
