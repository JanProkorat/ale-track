// The "Vykládka" tab body: what comes off the van, stop by stop, in route
// order. The mirror image of AggLoadingTable (in ShipmentDetail.tsx), which
// aggregates by product and sections by brewery — right for the ramp, wrong
// for the road. See unloadOrder.ts for why the shapes differ and what each
// line carries; this component only lays that shape out.

import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import type { UnloadLine, UnloadStop } from './unloadOrder';

/** The stop's 1-based route position, in a plain token-coloured circle — the
 * same numbered-avatar language "Přehled objednávek" uses for its own
 * per-stop rows (`OrdersOverviewCard`), but without a per-client colour: a
 * Custom or Company stop has none to draw. */
function SeqBadge({ seq }: { seq: number }) {
  return (
    <Box
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

/** One product coming off the van at this stop: name, its degree/size chip,
 * then the quantity right-aligned in tabular figures so the column reads
 * straight down the list, matching every other quantity in the nakládka card. */
function UnloadLineRow({ line }: { line: UnloadLine }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ py: 0.375 }}>
      <Typography sx={{ fontSize: 12.5, flex: 1, minWidth: 0 }} noWrap>{line.name}</Typography>
      {line.chip && <Chip size="small" label={line.chip} sx={{ height: 18, fontSize: 10, fontWeight: 600 }} />}
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {`× ${line.quantity}`}
      </Typography>
    </Stack>
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
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{stop.title}</Typography>
        {stop.subtitle && (
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{stop.subtitle}</Typography>
        )}
        {stop.note && (
          <Typography variant="caption" color="text.secondary">{stop.note}</Typography>
        )}
        <Box sx={{ mt: 0.5 }}>
          {stop.lines.length > 0
            ? stop.lines.map((line, index) => <UnloadLineRow key={`${line.name}-${index}`} line={line} />)
            : <Typography color="text.secondary" sx={{ fontSize: 12 }}>Bez vykládky</Typography>}
        </Box>
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
    <Stack spacing={0.5}>
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
