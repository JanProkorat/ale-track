import { type ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';

/** The prototype's chart card: amber icon, title, optional control on the right. */
export function ChartCard({
  icon,
  title,
  action,
  children,
  padded = true,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <Card>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center', '& svg': { fontSize: 18 } }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>{title}</Typography>
        {action && <Box sx={{ ml: 'auto' }}>{action}</Box>}
      </Stack>
      <Box sx={padded ? { p: 2 } : undefined}>{children}</Box>
    </Card>
  );
}
