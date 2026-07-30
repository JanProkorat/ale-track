import { type ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';

/** The prototype's chart card: amber icon, title, optional control on the right.
 *
 * `fill` opts into growing to the height of its grid row (the row's tallest card) and
 * centring the body in whatever space is left over. Two charts sitting side by side get one
 * row per data point, so a 10-client chart towers over a 4-region one; without this the pair
 * looks broken, and with the body top-aligned the whole gap collects under the shorter
 * chart. Off by default — a card that already fills its row must not change.
 */
export function ChartCard({
  icon,
  title,
  action,
  children,
  padded = true,
  fill = false,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  fill?: boolean;
}) {
  return (
    <Card sx={fill ? { display: 'flex', flexDirection: 'column' } : undefined}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center', '& svg': { fontSize: 18 } }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>{title}</Typography>
        {action && <Box sx={{ ml: 'auto' }}>{action}</Box>}
      </Stack>
      <Box
        sx={{
          ...(padded ? { p: 2 } : null),
          ...(fill ? { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } : null),
        }}
      >
        {children}
      </Box>
    </Card>
  );
}
