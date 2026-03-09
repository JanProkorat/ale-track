import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Hook that warns about unsaved changes when closing/refreshing the browser tab.
// For in-app navigation, react-router's BrowserRouter does not support useBlocker,
// so we rely on the browser's native beforeunload event.
// ---------------------------------------------------------------------------

export function useUnsavedChangesWarning(isDirty: boolean) {
     useEffect(() => {
          if (!isDirty) return;

          const handler = (e: BeforeUnloadEvent) => {
               e.preventDefault();
          };

          window.addEventListener('beforeunload', handler);
          return () => window.removeEventListener('beforeunload', handler);
     }, [isDirty]);
}
