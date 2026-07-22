import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

/**
 * Guards an editor against losing unsaved changes. Blocks in-app navigation
 * (React Router `useBlocker`) while `when` is true, and shows the browser's
 * native prompt on hard reload/close (`beforeunload`).
 *
 * Returns the `blocker` (feed it to <UnsavedChangesDialog/>) and `allowNext()`,
 * which the editor calls right before its *own* save-then-navigate so that
 * intentional navigation isn't blocked.
 */
export function useUnsavedChangesGuard(when: boolean): { blocker: Blocker; allowNext: () => void } {
  const allowRef = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    when && !allowRef.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!when) return undefined;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  const allowNext = useCallback(() => { allowRef.current = true; }, []);
  return { blocker, allowNext };
}

/**
 * The "unsaved changes" dialog. `onSave` must persist and resolve `true` on
 * success / `false` on failure (it should NOT navigate); on success the guard
 * continues to the originally-intended destination.
 */
export function UnsavedChangesDialog({ blocker, onSave, busy = false }: {
  blocker: Blocker;
  onSave: () => Promise<boolean>;
  busy?: boolean;
}) {
  const blocked = blocker.state === 'blocked';

  const saveAndLeave = async () => {
    const ok = await onSave();
    if (ok) blocker.proceed?.();
    else blocker.reset?.();
  };

  return (
    <Dialog open={blocked} onClose={() => blocker.reset?.()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Neuložené změny</DialogTitle>
      <DialogContent>
        <DialogContentText>Máte neuložené změny. Chcete je před odchodem uložit?</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={() => blocker.reset?.()} color="inherit">Zrušit</Button>
        <Button onClick={() => blocker.proceed?.()} color="error">Zahodit změny</Button>
        <Button onClick={saveAndLeave} variant="contained" disabled={busy}>Uložit a odejít</Button>
      </DialogActions>
    </Dialog>
  );
}
