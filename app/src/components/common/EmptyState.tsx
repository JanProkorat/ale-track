import type { ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InboxIcon from '@mui/icons-material/InboxOutlined';

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

interface EmptyStateProps {
     message?: string;
     icon?: ReactNode;
     action?: ReactNode;
}

export default function EmptyState({ message, icon, action }: EmptyStateProps) {
     const { t } = useTranslation();

     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 8,
                    gap: 2,
                    color: 'text.secondary',
               }}
          >
               {icon ?? <InboxIcon sx={{ fontSize: 48 }} />}

               <Typography variant="body1" color="text.secondary">
                    {message ?? t('common.noData')}
               </Typography>

               {action}
          </Box>
     );
}
