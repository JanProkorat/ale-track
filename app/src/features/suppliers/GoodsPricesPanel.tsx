import {
  Box, Button, Card, Chip, IconButton, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PropaneTankIcon from '@mui/icons-material/PropaneTankOutlined';
import { EmptyState } from 'src/components/common/EmptyState';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { chargeKindLabel, chargeKindName } from 'src/lib/labels';
import { plural } from 'src/lib/format';
import { SupplierChargeKind, type SupplierGoodDto } from 'src/generated/api-client';
import { priceCount, pricesOrdered } from './supplierGoods';

/** Colour per charge kind, so a refill and a deposit are told apart at a glance. */
function chargeColor(kind: SupplierChargeKind | string | number | undefined): string {
  switch (chargeKindName(kind)) {
    case 'Fill':
      return 'primary.dark';
    case 'Purchase':
      return 'success.main';
    case 'Deposit':
      return 'info.main';
    case 'Rent':
      return 'secondary.main';
    default:
      return 'text.secondary';
  }
}

/**
 * The Ceník tab: each good once, its charge kinds beneath it.
 *
 * The grouping is a `rowSpan` over the good's price rows rather than one table per good —
 * that is how the approved prototype reads, and it keeps the money columns aligned down the
 * whole list instead of restarting per heading.
 */
export function GoodsPricesPanel({
  goods,
  editable,
  onAdd,
  onEdit,
  onDelete,
}: {
  goods: SupplierGoodDto[];
  editable: boolean;
  onAdd: () => void;
  onEdit: (good: SupplierGoodDto) => void;
  onDelete: (good: SupplierGoodDto) => void;
}) {
  const { formatMoney } = useCurrency();
  const total = priceCount(goods);

  const addButton = editable && (
    <Button size="small" startIcon={<AddIcon />} onClick={onAdd} color="inherit">
      Přidat zboží
    </Button>
  );

  if (goods.length === 0) {
    return (
      <EmptyState
        icon={<PropaneTankIcon />}
        title="Prázdný ceník"
        description="Přidejte zboží a k němu cenu za plnění, nákup, zálohu nebo nájem."
        action={addButton}
      />
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        {addButton}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
          {goods.length} {plural(goods.length, 'druh', 'druhy', 'druhů')} zboží · {total}{' '}
          {plural(total, 'cena', 'ceny', 'cen')}
        </Typography>
      </Stack>

      <Card sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Zboží</TableCell>
              <TableCell>Účel</TableCell>
              <TableCell align="right">s DPH</TableCell>
              <TableCell align="right">bez DPH</TableCell>
              <TableCell>Poznámka</TableCell>
              {editable && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {goods.flatMap((good) => {
              const prices = pricesOrdered(good);
              const span = Math.max(1, prices.length);

              const goodCell = (
                <TableCell rowSpan={span} sx={{ verticalAlign: 'top' }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ color: 'text.disabled', mt: '2px', flexShrink: 0, '& svg': { fontSize: 18 } }}>
                      <PropaneTankIcon />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 700 }}>{good.name}</Typography>
                        {good.size && <Chip size="small" variant="outlined" label={good.size} />}
                      </Stack>
                      {good.description && (
                        <Typography variant="body2" color="text.secondary">
                          {good.description}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </TableCell>
              );

              const actionsCell = editable && (
                <TableCell rowSpan={span} align="right" sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Upravit zboží">
                      <IconButton size="small" onClick={() => onEdit(good)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Smazat zboží">
                      <IconButton size="small" onClick={() => onDelete(good)} sx={{ color: 'error.main' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              );

              // A good always has a price — the endpoint's validator enforces it — but a
              // row is still rendered if one ever arrives without, rather than dropping it
              // silently from the ceník.
              if (prices.length === 0) {
                return [
                  <TableRow key={good.id}>
                    {goodCell}
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary">
                        Bez ceny
                      </Typography>
                    </TableCell>
                    {actionsCell}
                  </TableRow>,
                ];
              }

              return prices.map((price, i) => (
                <TableRow key={`${good.id}-${chargeKindName(price.kind) ?? i}`}>
                  {i === 0 && goodCell}
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: chargeColor(price.kind) }}>
                      {chargeKindLabel(price.kind)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontWeight: 700 }}>{formatMoney(price.priceWithVat ?? 0)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color="text.secondary">
                      {price.priceWithoutVat != null ? formatMoney(price.priceWithoutVat) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {price.note ?? ''}
                    </Typography>
                  </TableCell>
                  {i === 0 && actionsCell}
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
