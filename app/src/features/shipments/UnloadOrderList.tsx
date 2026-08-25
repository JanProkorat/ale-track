// The "Vykládka" tab body: what comes off the van, stop by stop, in route
// order. The mirror image of AggLoadingTable (in ShipmentDetail.tsx), which
// aggregates by product and sections by brewery — right for the ramp, wrong
// for the road. See unloadOrder.ts for why the shapes differ and what each
// line carries; this component only lays that shape out.

import { Box, Button, Card, Divider, Link, Stack, Tooltip, Typography } from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { plural } from 'src/lib/format';
import { LedgerRowTag, LedgerTag, QuantityDiff } from 'src/features/clients/LedgerDiff';
import { RECORD_CHANGE_LABEL, RECORD_CHANGE_SHORT } from 'src/features/clients/ledgerStyles';
import { StopAvatar } from './StopAvatar';
import type { UnloadStop } from './unloadOrder';

/**
 * The stop's products, two lines each: the name with its count, then what it is packed in.
 *
 * Two lines rather than three columns because the packaging is the longest thing on the row and
 * the name is the shortest — side by side they left a river of empty card between them, and a
 * chip wide enough for 'Plechovka · 0,5 l · 10°' pushed the count around with it. Stacked, the
 * name and the count sit at the two ends of one line and nothing can drift.
 */
function UnloadLines({ stop }: { stop: UnloadStop }) {
  return (
    <Stack divider={<Divider />}>
      {stop.lines.map((line, index) => (
        <Box key={`${line.name}-${index}`} data-testid="unload-line" sx={{ px: 2, py: 0.875 }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, minWidth: 0, lineHeight: 1.3 }} noWrap>
              {line.name}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {/* The handover is the one moment a plan and a reality exist side by side, and this
                is the view of it: the loaded count struck through, what came off beside it. */}
            {line.diff && line.diff.status !== 'unchanged' ? (
              <Box sx={{ fontSize: 13, flexShrink: 0, lineHeight: 1.3 }}>
                <QuantityDiff row={line.diff} unit="ks" />
              </Box>
            ) : (
              <Typography sx={{
                fontSize: 13, fontWeight: 700, flexShrink: 0, lineHeight: 1.3,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {`× ${line.quantity}`}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            {line.chip && (
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.3 }} noWrap>
                {line.chip}
              </Typography>
            )}
            {line.diff && <LedgerRowTag row={line.diff} />}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * One stop: a tinted heading naming who it is and how much they take, then its lines under it.
 *
 * The heading borrows the loading table's own section language — `brand.surface2` over a divider
 * — because the two lists share a card and a stop here means what a brewery means there:
 * everything below it belongs to it, until the next one.
 */
function UnloadStopBlock({ stop, onOpenOrder, onRecordChange }: {
  stop: UnloadStop;
  onOpenOrder?: (orderId: string) => void;
  onRecordChange?: (stop: UnloadStop) => void;
}) {
  const openOrder = onOpenOrder && stop.orderId ? () => onOpenOrder(stop.orderId!) : undefined;
  // Offered once this stop's Fakturace row is finished: the deviation is recorded against
  // paperwork the office has closed, and a row nobody has ticked yet has nothing to record
  // against. A stop with no order has no row at all.
  const record = onRecordChange && stop.orderId && stop.isInvoiceReady
    ? () => onRecordChange(stop)
    : undefined;
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          px: 2, py: 1.25, alignItems: 'flex-start',
          bgcolor: (t) => t.vars!.palette.brand.surface2,
          borderTop: 1, borderColor: 'divider',
        }}
      >
        <StopAvatar kind={stop.kind} seq={stop.seq} clientId={stop.clientId} testId="unload-stop-seq" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {openOrder ? (
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={openOrder}
              sx={{
                fontWeight: 700, fontSize: 14, color: 'primary.dark', textAlign: 'left',
                display: 'block', maxWidth: '100%', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {stop.title}
            </Link>
          ) : (
            <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>{stop.title}</Typography>
          )}
          {stop.subtitle && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{stop.subtitle}</Typography>
          )}
          {stop.addressMissing && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <WarningAmberOutlinedIcon
                aria-label="Klient nemá vyplněnou dodací adresu"
                sx={{ fontSize: 13, color: 'warning.main' }}
              />
              <Typography sx={{ fontSize: 11.5, color: 'warning.main' }}>
                Klient nemá vyplněnou dodací adresu
              </Typography>
            </Stack>
          )}
          {stop.note && (
            <Typography variant="caption" color="text.secondary">{stop.note}</Typography>
          )}
        </Box>
        {/* The whole right-hand side as one cluster centred on the row: the open changes, what
            the driver counts the handover against, and the button to record a deviation.
            Centred, and outside the name's own line — a padded button sharing that line pushed
            the address away from the name, and centring lets the browser align the three to each
            other instead of an offset computed against MUI's line metrics.

            No second banner among them: AddressChangedBanner already holds the top of the page,
            and two strips competing for one glance cost the reader both. The highlight belongs
            to the stop it concerns. */}
        {(stop.openChanges > 0 || stop.totalQuantity > 0 || record) && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, alignSelf: 'center' }}>
            {stop.openChanges > 0 && (
              <LedgerTag
                tone="info"
                label={`${stop.openChanges} ${plural(stop.openChanges, 'změna', 'změny', 'změn')}`}
              />
            )}
            {stop.totalQuantity > 0 && (
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {`${stop.totalQuantity} ks`}
              </Typography>
            )}
            {/* Offered only once this stop's Fakturace row is finished — see the note above.
                Plain, unlike the order detail's outlined amber: this cluster already carries a
                badge and a count, and a bordered button among them reads as clutter. */}
            {record && (
              <Tooltip title={RECORD_CHANGE_LABEL}>
                <Button
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  onClick={record}
                  aria-label={RECORD_CHANGE_LABEL}
                  sx={{ flexShrink: 0, fontWeight: 700 }}
                >
                  {RECORD_CHANGE_SHORT}
                </Button>
              </Tooltip>
            )}
          </Stack>
        )}
      </Stack>
      {/* A muted placeholder when nothing comes off here: a Custom stop unloads nothing, and an
          order the office has not put products on yet reads the same way. */}
      {stop.lines.length > 0
        ? <UnloadLines stop={stop} />
        : <Typography color="text.secondary" sx={{ fontSize: 12, px: 2, py: 1 }}>Bez vykládky</Typography>}
    </Box>
  );
}

/**
 * "Vykládka" tab body: the driver's stop-by-stop unload order, replacing the
 * aggregated loading table entirely while this tab is active.
 *
 * The start point leads the card as its own row, never a numbered stop — `unloadOrder()`
 * deliberately never includes it (nothing is unloaded there), so it arrives as its own prop.
 */
export function UnloadOrderList({
  stops, startPoint, onOpenOrder, onRecordChange,
}: {
  stops: UnloadStop[];
  startPoint: { name: string; address?: string };
  /** Opens a delivery stop's order — makes the client name a link, as in Přehled zastávek.
   *  Omitted for users who cannot see the Objednávky module, who then get the plain name back. */
  onOpenOrder?: (orderId: string) => void;
  /**
   * Opens the recording drawer for a stop. Omitted for users who may not write a client's ledger;
   * each stop then decides for itself whether its paperwork is finished.
   */
  onRecordChange?: (stop: UnloadStop) => void;
}) {
  return (
    <Card variant="outlined" data-testid="unload-list">
      <Box sx={{ px: 2, py: 1.25, bgcolor: (t) => t.vars!.palette.brand.surface3 }}>
        <Typography
          sx={{
            fontSize: 11, fontWeight: 700, color: 'text.secondary',
            textTransform: 'uppercase', letterSpacing: '0.03em',
          }}
        >
          Výchozí bod
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{startPoint.name}</Typography>
        {startPoint.address && (
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{startPoint.address}</Typography>
        )}
      </Box>
      {stops.map((stop) => (
        <UnloadStopBlock
          key={stop.seq}
          stop={stop}
          onOpenOrder={onOpenOrder}
          onRecordChange={onRecordChange}
        />
      ))}
    </Card>
  );
}
