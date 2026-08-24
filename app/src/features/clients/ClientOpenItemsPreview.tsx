// The client's open points, above the cart.
//
// Above it, not beside the save button: whoever builds the next order needs to see what is
// outstanding BEFORE they start filling the cart, not after. A quantity row offers to top itself
// up; money and notes are read-only here because they have no delivery event to close them and
// are settled on the client's profile.

import { Box, Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ledgerTargetLabel } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import type { ClientLedgerEntryDto } from 'src/generated/api-client';
import { entryTooltip, isAssigned, isOpen, isSettleable, moneySummary, owedPieces } from './ledgerModel';
import { LedgerTag } from './LedgerDiff';

export function ClientOpenItemsPreview({
  entries,
  /** How many pieces of each settled entry's product the cart currently holds, by entry id. */
  inCartByEntryId,
  onAddToOrder,
}: {
  entries: ClientLedgerEntryDto[];
  inCartByEntryId: Map<string, number>;
  onAddToOrder: (entry: ClientLedgerEntryDto) => void;
}) {
  const { formatMoney } = useCurrency();
  const open = entries.filter(isOpen);
  if (open.length === 0) return null;

  const money = moneySummary(open);

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
        {open.map((entry) => {
          const settleable = isSettleable(entry);
          const owed = owedPieces(entry);
          const inCart = inCartByEntryId.get(entry.id ?? '') ?? 0;
          const short = settleable && inCart < owed;

          return (
            <Box key={entry.id}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                      {entry.productName ?? entry.lineName
                        ?? (entry.amount != null
                          ? `${entry.amount >= 0 ? 'Klient dluží' : 'Dlužíme klientovi'} ${formatMoney(Math.abs(entry.amount))}`
                          : 'Změna')}
                    </Typography>
                    <LedgerTag
                      tone="info"
                      label={ledgerTargetLabel(entry.target) ?? '—'}
                      title={entryTooltip(entry)}
                    />
                    {/* Somebody else's to bring, so it must not be promised twice. */}
                    {isAssigned(entry) && <LedgerTag tone="new" label="zařazeno" />}
                  </Stack>

                  {/* Resolution is binary, so a short top-up would close the whole debt and lose
                      the remainder. Saying both numbers out loud is the only way that cost is
                      visible before it is paid. */}
                  {settleable && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      dluh {owed} ks
                      {inCart > 0 && ` · přidáno ${inCart} ks`}
                    </Typography>
                  )}
                  {!settleable && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {[fmtDate(entry.createdAt), entry.orderId ? orderNumber(entry.orderId) : 'bez objednávky']
                        .filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                </Box>

                {short && <LedgerTag tone="less" label={`chybí ${owed - inCart} ks`} />}
                {settleable && inCart >= owed && <LedgerTag tone="more" label="dorovnáno" />}

                {settleable && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => onAddToOrder(entry)}
                    sx={{ fontWeight: 700, flexShrink: 0 }}
                  >
                    Přidat do objednávky
                  </Button>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </CollapsibleCard>
  );
}
