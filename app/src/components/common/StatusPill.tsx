import { Box, useTheme } from '@mui/material';
import { type Theme } from '@mui/material/styles';
import { type StatusTone } from 'src/lib/labels';

function toneColors(theme: Theme, tone: StatusTone): { bg: string; fg: string } {
  const b = theme.palette.brand;
  switch (tone) {
    case 'amber':
      return { bg: b.amberTint, fg: b.amberStrong };
    case 'ok':
      return { bg: b.okTint, fg: theme.palette.success.main };
    case 'info':
      return { bg: b.infoTint, fg: theme.palette.info.main };
    case 'crit':
      return { bg: b.critTint, fg: theme.palette.error.main };
    case 'grey':
    default:
      return { bg: b.greyTint, fg: b.greyPill };
  }
}

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const theme = useTheme();
  const { bg, fg } = toneColors(theme, tone);
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: 23,
        px: 1.25,
        borderRadius: 999,
        bgcolor: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: 99, bgcolor: 'currentColor' }} />
      {label}
    </Box>
  );
}
