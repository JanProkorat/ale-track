// The "Vykládka" tab body: what comes off the van, stop by stop, in route
// order. The mirror image of AggLoadingTable (in ShipmentDetail.tsx), which
// aggregates by product and sections by brewery — right for the ramp, wrong
// for the road. See unloadOrder.ts for why the shapes differ and what each
// line carries; this component only lays that shape out.

import { Box, Card, Divider, Link, Stack, Typography } from '@mui/material';
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
            <Typography sx={{
              fontSize: 13, fontWeight: 700, flexShrink: 0, lineHeight: 1.3,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {`× ${line.quantity}`}
            </Typography>
          </Stack>
          {line.chip && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.3 }} noWrap>
              {line.chip}
            </Typography>
          )}
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
function UnloadStopBlock({ stop, onOpenOrder }: {
  stop: UnloadStop;
  onOpenOrder?: (orderId: string) => void;
}) {
  const openOrder = onOpenOrder && stop.orderId ? () => onOpenOrder(stop.orderId!) : undefined;
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
          <Stack direction="row" alignItems="baseline" spacing={1}>
            {openOrder ? (
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={openOrder}
                sx={{ fontWeight: 700, fontSize: 14, color: 'primary.dark', textAlign: 'left', minWidth: 0 }}
              >
                {stop.title}
              </Link>
            ) : (
              <Typography sx={{ fontWeight: 700, fontSize: 14, minWidth: 0 }} noWrap>{stop.title}</Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {/* What the driver counts the handover against, so it belongs beside the client's
                name rather than under the last line. */}
            {stop.totalQuantity > 0 && (
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {`${stop.totalQuantity} ks`}
              </Typography>
            )}
          </Stack>
          {stop.subtitle && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{stop.subtitle}</Typography>
          )}
          {stop.note && (
            <Typography variant="caption" color="text.secondary">{stop.note}</Typography>
          )}
        </Box>
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
  stops, startPoint, onOpenOrder,
}: {
  stops: UnloadStop[];
  startPoint: { name: string; address?: string };
  /** Opens a delivery stop's order — makes the client name a link, as in Přehled zastávek.
   *  Omitted for users who cannot see the Objednávky module, who then get the plain name back. */
  onOpenOrder?: (orderId: string) => void;
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
        <UnloadStopBlock key={stop.seq} stop={stop} onOpenOrder={onOpenOrder} />
      ))}
    </Card>
  );
}
