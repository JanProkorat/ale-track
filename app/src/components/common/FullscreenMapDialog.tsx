import type { ReactNode } from 'react';

import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

interface FullscreenMapDialogProps {
     open: boolean;
     onClose: () => void;
     children: ReactNode;
}

export default function FullscreenMapDialog({ open, onClose, children }: FullscreenMapDialogProps) {
     return (
          <Dialog
               open={open}
               onClose={onClose}
               fullScreen
               slotProps={{
                    paper: {
                         sx: {
                              '& .leaflet-container': { height: '100%', width: '100%' },
                         },
                    },
               }}
          >
               <IconButton
                    onClick={onClose}
                    sx={{
                         position: 'absolute',
                         top: 12,
                         right: 12,
                         zIndex: 1000,
                         bgcolor: 'background.paper',
                         boxShadow: 2,
                         '&:hover': { bgcolor: 'background.default' },
                    }}
               >
                    <CloseIcon />
               </IconButton>
               {children}
          </Dialog>
     );
}
