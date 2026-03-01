import React from 'react';
import { useTranslation } from 'react-i18next';
import { varAlpha } from 'minimal-shared/utils';

import { Box, Button, Typography } from '@mui/material';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

interface DrawerLayoutProps {
     title: string;
     isLoading: boolean;
     onClose: () => void;
     onSaveAndClose: () => void;
     children: React.ReactNode;
     width?: number;
}

export const DrawerLayout: React.FC<DrawerLayoutProps> = ({
     title,
     isLoading,
     onClose,
     onSaveAndClose,
     children,
     width,
}) => {
     const { t } = useTranslation();

     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '95vh',
                    maxWidth: { xs: '100vw', md: width ?? 700 },
                    width: '100%',
                    p: { xs: 2, md: 3 },
                    gap: 3,
               }}
          >
               {/* Header */}
               <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                         {title}
                    </Typography>
               </Box>

               {/* Content */}
               <Box
                    sx={{
                         flex: 1,
                         minHeight: 0,
                         overflowY: 'auto',
                         pr: 1,
                         ...(isLoading && {
                              display: 'flex',
                              alignItems: 'flex-start',
                              pt: 2,
                         }),
                    }}
               >
                    {isLoading ? (
                         <LinearProgress
                              sx={{
                                   width: '100%',
                                   maxWidth: 320,
                                   bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                   [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
                              }}
                         />
                    ) : (
                         children
                    )}
               </Box>

               {/* Footer */}
               <Box
                    sx={{
                         display: 'flex',
                         justifyContent: 'flex-end',
                         gap: 2,
                         pt: 2,
                         borderTop: 1,
                         borderColor: 'divider',
                    }}
               >
                    <Button variant="outlined" onClick={onClose}>
                         {t('common.close')}
                    </Button>
                    <Button variant="contained" onClick={onSaveAndClose}>
                         {t('common.saveAndClose')}
                    </Button>
               </Box>
          </Box>
     );
};
