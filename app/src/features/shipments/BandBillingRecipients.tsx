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
//
// It renders two pieces the header wants in two different spots — a chip among
// the header's other pills, and a quiet "Fakturovat na" line under the address —
// off the *same* state (one query, one mutation, one in-flight selection). A
// `children` render-prop is how it hands both back to the caller without either
// splitting that state across two mounted instances (which could show the chip
// and the line disagreeing for a moment) or growing ShipmentInvoicing.tsx with
// the hook logic itself.

import { useState, type ReactNode } from 'react';
import { Checkbox, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { apiErrorMessage } from 'src/api/errors';
import { formatStreetAddress } from 'src/features/clients/deliveryPlaceFormat';
import { useClient } from 'src/hooks/useClients';
import { useSetInvoiceBillingRecipients } from 'src/hooks/useShipmentInvoices';
import { plural } from 'src/lib/format';
import { Pill } from './Pill';
import {
  billingRecipientIds,
  billingRecipientInvoice,
  billingRecipientOptions,
  type ClientBand,
} from './shipmentInvoiceModel';

export interface BandBillingRecipientsSlots {
  /**
   * The header pill — absent when the payer has no addressable sub-clients, and also
   * while read-only with nothing chosen (it would show empty state that can never be filled).
   */
  chip: ReactNode;
  /** The "Fakturovat na: …" line — absent whenever nothing is chosen. */
  invoicedToLine: ReactNode;
}

export function BandBillingRecipients({ shipmentId, band, canEdit, children }: {
  shipmentId: string;
  band: ClientBand;
  /** The Fakturace panel's own edit rule — this section follows it, it has no second one. */
  canEdit: boolean;
  children: (slots: BandBillingRecipientsSlots) => ReactNode;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: client } = useClient(band.clientId || undefined);
  const save = useSetInvoiceBillingRecipients(shipmentId);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const invoice = billingRecipientInvoice(band);
  const options = billingRecipientOptions(client);
  const savedIds = billingRecipientIds(invoice);
  const savedKey = savedIds.join(',');

  // Local selection, re-seeded whenever the server's differs — the mutation invalidates
  // the invoice query, so the saved list is what wins after every save.
  const [selected, setSelected] = useState<string[]>(savedIds);
  const [seededKey, setSeededKey] = useState(savedKey);
  if (seededKey !== savedKey) {
    setSeededKey(savedKey);
    setSelected(savedIds);
  }

  // A chip that could only ever open an empty menu is worse than no chip.
  if (!invoice || options.length === 0) {
    return <>{children({ chip: null, invoicedToLine: null })}</>;
  }

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

  const toggle = (id: string) => {
    commit(selected.includes(id) ? selected.filter((existing) => existing !== id) : [...selected, id]);
  };

  const selectedNames = options
    .filter((o) => selected.includes(o.id!))
    .map((o) => o.name ?? '—');

  const chipLabel = selectedNames.length === 0
    ? 'Fakturační adresy'
    : `${selectedNames.length} ${plural(selectedNames.length, 'fakturační adresa', 'fakturační adresy', 'fakturačních adres')}`;

  // Read-only and nothing chosen: the chip could never be filled in from here, so it
  // would only ever state an empty value. Keep it once it carries a real selection.
  const showChip = canEdit || selectedNames.length > 0;

  const chip = !showChip ? null : (
    <>
      <Pill
        tint="infoTint"
        color="info.main"
        // Read-only: the chip stays a plain, unfocusable span — it shows state, not a control.
        onClick={canEdit ? (e) => setAnchorEl(e.currentTarget) : undefined}
      >
        {chipLabel}
      </Pill>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((sub) => (
          <MenuItem key={sub.id} onClick={() => toggle(sub.id!)} disabled={save.isPending} dense>
            <Checkbox
              size="small"
              checked={selected.includes(sub.id!)}
              disableRipple
              sx={{ p: 0.5, mr: 1 }}
              inputProps={{ 'aria-label': sub.name ?? undefined }}
            />
            <Stack sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{sub.name}</Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                {formatStreetAddress(sub.officialAddress)}
              </Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </>
  );

  const invoicedToLine = selectedNames.length > 0 ? (
    <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.25 }}>
      Fakturovat na: {selectedNames.join(', ')}
    </Typography>
  ) : null;

  return <>{children({ chip, invoicedToLine })}</>;
}
