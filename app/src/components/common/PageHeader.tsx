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
      {/* On a phone the actions take their own full-width row and stretch to fill
          it — one button spans, a cancel/save pair splits — rather than hanging
          off the right edge under the title. */}
      {actions && (
        <Box
          sx={{
            ml: { compact: 'auto' },
            width: { xs: '100%', compact: 'auto' },
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            '& > *': { flex: { xs: '1 1 auto', compact: '0 0 auto' } },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  // Prototype `.page` below 860px: padding 16px 14px 50px.
  return (
    <Box
      sx={{
        px: { xs: 1.75, mobile: 3.5 },
        pt: { xs: 2, mobile: 3 },
        pb: { xs: 6.25, mobile: 8 },
        maxWidth: 1500,
        mx: 'auto',
        width: '100%',
      }}
    >
      {children}
    </Box>
  );
}
