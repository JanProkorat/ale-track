// The two ways a product's stock is drawn on the Sklad page: a wide panel for
// the list view and a tile for the grid. Both take a whole group (all sizes of
// one product) so the variants read as one thing, and both delegate the row
// actions back to the page.

import { Box, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { StatusPill } from 'src/components/common/StatusPill';
import { num, fmtLiters, plural } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { type InventoryItemListItemDto } from 'src/generated/api-client';
import { isLow, itemSubtitle, type InventoryGroup } from './inventoryModel';

interface RowActions {
  editable: boolean;
  onAdjust: (item: InventoryItemListItemDto, delta: number) => void;
  onDelete: (item: InventoryItemListItemDto) => void;
}

/** − / + quantity stepper (matches the prototype's inline stock adjust). */
function QtyStepper({
  item,
  editable,
  onAdjust,
}: {
  item: InventoryItemListItemDto;
  editable: boolean;
  onAdjust: (item: InventoryItemListItemDto, delta: number) => void;
}) {
  const low = isLow(item);
  const btnSx = { border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 } as const;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
      {editable && (
        <IconButton size="small" onClick={() => onAdjust(item, -1)} sx={btnSx} aria-label="Ubrat">
          <RemoveIcon fontSize="small" />
        </IconButton>
      )}
      <Typography sx={{ minWidth: 34, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', ...(low && { color: 'error.main' }) }}>
        {num(item.quantity ?? 0)}
      </Typography>
      {editable && (
        <IconButton size="small" onClick={() => onAdjust(item, 1)} sx={btnSx} aria-label="Přidat">
          <AddIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Vyskladnit">
      <IconButton size="small" onClick={onClick} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

/** The status as a dot rather than a pill — the tile has no room for the word,
 * and the tooltip carries it for anyone who needs it spelled out. */
function StatusDot({ item }: { item: InventoryItemListItemDto }) {
  if (!item.productId) return null;
  const low = isLow(item);
  return (
    <Tooltip title={low ? 'nízká zásoba' : 'skladem'}>
      <Box
        aria-label={low ? 'nízká zásoba' : 'skladem'}
        sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: low ? 'error.main' : 'success.main' }}
      />
    </Tooltip>
  );
}

/** "2 velikosti" — only worth saying when there is more than one. */
function SizeCountChip({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <Chip
      size="small"
      label={`${count} ${plural(count, 'velikost', 'velikosti', 'velikostí')}`}
      sx={{ height: 20, fontSize: 11 }}
    />
  );
}

/**
 * List view: one panel per product, one row per size. Replaces the old flat
 * table — the columns it had (cena/ks aside) live on the row now, which is what
 * lets the sizes of a product sit together instead of scattering down the page.
 */
export function InventoryProductPanel({
  group,
  color,
  editable,
  onAdjust,
  onDelete,
}: { group: InventoryGroup; color?: string } & RowActions) {
  // A lone size needs no header to sit under: the row carries the name itself,
  // the way the delivery-editor catalog does it. Most products are single-size,
  // so this is most of the list's height.
  const single = group.items.length === 1;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      {!single && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.75, py: 1.1, bgcolor: 'action.hover' }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{group.name}</Typography>
          <Box sx={{ flex: 1 }} />
          <SizeCountChip count={group.items.length} />
        </Stack>
      )}

      {group.items.map((item, index) => {
        const low = isLow(item);
        return (
          <Stack
            key={item.id}
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ px: 1.75, py: 1, borderTop: single && index === 0 ? 0 : 1, borderColor: 'divider' }}
          >
            {single && (
              <>
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, flexShrink: 0 }} noWrap>{group.name}</Typography>
              </>
            )}
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
              <Chip size="small" label={kindLabel(item.kind) ?? 'Ostatní'} sx={{ height: 20, fontSize: 11 }} />
              {item.packageSize != null && (
                <Chip size="small" label={fmtLiters(item.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {item.note ?? ''}
            </Typography>
            <QtyStepper item={item} editable={editable} onAdjust={onAdjust} />
            <Box sx={{ width: 116, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
              {item.productId && <StatusPill tone={low ? 'crit' : 'ok'} label={low ? 'nízká zásoba' : 'skladem'} />}
            </Box>
            {editable && <DeleteButton onClick={() => onDelete(item)} />}
          </Stack>
        );
      })}
    </Box>
  );
}

/**
 * Grid view: the same group as a tile — header, then one line per size. Size,
 * status, stepper and delete share a single row so a two-size product is two
 * lines tall rather than six; the note only takes a line when there is one.
 */
export function InventoryProductCard({
  group,
  color,
  editable,
  onAdjust,
  onDelete,
}: { group: InventoryGroup; color?: string } & RowActions) {
  return (
    <Card variant="outlined" sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14.5, flex: 1, minWidth: 0 }} noWrap>{group.name}</Typography>
        <SizeCountChip count={group.items.length} />
      </Stack>

      {group.items.map((item, index) => (
        <Box
          key={item.id}
          sx={{ borderTop: '1px solid', borderColor: 'divider', pt: index === 0 ? 0.75 : 0.5 }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {itemSubtitle(item)}
            </Typography>
            <StatusDot item={item} />
            <QtyStepper item={item} editable={editable} onAdjust={onAdjust} />
            {editable && <DeleteButton onClick={() => onDelete(item)} />}
          </Stack>
          {item.note && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
              {item.note}
            </Typography>
          )}
        </Box>
      ))}
    </Card>
  );
}
