import CloseIcon from '@mui/icons-material/Close';
import { Dialog, IconButton, DialogContent } from '@mui/material';

import { MapView } from './map-view';

type MapDialogProps = {
     open: boolean;
     onClose: () => void;
     lat: number;
     lng: number;
};

export function MapDialog({ open, onClose, lat, lng }: MapDialogProps) {
     return (
          <Dialog open={open} onClose={onClose} fullScreen>
               <IconButton
                    onClick={onClose}
                    sx={{
                         position: 'absolute',
                         top: 8,
                         right: 8,
                         zIndex: 1300,
                    }}
               >
                    <CloseIcon />
               </IconButton>

               <DialogContent sx={{ p: 0, height: '100vh' }}>
                    <MapView lat={lat} lng={lng} isFullscreen={open} />
               </DialogContent>
          </Dialog>
     );
}
