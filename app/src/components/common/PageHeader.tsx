import { type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      flexWrap="wrap"
      useFlexGap
      sx={{ mb: 1.5 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'primary.dark',
              mb: 0.6,
            }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h1" sx={{ fontSize: 26 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 14 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</Box>}
    </Stack>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <Box sx={{ px: { xs: 2, md: 3.5 }, py: 3, pb: 8, maxWidth: 1500, mx: 'auto', width: '100%' }}>{children}</Box>;
}
