// The client's ledger: what is still open with them, and what has been settled.
//
// Two sections, because they answer two different questions. Nedořešeno is a to-do list, so it
// leads and stays open. Historie is provenance, so it is collapsed — and it is the whole reason
// the tab is worth opening on a client nobody has a dispute with.

import { useState } from 'react';
import { Box, Button, Chip, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import { useSnackbar } from 'notistack';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { EmptyState } from 'src/components/common/EmptyState';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ledgerTargetLabel } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import {
  SetClientLedgerEntryResolutionDto,
  type ClientLedgerEntryDto,
} from 'src/generated/api-client';
import { useClientLedger, useSetClientLedgerEntryResolution } from 'src/hooks/useClientLedger';
import {
  entryDisplayName, entryTooltip, groupByOrder, isAssigned, isOpen, moneySummary, moneyText,
  plannedActualText,
} from './ledgerModel';
import type { LedgerOrderGroup } from './ledgerModel';
import { LedgerTag } from './LedgerDiff';
import { LedgerEntryDrawer } from './LedgerEntryDrawer';

/** One line of either section: what it is about, and what it says. */
function EntryRow({
  entry,
  editable,
  onResolve,
  onReopen,
  onOpenOrder,
  badge,
  showOrder = true,
}: {
  entry: ClientLedgerEntryDto;
  editable: boolean;
  onResolve: (entry: ClientLedgerEntryDto) => void;
  onReopen: (entry: ClientLedgerEntryDto) => void;
  onOpenOrder?: (orderId: string) => void;
  badge?: string;
  /** False under a group header that already names the order — see {@link OrderGroup}. */
  showOrder?: boolean;
}) {
  const { formatMoney } = useCurrency();
  const assigned = isAssigned(entry);
  const settled = !isOpen(entry);

  /** The order behind a point, reachable where the screen can open one. */
  const orderLink = (verb: string, orderId: string) => (onOpenOrder ? (
    <Button
      size="small"
      onClick={() => onOpenOrder(orderId)}
      sx={{ fontWeight: 700, minWidth: 0, px: 0.5, py: 0, fontSize: 12 }}
    >
      {verb}
      &nbsp;
      <Box component="span" sx={{ fontFamily: 'monospace' }}>{orderNumber(orderId)}</Box>
    </Button>
  ) : (
    <Typography variant="caption" color="text.secondary">
      {verb} {orderNumber(orderId)}
    </Typography>
  ));

  const headline = entry.amount != null
    ? `${moneyText(entry)} ${formatMoney(Math.abs(entry.amount))}`
    : entry.plannedText != null || entry.actualText != null
      ? 'Vyloženo jinde než v objednávce'
      : entry.plannedQuantity != null || entry.actualQuantity != null
        ? `${entryDisplayName(entry) ?? 'Položka'} — ${plannedActualText(entry)}`
        : (entry.note ?? 'Změna');

  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{headline}</Typography>
            <LedgerTag tone="info" label={ledgerTargetLabel(entry.target) ?? '—'} title={entryTooltip(entry)} />
            {badge && <Chip size="small" label={badge} sx={{ height: 20, fontWeight: 700 }} />}
            {/* An entry an order already carries closes itself when that order arrives, so it
                offers no manual close — settling it by hand would quietly bypass the link. The
                order is named, and reachable: "v řešení" is only useful with the where. */}
            {assigned && <LedgerTag tone="new" label="v řešení" />}
            {settled && <LedgerTag tone="more" label="vyřešeno" />}
            {/* Which order, in whichever tense applies. A point settled by hand on this profile
                has no order behind it and shows nothing — "vyřešeno" is the whole story there. */}
            {entry.resolvedByOrderId && orderLink(settled ? 'vyřešila' : 'vyřeší', entry.resolvedByOrderId)}
          </Stack>

          {entry.note && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {entry.note}
            </Typography>
          )}

          {/* What it says, when it says it, which delivery it came off — and who wrote it, which
              is the first question a disputed debt raises. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {[
              fmtDate(entry.createdAt),
              entry.createdByUserName,
              showOrder && !entry.orderId ? 'bez objednávky' : undefined,
              entry.resolvedAt ? `vyřešeno ${fmtDate(entry.resolvedAt)}` : undefined,
            ].filter(Boolean).join(' · ')}
          </Typography>
        </Box>

        {showOrder && entry.orderId && onOpenOrder && (
          <Button
            size="small"
            onClick={() => onOpenOrder(entry.orderId!)}
            sx={{ fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}
          >
            {orderNumber(entry.orderId)}
          </Button>
        )}

        {editable && !settled && !assigned && (
          <IconButton
            size="small"
            onClick={() => onResolve(entry)}
            aria-label="Vyřešit"
            sx={{ color: 'success.main', flexShrink: 0 }}
          >
            <CheckCircleIcon fontSize="small" />
          </IconButton>
        )}
        {editable && settled && (
          <IconButton
            size="small"
            onClick={() => onReopen(entry)}
            aria-label="Znovu otevřít"
            sx={{ color: 'text.secondary', flexShrink: 0 }}
          >
            <UndoIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}

/**
 * One order's entries under the order number they were written against.
 *
 * A flat list interleaves orders, so two disputed deliveries read as one pile and the reader has
 * to check the number line by line. The number is on the header once instead of on every row.
 */
function OrderGroup({
  group,
  editable,
  onResolve,
  onReopen,
  onOpenOrder,
}: {
  group: LedgerOrderGroup;
  editable: boolean;
  onResolve: (entry: ClientLedgerEntryDto) => void;
  onReopen: (entry: ClientLedgerEntryDto) => void;
  onOpenOrder?: (orderId: string) => void;
}) {
  return (
    <Box sx={{ pt: 2, '&:first-of-type': { pt: 0.5 } }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ pb: 0.5, borderBottom: 1, borderColor: 'divider' }}
      >
        {group.orderId && onOpenOrder ? (
          <Button
            size="small"
            onClick={() => onOpenOrder(group.orderId!)}
            sx={{ fontWeight: 700, minWidth: 0, px: 0.5, ml: -0.5 }}
          >
            Objednávka&nbsp;
            <Box component="span" sx={{ fontFamily: 'monospace' }}>{orderNumber(group.orderId)}</Box>
          </Button>
        ) : (
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary' }}>
            {group.orderId ? `Objednávka ${orderNumber(group.orderId)}` : 'Bez objednávky'}
          </Typography>
        )}

        {/* The run's date, not the order's promised one: it is when these goods actually go out. */}
        {group.shipmentDeliveryDate && (
          <Typography variant="caption" color="text.secondary">
            vývoz {fmtDate(group.shipmentDeliveryDate)}
          </Typography>
        )}
      </Stack>

      <Box sx={{ pl: 1.25 }}>
        {group.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            editable={editable}
            onResolve={onResolve}
            onReopen={onReopen}
            // Still handed down with the source order suppressed: the row's own link is to the
            // order *settling* it, which is a different order from the group's.
            onOpenOrder={onOpenOrder}
            showOrder={false}
          />
        ))}
      </Box>
    </Box>
  );
}

/**
 * The client's whole ledger. Reads 'all', not 'open': the history is half the point, and the
 * open list is derived from it rather than fetched twice.
 */
export function LedgerPanel({
  clientId,
  clientName,
  editable,
  onOpenOrder,
}: {
  clientId: string;
  clientName: string;
  editable: boolean;
  onOpenOrder?: (orderId: string) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const ledger = useClientLedger(clientId, 'all');
  const setResolution = useSetClientLedgerEntryResolution();
  const [recording, setRecording] = useState(false);

  const setResolved = async (entry: ClientLedgerEntryDto, resolved: boolean) => {
    try {
      await setResolution.mutateAsync({
        id: entry.id!,
        clientId,
        data: new SetClientLedgerEntryResolutionDto({ resolved }),
      });
      enqueueSnackbar(resolved ? 'Vyřešeno.' : 'Znovu otevřeno.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <>
      <QueryBoundary query={ledger}>
        {(entries) => {
          const open = entries.filter(isOpen);
          const history = entries.filter((e) => !isOpen(e));
          // Computed from the rows, never stored — a saved balance is a second truth that drifts
          // from the rows it summarises.
          const money = moneySummary(open);

          return (
            <Stack spacing={2.5}>
              <CollapsibleCard
                title="Nedořešeno"
                count={open.length}
                action={editable && (
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setRecording(true)} sx={{ fontWeight: 700 }}>
                    Nový dluh
                  </Button>
                )}
              >
                {/* Both directions, side by side and never netted: "you owe me 500 and I owe you
                    500" is two things to settle, not nothing. */}
                {(money.owedByClient > 0 || money.owedToClient > 0) && (
                  <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 2 }} flexWrap="wrap" useFlexGap>
                    {money.owedByClient > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Klient dluží</Typography>
                        <Typography sx={{ fontWeight: 800, color: 'error.main' }}>
                          {formatMoney(money.owedByClient)}
                        </Typography>
                      </Box>
                    )}
                    {money.owedToClient > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Dlužíme klientovi</Typography>
                        <Typography sx={{ fontWeight: 800, color: 'info.main' }}>
                          {formatMoney(money.owedToClient)}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                )}

                <Box sx={{ px: 2.5, py: 1 }}>
                  {open.length === 0 ? (
                    <EmptyState title="Nic nedořešeného" description="U tohoto klienta nejsou otevřené body." />
                  ) : (
                    // By order, newest first: the thing that just happened is the thing being
                    // asked about, and it is asked about one delivery at a time.
                    groupByOrder(open).map((group) => (
                      <OrderGroup
                        key={group.orderId ?? 'no-order'}
                        group={group}
                        editable={editable}
                        onResolve={(e) => setResolved(e, true)}
                        onReopen={(e) => setResolved(e, false)}
                        onOpenOrder={onOpenOrder}
                      />
                    ))
                  )}
                </Box>
              </CollapsibleCard>

              {/* Collapsed by default: provenance rather than a to-do list. */}
              <CollapsibleCard title="Historie" count={history.length} defaultExpanded={false}>
                <Box sx={{ px: 2.5, py: 1 }}>
                  {history.length === 0 ? (
                    <EmptyState title="Žádná historie" description="U tohoto klienta nebyla vyřešena žádná změna." />
                  ) : (
                    groupByOrder(history).map((group) => (
                      <OrderGroup
                        key={group.orderId ?? 'no-order'}
                        group={group}
                        editable={editable}
                        onResolve={(e) => setResolved(e, true)}
                        onReopen={(e) => setResolved(e, false)}
                        onOpenOrder={onOpenOrder}
                      />
                    ))
                  )}
                </Box>
              </CollapsibleCard>
            </Stack>
          );
        }}
      </QueryBoundary>

      {/* No order in context: this is where a debt with no delivery behind it gets opened —
          the case an order note could never carry. */}
      <LedgerEntryDrawer
        open={recording}
        context={{ clientId, clientName }}
        onClose={() => setRecording(false)}
      />
    </>
  );
}
