import { useState } from 'react';
import { Box, Card, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { EmptyState } from 'src/components/common/EmptyState';
import { useCurrency } from 'src/providers/CurrencyProvider';
import type { CartRow } from './deliveryCartModel';
import { cartTotalPrice, cartTotalQuantity } from './deliveryCartModel';

/**
 * Everything the dovoz is going to collect, from every stop, in one card.
 *
 * Flat rather than grouped by stop: the coloured dot plus the name is enough to say where a line
 * came from, and a dovoz with four stops would otherwise spend more height on headings than on
 * lines. The quantity controls edit the owning stop's line, so this and the stop card below it are
 * two views of one list rather than two lists.
 *
 * The note button is the only place a line's note can be written. The field has always existed on
 * the wire and the editor never exposed it, which is why a driver's "vyměnit za prázdné" had
 * nowhere to go.
 */
export function DeliveryCart({
  rows,
  onChangeQuantity,
  onChangeNote,
  onRemove,
}: {
  rows: CartRow[];
  onChangeQuantity: (row: CartRow, delta: number) => void;
  onChangeNote: (row: CartRow, note: string) => void;
  onRemove: (row: CartRow) => void;
}) {
  const { formatMoney } = useCurrency();
  // Which rows have their note field revealed. A row with a note already on it always shows it;
  // this only tracks the ones opened by hand, so that keeping a twenty-line cart compact stays the
  // default without hiding text somebody has written.
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());

  const totalQty = cartTotalQuantity(rows);
  const totalPrice = cartTotalPrice(rows);

  const toggleNote = (row: CartRow) => setOpenNotes((prev) => {
    const next = new Set(prev);
    if (next.has(row.key)) next.delete(row.key);
    else next.add(row.key);
    return next;
  });

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <ShoppingCartOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Košík</Typography>
        <Chip size="small" label={`${totalQty} ks`} />
      </Stack>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShoppingCartOutlinedIcon />}
          title="Košík je prázdný"
          description="Přidejte produkty nebo zboží ze zastávek."
          dense
        />
      ) : (
        <>
          <Stack>
            {rows.map((row) => {
              const noteShown = openNotes.has(row.key) || Boolean(row.note.trim());
              const lineTotal = row.unitPrice != null ? formatMoney(row.unitPrice * row.quantity) : undefined;
              return (
                <Box key={row.key} sx={{ px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: row.color, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{row.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[...row.details, lineTotal].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => onChangeQuantity(row, -1)}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }}
                      aria-label={`Ubrat ${row.name}`}
                    >
                      <RemoveIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {row.quantity}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => onChangeQuantity(row, 1)}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }}
                      aria-label={`Přidat ${row.name}`}
                    >
                      <AddIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => toggleNote(row)}
                      sx={{
                        border: 1, borderRadius: 1.5, width: 26, height: 26,
                        borderColor: row.note.trim() ? 'warning.main' : 'divider',
                        color: row.note.trim() ? 'warning.dark' : 'inherit',
                      }}
                      aria-label={noteShown ? `Skrýt poznámku k ${row.name}` : `Přidat poznámku k ${row.name}`}
                    >
                      <StickyNote2OutlinedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onRemove(row)}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }}
                      aria-label={`Odebrat ${row.name}`}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                  {noteShown && (
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Poznámka k položce (nepovinné)"
                      value={row.note}
                      onChange={(e) => onChangeNote(row, e.target.value)}
                      slotProps={{ htmlInput: { 'aria-label': `Poznámka k položce ${row.name}` } }}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, py: 1.75 }}>
            <Typography sx={{ fontWeight: 700 }}>Celkem s DPH</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'warning.dark' }}>{formatMoney(totalPrice)}</Typography>
          </Stack>
        </>
      )}
    </Card>
  );
}
