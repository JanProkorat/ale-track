// The only deviations with no row of their own: money owed either way, and a note about
// something that is neither a quantity nor an address.
//
// An earlier design had a Změny card listing every entry beside the diffed rows. It was cut: on
// an order whose deviations are all quantities it says a second time what the struck-through
// numbers already say, and the reader has to check two places to learn one thing. What survives
// is only what nothing else can show — so on an order with only quantity deviations this card
// does not render at all.

import { Box, Stack, Typography } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { fmtDate } from 'src/lib/format';
import { ledgerTargetName } from 'src/lib/labels';
import type { ClientLedgerEntryDto } from 'src/generated/api-client';
import { entryTooltip, freeEntries, moneyText } from './ledgerModel';
import { LedgerTag } from './LedgerDiff';

/** Money and free-text deviations of one order. Renders nothing when there are none. */
export function LedgerMoneyCard({ entries }: { entries: ClientLedgerEntryDto[] }) {
  const { formatMoney } = useCurrency();
  const rows = freeEntries(entries);

  if (rows.length === 0) return null;

  return (
    <CollapsibleCard
      title="Peníze a poznámky"
      count={rows.length}
      icon={<AccountBalanceWalletOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1,
          '& > div': { py: 1.25, borderBottom: 1, borderColor: 'divider' },
          '& > div:last-of-type': { borderBottom: 0 },
        }}
      >
        {rows.map((entry) => {
          const isMoney = ledgerTargetName(entry.target) === 'Money';
          const amount = entry.amount ?? 0;

          return (
            <Box key={entry.id}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <LedgerTag
                  tone="info"
                  label={isMoney ? moneyText(entry) : 'Změna'}
                  title={entryTooltip(entry)}
                />
                {isMoney && (
                  <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(Math.abs(amount))}
                  </Typography>
                )}
                {entry.resolvedAt && (
                  <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>
                    vyřešeno {fmtDate(entry.resolvedAt)}
                  </Typography>
                )}
              </Stack>
              {entry.note && (
                <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
                  {entry.note}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </CollapsibleCard>
  );
}
