// The "Vykládka" tab body: what comes off the van, stop by stop, in route
// order. The mirror image of AggLoadingTable (in ShipmentDetail.tsx), which
// aggregates by product and sections by brewery — right for the ramp, wrong
// for the road. See unloadOrder.ts for why the shapes differ and what each
// line carries; this component only lays that shape out.

import { Fragment } from 'react';
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import type { UnloadStop } from './unloadOrder';

/** The stop's 1-based route position, in a plain token-coloured circle — the
 * same numbered-avatar language "Přehled zastávek" uses for its own
 * per-stop rows (`OrdersOverviewCard`), but without a per-client colour: a
 * Custom, Company or Supplier stop has none to draw. */
function SeqBadge({ seq }: { seq: number }) {
  return (
    <Box
      data-testid="unload-stop-seq"
      sx={{
        width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
        fontSize: 12, fontWeight: 800, flexShrink: 0, color: 'text.primary',
        border: 1, borderColor: 'divider',
        bgcolor: (t) => t.vars!.palette.brand.surface3,
      }}
    >
      {seq}
    </Box>
  );
}

/**
 * The stop's products, one row each: name, then what it is, then how many.
 *
 * A grid rather than a row of flex Stacks so the chips and the quantities line up down the
 * list — the complaint that started this was three rows reading "Svijanský Kníže" whose only
 * difference was a chip the eye had to hunt for on each line. Grid columns are shared by
 * every row in one container, so a per-row Stack could not align them.
 */
function UnloadLines({ stop }: { stop: UnloadStop }) {
  return (
    <Box sx={{
      mt: 0.5, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto',
      columnGap: 1, rowGap: 0.25, alignItems: 'center',
    }}>
      {stop.lines.map((line, index) => (
        // A keyed Fragment, so each line's three cells land in the grid itself — a wrapper
        // element would become one grid item and the columns would collapse.
        <Fragment key={`${line.name}-${index}`}>
          <Typography sx={{ fontSize: 12.5 }} noWrap>{line.name}</Typography>
          {line.chip
            ? <Chip size="small" label={line.chip} sx={{ height: 18, fontSize: 10, fontWeight: 600, justifySelf: 'start' }} />
            : <Box />}
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
            {`× ${line.quantity}`}
          </Typography>
        </Fragment>
      ))}
    </Box>
  );
}

/** One stop's block: its position, title, address (when it has one), note
 * (when it has one), then its lines — or a muted placeholder when nothing
 * comes off here (a Custom stop unloads nothing, and an order stop the
 * office hasn't put products on yet reads the same way). */
function UnloadStopBlock({ stop }: { stop: UnloadStop }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ py: 1 }}>
      <SeqBadge seq={stop.seq} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, minWidth: 0 }} noWrap>{stop.title}</Typography>
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
        {stop.lines.length > 0
          ? <UnloadLines stop={stop} />
          : <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.5 }}>Bez vykládky</Typography>}
      </Box>
    </Stack>
  );
}

/**
 * "Vykládka" tab body: the driver's stop-by-stop unload order, replacing the
 * aggregated loading table entirely while this tab is active.
 *
 * The start point renders as a plain header line above the numbered stops,
 * never itself a numbered stop — `unloadOrder()` deliberately never includes
 * it (nothing is unloaded there), so it arrives as its own prop instead.
 */
export function UnloadOrderList({
  stops, startPoint,
}: {
  stops: UnloadStop[];
  startPoint: { name: string; address?: string };
}) {
  return (
    <Stack data-testid="unload-list" spacing={0.5}>
      <Box sx={{ px: 0.25, pb: 1 }}>
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
      <Stack divider={<Divider />}>
        {stops.map((stop) => <UnloadStopBlock key={stop.seq} stop={stop} />)}
      </Stack>
    </Stack>
  );
}
