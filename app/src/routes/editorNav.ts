import { type NavigateFunction } from 'react-router-dom';

/**
 * Leave a routed editor (`/x/:id/edit` or `/x/new`) without leaving that entry
 * on the history stack, so pressing Back from the detail goes to the list — not
 * back into the editor. When there's real in-app history we pop it (`navigate(-1)`);
 * otherwise (deep link / hard refresh on the editor) we replace with `fallback`.
 */
export function backOrReplace(navigate: NavigateFunction, fallback: string): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
