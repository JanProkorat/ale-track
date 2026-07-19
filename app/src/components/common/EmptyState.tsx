import { type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

/** Neutral "nothing here yet" panel — for empty lists and filtered-to-zero. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  dense = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  dense?: boolean;
}) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: dense ? 4 : 7,
        px: 3,
        color: 'text.secondary',
      }}
    >
      <Box sx={{ color: 'text.disabled', mb: 1, '& svg': { fontSize: 42 } }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography fontWeight={700} color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 380, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
