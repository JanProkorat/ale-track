// Saving a file the API handed back. Kept out of the feature modules so every
// export in the app downloads the same way.

/** Prompts the browser to save `blob` under `fileName`.
 *
 * The object URL is revoked on the next tick rather than immediately: Safari
 * aborts the download if the URL dies in the same task as the click. A leaked
 * URL holds the whole blob in memory until the page unloads, so it does have to
 * be revoked — just not synchronously.
 *
 * The anchor is appended to the document before clicking because Firefox
 * ignores a click on an element that is not in the tree. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
