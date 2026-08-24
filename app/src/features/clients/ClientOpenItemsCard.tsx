// What is still open with this client, on the order screen.
//
// It replaces the order detail's old client block rather than sitting under it. The client's name
// is in the page title and links from the meta line, and their billing address is one click away
// — none of that is something the order screen alone can tell you. What is still open with them
// is, so that is all the card holds. With nothing open there is no card.
//
// It lists the client's WHOLE open list, not just this order's: what makes it worth reading is the
// part that happened elsewhere — everything from this order is already struck through above. Rows
// belonging to the order being viewed are badged, so the reader can tell at a glance what is news.

import { Box, IconButton, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import { useSnackbar } from 'notistack';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ledgerTargetLabel } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import {
  SetClientLedgerEntryResolutionDto,
  type ClientLedgerEntryDto,
} from 'src/generated/api-client';
import { useSetClientLedgerEntryResolution } from 'src/hooks/useClientLedger';
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
  const setResolution = useSetClientLedgerEntryResolution();

  const open = entries.filter(isOpen);
  if (open.length === 0) return null;

  const money = moneySummary(open);

  const resolve = async (entry: ClientLedgerEntryDto) => {
    try {
      await setResolution.mutateAsync({
        id: entry.id!,
        clientId,
        data: new SetClientLedgerEntryResolutionDto({ resolved: true }),
      });
      enqueueSnackbar('Vyřešeno.', { variant: 'success' });
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
            const fromThisOrder = currentOrderId != null && entry.orderId === currentOrderId;
            const assigned = isAssigned(entry);

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
                      {fromThisOrder && <LedgerTag tone="info" label="z této objednávky" />}
                      {/* Somebody else's to close: it settles itself when that order arrives, and
                          closing it by hand would quietly bypass the link. */}
                      {assigned && <LedgerTag tone="new" label="zařazeno" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {[
                        fmtDate(entry.createdAt),
                        entry.orderId
                          ? (fromThisOrder ? undefined : orderNumber(entry.orderId))
                          : 'bez objednávky',
                        entry.createdByUserName,
                      ].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>

                  {editable && !assigned && (
                    <IconButton
                      size="small"
                      onClick={() => resolve(entry)}
                      aria-label="Vyřešit"
                      sx={{ color: 'success.main', flexShrink: 0 }}
                    >
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Box>
            );
          })}
      </Box>
    </CollapsibleCard>
  );
}
