import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------

interface LoadingSpinnerProps {
     message?: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
     const { t } = useTranslation();

     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 6,
                    gap: 2,
               }}
          >
               <CircularProgress />
               <Typography variant="body2" color="text.secondary">
                    {message ?? t('common.loading')}
               </Typography>
          </Box>
     );
}
