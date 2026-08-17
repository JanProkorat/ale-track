import { type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * One stat cell inside a page's stat bar — a plain inline cell rather than its own floating
 * Card, separated from its neighbour by a left border.
 *
 * Distinct from `StatCard`, which is the standalone tile the dashboard lays out in a grid. This
 * one only makes sense inside a bar that also holds the page's filters, so the whole toolbar
 * reads as a single strip (Sklad, Prodeje).
 */
export function StatCell({
  icon,
  label,
  value,
  critical,
  first,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  critical?: boolean;
  /** The leading cell carries no left border, so the strip does not open with a stray rule. */
  first?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: '0 1 auto',
        minWidth: 112,
        px: 1.875,
        py: 1.375,
        ...(!first && { borderLeft: '1px solid', borderColor: 'divider' }),
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          bgcolor: (t) => (critical ? t.vars!.palette.brand.critTint : t.vars!.palette.brand.greyTint),
          color: critical ? 'error.main' : 'text.secondary',
          '& svg': { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, ...(critical && { color: 'error.main' }) }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
