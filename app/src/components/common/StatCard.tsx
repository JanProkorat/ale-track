import { type ReactNode } from 'react';
import { Card, Stack, Box, Typography } from '@mui/material';
import { type StatusTone } from 'src/lib/labels';

const TONE_KEY: Record<StatusTone, 'amberTint' | 'okTint' | 'infoTint' | 'critTint' | 'greyTint'> = {
  amber: 'amberTint',
  ok: 'okTint',
  info: 'infoTint',
  crit: 'critTint',
  grey: 'greyTint',
};
const TONE_FG: Record<StatusTone, string> = {
  amber: 'brand.amberStrong',
  ok: 'success.main',
  info: 'info.main',
  crit: 'error.main',
  grey: 'text.secondary',
};

/** Compact KPI tile for dashboards and section stat bars. */
export function StatCard({
  icon,
  label,
  value,
  tone = 'grey',
  hint,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  tone?: StatusTone;
  hint?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s, transform .15s',
        ...(onClick && { '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' } }),
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            bgcolor: (t) => t.vars!.palette.brand[TONE_KEY[tone]],
            color: TONE_FG[tone],
            '& svg': { fontSize: 22 },
          }}
        >
          {icon}
        </Box>
      )}
      <Stack sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {hint}
          </Typography>
        )}
      </Stack>
    </Card>
  );
}
