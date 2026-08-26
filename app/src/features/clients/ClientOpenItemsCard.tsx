// What is still open with this client, on the order screen.
//
// It replaces the order detail's old client block rather than sitting under it. The client's name
// is in the page title and links from the meta line, and their billing address is one click away
// — none of that is something the order screen alone can tell you. What is still open with them
// is, so that is all the card holds. With nothing open there is no card.
//
// It lists what is open from ELSEWHERE — earlier orders, and debts that belong to no order at all.
// This order's own deviations are not news to a reader looking at this order: its quantities are
// the struck-through rows in Položky and Vratky above, and its money and notes are in the Peníze
// card. What this card answers is the other question: what does this delivery have to put right.

import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import { useSnackbar } from 'notistack';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ledgerTargetLabel } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import {
  SetClientLedgerEntryAssignmentDto,
  type ClientLedgerEntryDto,
} from 'src/generated/api-client';
import { useSetClientLedgerEntryAssignment } from 'src/hooks/useClientLedger';
import { entryTooltip, isAssigned, isOpen, moneySummary } from './ledgerModel';
import { LedgerTag } from './LedgerDiff';

/** One line of the client's open list, in the order screen's own voice. */
function headlineOf(entry: ClientLedgerEntryDto, formatMoney: (v: number) => string): string {
  if (entry.amount != null) {
    return `${entry.amount >= 0 ? 'Klient dluží' : 'Dlužíme klientovi'} ${formatMoney(Math.abs(entry.amount))}`;
  }
  if (entry.plannedQuantity != null || entry.actualQuantity != null) {
    const missing = (entry.plannedQuantity ?? 0) - (entry.actualQuantity ?? 0);
    const name = entry.productName ?? entry.lineName ?? 'Položka';
    return missing > 0 ? `${name} — chybí ${missing} ks` : `${name} — navíc ${-missing} ks`;
  }
  return entry.note ?? 'Změna';
}

export function ClientOpenItemsCard({
  entries,
  clientId,
  currentOrderId,
  editable,
}: {
  /** The client's whole ledger; the card picks the open rows out of it itself. */
  entries: ClientLedgerEntryDto[];
  clientId: string;
  currentOrderId?: string;
  editable: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const setAssignment = useSetClientLedgerEntryAssignment();

  // Everything still open except this order's own. An entry with no order stays: a standalone
  // debt is exactly the kind of thing the next delivery is meant to clear.
  const open = entries.filter((e) => isOpen(e) && e.orderId !== currentOrderId);
  if (open.length === 0) return null;

  const money = moneySummary(open);

  /**
   * Promises that this order will settle the entry — or takes the promise back.
   *
   * Deliberately not a close. An entry settled the moment somebody ticked it would stay settled
   * even if this order were cancelled, which is the failure the whole feature exists to prevent;
   * the server closes it when the run actually arrives. Settling something by hand — cash taken,
   * a keg written off — is the client profile's business, not this screen's.
   */
  const assign = async (entry: ClientLedgerEntryDto, orderId: string | undefined) => {
    try {
      await setAssignment.mutateAsync({
        id: entry.id!,
        clientId,
        data: new SetClientLedgerEntryAssignmentDto({ orderId }),
      });
      enqueueSnackbar(orderId ? 'Vyřeší tato objednávka.' : 'Vyřazeno z objednávky.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <CollapsibleCard
      title="Nedořešeno u klienta"
      count={open.length}
      icon={<WarningAmberIcon fontSize="small" sx={{ color: 'warning.dark' }} />}
    >
      {(money.owedByClient > 0 || money.owedToClient > 0) && (
        <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 1.5 }} flexWrap="wrap" useFlexGap>
          {money.owedByClient > 0 && (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Klient dluží{' '}
              <Box component="span" sx={{ color: 'error.main' }}>{formatMoney(money.owedByClient)}</Box>
            </Typography>
          )}
          {money.owedToClient > 0 && (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Dlužíme klientovi{' '}
              <Box component="span" sx={{ color: 'info.main' }}>{formatMoney(money.owedToClient)}</Box>
            </Typography>
          )}
        </Stack>
      )}

      <Box
        sx={{
          px: 2.5,
          py: 1,
          '& > div': { py: 1.25, borderBottom: 1, borderColor: 'divider' },
          '& > div:last-of-type': { borderBottom: 0 },
        }}
      >
        {[...open]
          .sort((a, b) => Number(new Date(b.createdAt ?? 0)) - Number(new Date(a.createdAt ?? 0)))
          .map((entry) => {
            const assigned = isAssigned(entry);
            const carriedHere = assigned && entry.resolvedByOrderId === currentOrderId;

            return (
              <Box key={entry.id}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                        {headlineOf(entry, formatMoney)}
                      </Typography>
                      <LedgerTag
                        tone="info"
                        label={ledgerTargetLabel(entry.target) ?? '—'}
                        title={entryTooltip(entry)}
                      />
                      {/* Carried by an order: it settles itself when that order arrives. This
                          order's promise can be taken back; another order's is that order's
                          business, and closing it here would quietly bypass the link. */}
                      {assigned && (
                        <LedgerTag
                          tone="new"
                          label={carriedHere ? 'vyřeší tato objednávka' : 'zařazeno'}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {[
                        fmtDate(entry.createdAt),
                        entry.orderId ? orderNumber(entry.orderId) : 'bez objednávky',
                        entry.createdByUserName,
                      ].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>

                  {/* Only ever about this order: with no order in view there is nothing to
                      promise, and another order's promise is not this screen's to undo. */}
                  {editable && currentOrderId && !assigned && (
                    <Tooltip title="Vyřeší se, až tato objednávka a její vývoz doběhnou.">
                      <IconButton
                        size="small"
                        onClick={() => assign(entry, currentOrderId)}
                        aria-label="Vyřeší tato objednávka"
                        sx={{ color: 'success.main', flexShrink: 0 }}
                      >
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {editable && carriedHere && (
                    <Tooltip title="Vyřadit z této objednávky.">
                      <IconButton
                        size="small"
                        onClick={() => assign(entry, undefined)}
                        aria-label="Vyřadit z objednávky"
                        sx={{ color: 'text.disabled', flexShrink: 0 }}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            );
          })}
      </Box>
    </CollapsibleCard>
  );
}
