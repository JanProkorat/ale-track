import { useMemo } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { type SaleDto } from 'src/generated/api-client';
import { salePaymentName } from 'src/lib/labels';
import { useInventory } from 'src/hooks/useInventory';
import { completionRows, shortRows, stockLevels } from './salesModel';

/**
 * Confirmation for completing a sale, showing what each stock row drops to — the reverse of the
 * Dovozy naskladnění preview.
 *
 * The backend refuses an oversold line regardless; this exists so the refusal is visible before the
 * click rather than as an error toast after it.
 */
export function CompleteSaleDialog({
  sale,
  open,
  busy,
  onConfirm,
  onClose,
}: {
  sale: SaleDto;
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const inventory = useInventory();

  // Same shortfall computation the detail screen uses, so the two cannot disagree about whether a
  // sale is completable.
  const levels = useMemo(() => stockLevels(inventory.data), [inventory.data]);
  const rows = useMemo(() => completionRows(sale.items, levels), [sale.items, levels]);
  const short = shortRows(rows);

  // Only block on stock we could actually read — a failed or in-flight inventory fetch must not
  // present itself as "not enough stock".
  const blocked = inventory.isSuccess && short.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dokončit prodej</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2, color: 'text.secondary' }}>
          Dokončením se toto zboží odečte ze skladu a záznam se uzamkne.
          {/* Stock leaves on both paths; only the state differs, so say which one this sale takes. */}
          {salePaymentName(sale.payment) === 'Invoice'
            ? ' Prodej pak čeká na platbu — dokončí se až potvrzením, že faktura byla uhrazena.'
            : ''}
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Položka</TableCell>
              <TableCell align="right">Skladem</TableCell>
              <TableCell align="right">Prodej</TableCell>
              <TableCell align="right">Zůstane</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {row.before ?? '—'}
                </TableCell>
                <TableCell align="right" sx={{ color: 'error.main', fontVariantNumeric: 'tabular-nums' }}>
                  −{row.quantity}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: row.short ? 'error.main' : 'text.primary',
                  }}
                >
                  {row.short ? 'nedostatek' : (row.after ?? '—')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {blocked && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Na skladě není dost kusů: {short.map((r) => r.name).join(', ')}. Upravte počty v prodeji.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Zrušit
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={busy || blocked}>
          Dokončit a vyskladnit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
