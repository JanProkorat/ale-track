// The "Vykládka" tab body: what comes off the van, stop by stop, in route
// order. The mirror image of AggLoadingTable (in ShipmentDetail.tsx), which
// aggregates by product and sections by brewery — right for the ramp, wrong
// for the road. See unloadOrder.ts for why the shapes differ and what each
// line carries; this component only lays that shape out.

import { Box, Card, Divider, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { fmtTime, plural } from 'src/lib/format';
import { LedgerRowTag, LedgerTag, QuantityDiff } from 'src/features/clients/LedgerDiff';
import { RECORD_CHANGE_LABEL } from 'src/features/clients/ledgerStyles';
import { StopAvatar } from './StopAvatar';
import { Pill } from './Pill';
import type { UnloadStop } from './unloadOrder';
import type { StopHoursNote } from './supplierStopHours';

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
function UnloadStopBlock({ stop, hours, onOpenOrder, onRecordChange, onToggleFinished }: {
  stop: UnloadStop;
  /** The supplier's hours for the run's own day, on a pickup stop that has any. */
  hours?: StopHoursNote;
  onOpenOrder?: (orderId: string) => void;
  onRecordChange?: (stop: UnloadStop) => void;
  /** Marks the stop finished, or takes the mark back. Withheld unless the run is on the road. */
  onToggleFinished?: (stop: UnloadStop, isCompleted: boolean) => void;
}) {
  const openOrder = onOpenOrder && stop.orderId ? () => onOpenOrder(stop.orderId!) : undefined;
  // A stop with no order has nothing to record against. Whether recording is open at all is the
  // run's business rather than the stop's — the caller withholds the handler until the run's
  // invoicing is filed, which is the point where the plan stops moving.
  const record = onRecordChange && stop.orderId
    ? () => onRecordChange(stop)
    : undefined;
  // Every kind of stop can be finished — a pickup and the warehouse are called at too. Needs the
  // stop's own id: that is what the write is addressed by.
  const finish = onToggleFinished && stop.stopId
    ? (isCompleted: boolean) => onToggleFinished(stop, isCompleted)
    : undefined;
  // Names the circle for assistive tech and titles its tooltip. A row nobody may mark still
  // says what the circle means, since a finished stop reads as a check either way.
  const finishLabel = stop.completedAt
    ? `Hotovo ${fmtTime(stop.completedAt)}${finish ? ' — kliknutím zrušit' : ''}`
    : 'Označit jako hotovo';
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
        {/* The circle is the mark: pressing it says the run has finished with this stop, and it
            reads as a check from then on. Its tooltip carries the time, which also reads in the
            row itself — a phone has no hover. */}
        <Tooltip title={finishLabel}>
          <StopAvatar
            kind={stop.kind}
            seq={stop.seq}
            clientId={stop.clientId}
            done={Boolean(stop.completedAt)}
            onToggleDone={finish ? () => finish(!stop.completedAt) : undefined}
            label={finishLabel}
            testId="unload-stop-seq"
          />
        </Tooltip>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* The hours ride beside the name rather than under the address: they belong to the
              supplier, not to where it is. Wrapping, so a long name keeps its ellipsis and the
              chip drops to its own line instead of squeezing it. */}
          <Stack direction="row" spacing={0.75} alignItems="baseline" flexWrap="wrap" useFlexGap>
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
            {/* A pickup the van cannot make is worth knowing before it sets off, so a gate that
                is shut at the run's own time says so in the chip rather than only colouring it. */}
            {/* Written down as the drivers ring in, so it belongs in the row: a phone in a van has
                no hover, and this time is what the round is reconstructed from afterwards. */}
            {stop.completedAt && (
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'success.main' }}>
                {fmtTime(stop.completedAt)}
              </Typography>
            )}
            {hours && (
              <Pill
                // Blue for the ordinary case rather than grey, which vanished into the row's own
                // surface. Amber stays the shut gate's, and green the finished stop's — one row
                // can show both, so the hours must not borrow either.
                tint={hours.closedAtArrival ? 'amberTint' : 'infoTint'}
                color={hours.closedAtArrival ? 'warning.dark' : 'info.main'}
                icon={hours.closedAtArrival
                  ? (
                    <WarningAmberOutlinedIcon
                      aria-label="V čase vývozu zavřeno"
                      sx={{ fontSize: 13 }}
                    />
                  )
                  : undefined}
              >
                {hours.closedAtArrival ? `${hours.text} · zavřeno` : hours.text}
              </Pill>
            )}
          </Stack>
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
            {/* Icon only, unlike the order detail's worded amber button: this row already carries
                a badge, a count and a pressable circle, and a word among them reads as clutter.
                The whole action stays in the tooltip and the accessible name. */}
            {record && (
              <Tooltip title={RECORD_CHANGE_LABEL}>
                <IconButton
                  size="small"
                  // The amber it had as a worded button: losing the word should not also lose the
                  // colour that marks it as the row's one amber action.
                  color="primary"
                  onClick={record}
                  aria-label={RECORD_CHANGE_LABEL}
                  sx={{ flexShrink: 0, p: 0.5 }}
                >
                  <EditOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            {/* Last in the cluster, so the stop's total sits at the row's right edge — directly
                above the × counts of the lines below it, which are right-aligned there too. */}
            {stop.totalQuantity > 0 && (
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {`${stop.totalQuantity} ks`}
              </Typography>
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
  stops, startPoint, supplierHours, onOpenOrder, onRecordChange, onToggleFinished,
}: {
  stops: UnloadStop[];
  startPoint: { name: string; address?: string };
  /** Opening hours per supplier id, for the run's own day. Absent for a run with no date, and for
   *  a supplier with no schedule recorded — the row then says nothing about hours. */
  supplierHours?: Map<string, StopHoursNote>;
  /** Opens a delivery stop's order — makes the client name a link, as in Přehled zastávek.
   *  Omitted for users who cannot see the Objednávky module, who then get the plain name back. */
  onOpenOrder?: (orderId: string) => void;
  /**
   * Opens the recording drawer for a stop. Omitted for users who may not write a client's ledger;
   * each stop then decides for itself whether its paperwork is finished.
   */
  onRecordChange?: (stop: UnloadStop) => void;
  /**
   * Marks a stop finished as the drivers ring in. Withheld unless the run is on the road and the
   * user may edit it — a finished stop then still shows when it was done, as a plain tag.
   */
  onToggleFinished?: (stop: UnloadStop, isCompleted: boolean) => void;
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
          hours={stop.supplierId ? supplierHours?.get(stop.supplierId) : undefined}
          onOpenOrder={onOpenOrder}
          onRecordChange={onRecordChange}
          onToggleFinished={onToggleFinished}
        />
      ))}
    </Card>
  );
}
