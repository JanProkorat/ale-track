import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

interface PageHeaderProps {
     title: string;
     action?: ReactNode;
}

export default function PageHeader({ title, action }: PageHeaderProps) {
     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    mb: 3,
               }}
          >
               <Typography variant="h5" component="h1">
                    {title}
               </Typography>

               {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
          </Box>
     );
}
