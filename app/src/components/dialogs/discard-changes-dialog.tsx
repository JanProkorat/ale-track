import { useTranslation } from 'react-i18next';

import { Dialog, Button, DialogTitle, DialogActions } from '@mui/material';

type DiscardChangesDialogProps = {
     open: boolean;
     onClose: () => void;
     onDiscard: () => void;
};

export function DiscardChangesDialog({ open, onClose, onDiscard }: Readonly<DiscardChangesDialogProps>) {
     const { t } = useTranslation();

     return (
          <Dialog open={open} onClose={onClose}>
               <DialogTitle>{t('common.unsavedChangesLossConfirm')}</DialogTitle>
               <DialogActions>
                    <Button onClick={onClose} variant="contained" color="primary">
                         {t('common.cancel')}
                    </Button>
                    <Button onClick={onDiscard} color="inherit">
                         {t('common.continue')}
                    </Button>
               </DialogActions>
          </Dialog>
     );
}
