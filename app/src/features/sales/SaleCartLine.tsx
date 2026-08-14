import { useState } from 'react';
import { Box, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import { fmtLiters } from 'src/lib/format';

/** The subset of an editor line this component renders. */
export interface CartLineData {
  inventoryItemId: string;
  name: string;
  packageSize?: number;
  listPrice?: number;
  quantity: number;
  unitPrice: number | null;
  note: string;
  stock: number;
}

/**
 * One picked line in the summary rail: amount, price and an optional note, all editable.
 *
 * Laid out stacked rather than in a row because the rail is the narrow column — three inputs side by
 * side would not survive it. The note hides behind a toggle for the same reason: a five-line sale
 * with three always-open fields per line is unreadable, and most lines never get a note.
 */
export function SaleCartLine({
  line,
  formatMoney,
  onQuantity,
  onStep,
  onPrice,
  onNote,
  onRemove,
}: {
  line: CartLineData;
  formatMoney: (v?: number) => string;
  onQuantity: (raw: string) => void;
  onStep: (delta: number) => void;
  onPrice: (raw: string) => void;
  onNote: (value: string) => void;
  onRemove: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const showNoteField = noteOpen || line.note.length > 0;
  const overStock = line.quantity > line.stock;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
            {line.name}
            {line.packageSize != null ? ` (${fmtLiters(line.packageSize)})` : ''}
          </Typography>
          {/* Over stock, the shortfall is the only thing worth reading — the ceník price is noise
              next to "you cannot hand this over", and it competes with the warning for attention. */}
          <Typography sx={{ fontSize: 11, color: overStock ? 'error.main' : 'text.disabled' }}>
            {overStock
              ? `skladem jen ${line.stock}`
              : `skladem ${line.stock}${line.listPrice != null ? ` · ceník ${formatMoney(line.listPrice)}` : ' · bez ceníku'}`}
          </Typography>
        </Box>
        <IconButton
          size="small"
          color="error"
          onClick={onRemove}
          aria-label={`Odebrat ${line.name}`}
          sx={{ mt: -0.5, mr: -0.5 }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <IconButton
          size="small"
          onClick={() => onStep(-1)}
          aria-label={`Snížit počet ${line.name}`}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 28, height: 28 }}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <TextField
          size="small"
          type="number"
          value={line.quantity}
          onChange={(e) => onQuantity(e.target.value)}
          slotProps={{ htmlInput: { min: 0, max: line.stock, 'aria-label': `Počet ${line.name}` } }}
          sx={{ width: 62, '& input': { textAlign: 'center', px: 0.5 } }}
        />
        <IconButton
          size="small"
          onClick={() => onStep(1)}
          disabled={line.quantity >= line.stock}
          aria-label={`Zvýšit počet ${line.name}`}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 28, height: 28 }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>

        <TextField
          size="small"
          type="number"
          value={line.unitPrice ?? ''}
          onChange={(e) => onPrice(e.target.value)}
          placeholder="cena"
          slotProps={{ htmlInput: { min: 0, 'aria-label': `Cena za kus ${line.name}` } }}
          sx={{ width: 84, '& input': { textAlign: 'right', px: 0.75 } }}
        />

        <Typography
          sx={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatMoney(line.quantity * (line.unitPrice ?? 0))}
        </Typography>
      </Stack>

      {showNoteField ? (
        <TextField
          size="small"
          fullWidth
          value={line.note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Poznámka k položce"
          slotProps={{ htmlInput: { 'aria-label': `Poznámka k ${line.name}` } }}
          sx={{ mt: 1 }}
        />
      ) : (
        <Box
          component="button"
          type="button"
          onClick={() => setNoteOpen(true)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 1,
            p: 0,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            color: 'text.disabled',
            font: 'inherit',
            fontSize: 11.5,
            '&:hover': { color: 'primary.main' },
          }}
        >
          <NoteAddOutlinedIcon sx={{ fontSize: 14 }} />
          poznámka
        </Box>
      )}
    </Box>
  );
}
