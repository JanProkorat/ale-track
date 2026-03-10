import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, useContext, useCallback, createContext } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface UnsavedChangesContextValue {
     /** Register dirty state. */
     setDirty: (dirty: boolean) => void;
     /**
      * Attempt to navigate. If dirty, shows a dialog and calls `onProceed`
      * only if the user confirms. If clean, calls `onProceed` immediately.
      */
     navigate: (onProceed: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
     setDirty: () => {},
     navigate: (fn) => fn(),
});

export function useUnsavedChanges() {
     return useContext(UnsavedChangesContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
     const { t } = useTranslation();
     const dirtyRef = useRef(false);
     const [dialogOpen, setDialogOpen] = useState(false);
     const pendingRef = useRef<(() => void) | null>(null);

     const setDirty = useCallback((d: boolean) => {
          dirtyRef.current = d;
     }, []);

     // Browser tab close / refresh warning
     useEffect(() => {
          const handler = (e: BeforeUnloadEvent) => {
               if (dirtyRef.current) e.preventDefault();
          };
          window.addEventListener('beforeunload', handler);
          return () => window.removeEventListener('beforeunload', handler);
     }, []);

     const navigate = useCallback((onProceed: () => void) => {
          if (!dirtyRef.current) {
               onProceed();
               return;
          }
          pendingRef.current = onProceed;
          setDialogOpen(true);
     }, []);

     const handleCancel = () => {
          pendingRef.current = null;
          setDialogOpen(false);
     };

     const handleDiscard = () => {
          setDialogOpen(false);
          dirtyRef.current = false;
          pendingRef.current?.();
          pendingRef.current = null;
     };

     return (
          <UnsavedChangesContext.Provider value={{ setDirty, navigate }}>
               {children}

               <Dialog open={dialogOpen} onClose={handleCancel}>
                    <DialogTitle>{t('unsavedChanges.title')}</DialogTitle>
                    <DialogContent>
                         <DialogContentText>
                              {t('unsavedChanges.message')}
                         </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                         <Button onClick={handleCancel}>
                              {t('common.cancel')}
                         </Button>
                         <Button color="error" onClick={handleDiscard}>
                              {t('unsavedChanges.discard')}
                         </Button>
                    </DialogActions>
               </Dialog>
          </UnsavedChangesContext.Provider>
     );
}
