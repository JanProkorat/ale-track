// "Fakturační adresa pro …" — the sub-client addresses a payer's invoice names.
//
// A head client that pays for several sub-clients has to raise its own invoices
// against them, and asks us which addresses those are. The office ticks them here;
// the choice rides along on the invoice.
//
// Its own file rather than another block inside ShipmentInvoicing.tsx for two
// reasons: that file is already long (app/CLAUDE.md's 500-line rule), and the
// option list needs the payer's client detail — a hook, which cannot be called
// from inside the band `map`. One component per band gives each its own query,
// deduplicated by TanStack Query when two bands share a payer.

import { useState } from 'react';
import { FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { apiErrorMessage } from 'src/api/errors';
import { formatStreetAddress } from 'src/features/clients/deliveryPlaceFormat';
import { useClient } from 'src/hooks/useClients';
import { useSetInvoiceBillingRecipients } from 'src/hooks/useShipmentInvoices';
import {
  billingRecipientIds,
  billingRecipientInvoice,
  billingRecipientOptions,
  type ClientBand,
} from './shipmentInvoiceModel';

export function BandBillingRecipients({ shipmentId, band, canEdit }: {
  shipmentId: string;
  band: ClientBand;
  /** The Fakturace panel's own edit rule — this section follows it, it has no second one. */
  canEdit: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: client } = useClient(band.clientId || undefined);
  const save = useSetInvoiceBillingRecipients(shipmentId);

  const invoice = billingRecipientInvoice(band);
  const options = billingRecipientOptions(client);
  const savedIds = billingRecipientIds(invoice);
  const savedKey = savedIds.join(',');

  // The saved selection starts the section open: hidden behind an off toggle it would
  // simply be invisible until someone thought to flip it.
  const [shown, setShown] = useState(savedIds.length > 0);
  // Local selection, re-seeded whenever the server's differs — the mutation invalidates
  // the invoice query, so the saved list is what wins after every save.
  const [selected, setSelected] = useState<string[]>(savedIds);
  const [seededKey, setSeededKey] = useState(savedKey);
  if (seededKey !== savedKey) {
    setSeededKey(savedKey);
    setSelected(savedIds);
  }

  // A toggle that could only ever open an empty dropdown is worse than no toggle.
  if (!invoice || options.length === 0) return null;
  // Read-only and nothing chosen: there is nothing to show and nothing to do.
  if (!canEdit && savedIds.length === 0) return null;

  const commit = (ids: string[]) => {
    setSelected(ids);
    save.mutate(
      { invoiceId: invoice.id!, clientIds: ids },
      {
        onError: (e) => {
          setSelected(savedIds);
          enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
        },
      },
    );
  };

  const label = `Fakturační adresa pro ${band.clientName}`;

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={shown}
            disabled={!canEdit}
            onChange={(e) => setShown(e.target.checked)}
          />
        }
        label={
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Fakturační adresy sub-klientů
          </Typography>
        }
        sx={{ ml: 0, mr: 0, alignSelf: 'flex-start' }}
      />

      {shown && (
        <TextField
          select
          size="small"
          label={label}
          value={selected}
          disabled={!canEdit || save.isPending}
          onChange={(e) => {
            const value = e.target.value;
            commit(typeof value === 'string' ? value.split(',') : (value as unknown as string[]));
          }}
          slotProps={{
            select: {
              multiple: true,
              // Names alone in the closed field: the addresses are long, and the menu
              // is where the office compares them.
              renderValue: (value) => {
                const ids = value as string[];
                if (ids.length === 0) return 'Nevybráno';
                return options
                  .filter((o) => ids.includes(o.id!))
                  .map((o) => o.name ?? '—')
                  .join(', ');
              },
            },
          }}
          sx={{ maxWidth: 480 }}
        >
          {options.map((sub) => (
            <MenuItem key={sub.id} value={sub.id}>
              <Stack sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{sub.name}</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {formatStreetAddress(sub.officialAddress)}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}
