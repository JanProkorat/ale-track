import { Box, Typography } from '@mui/material';
import { useCurrency } from 'src/providers/CurrencyProvider';

/**
 * One price, rendered identically wherever an order can show a client's own
 * price: the effective price reads as the number that counts, and — only
 * when a client price actually overrides the brewery's ceník — the ceník
 * price sits struck through beside it.
 *
 * Kept as one shared component because the same mark appears in the order
 * catalog, the cart, and order detail; near-copies at each site would drift
 * out of sync. Ports the prototype's `priceCell(pr, size)`.
 */
export function PriceWithList({
  price,
  listPrice,
  size = 12.5,
}: {
  /** The price that counts — the client's own price when one applies, the
   *  brewery's ceník price otherwise. */
  price?: number | null;
  /** The ceník price, present only when it differs from `price` because a
   *  client price is in effect. Null (or undefined) renders `price` alone. */
  listPrice?: number | null;
  /** Font size in px for the primary price; the struck-through list price
   *  scales down from it, mirroring the prototype's own size parameter. */
  size?: number;
}) {
  const { formatMoney } = useCurrency();

  if (listPrice == null) {
    return (
      <Typography sx={{ fontWeight: 700, fontSize: size, fontVariantNumeric: 'tabular-nums' }}>
        {formatMoney(price)}
      </Typography>
    );
  }

  return (
    <Box data-list-price sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, whiteSpace: 'nowrap' }}>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: size,
          fontVariantNumeric: 'tabular-nums',
          color: (t) => t.vars!.palette.brand.amberStrong,
        }}
      >
        {formatMoney(price)}
      </Typography>
      <Typography
        data-testid="list-price"
        sx={{
          fontSize: Math.max(size - 1.5, 10.5),
          fontVariantNumeric: 'tabular-nums',
          color: 'text.secondary',
          textDecoration: 'line-through',
        }}
      >
        {formatMoney(listPrice)}
      </Typography>
    </Box>
  );
}
