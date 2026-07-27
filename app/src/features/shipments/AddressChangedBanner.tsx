import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material';
import { type OutgoingShipmentStopDto } from 'src/generated/api-client';
import { useAcknowledgeAddressChanges } from 'src/hooks/useShipments';

// Raised when an order edit changed a delivery address under this shipment.
// Two messages, because an inherited stop has already been corrected while an
// overridden one has deliberately *not* been — and the second is the case
// nobody would otherwise notice.

export function AddressChangedBanner({
  shipmentId,
  stops,
}: {
  shipmentId: string;
  stops: OutgoingShipmentStopDto[];
}) {
  const acknowledge = useAcknowledgeAddressChanges();
  const changed = stops.filter((s) => s.addressChangedAt);
  if (changed.length === 0) return null;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button
          size="small"
          color="inherit"
          disabled={acknowledge.isPending}
          onClick={() => { void acknowledge.mutateAsync(shipmentId); }}
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
            ? 'objednávka má jinou adresu doručení než tato zastávka.'
            : 'adresa doručení byla aktualizována podle objednávky.'}
        </Typography>
      ))}
    </Alert>
  );
}
