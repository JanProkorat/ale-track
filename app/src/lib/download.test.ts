import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './download';

describe('downloadBlob', () => {
  const createObjectURL = vi.fn(() => 'blob:stub');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clicks a download anchor carrying the blob and the file name', () => {
    const clicks: HTMLAnchorElement[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push(this);
      });

    downloadBlob(new Blob(['xlsx']), 'vyvoz-2026-08-03.xlsx');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clicks).toHaveLength(1);
    expect(clicks[0].href).toContain('blob:stub');
    expect(clicks[0].download).toBe('vyvoz-2026-08-03.xlsx');

    clickSpy.mockRestore();
  });

  // Firefox ignores a click on an element outside the tree, so the anchor has to be attached —
  // and removed again, or every export would leave a node behind.
  it('leaves no anchor behind in the document', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['xlsx']), 'vyvoz.xlsx');

    expect(document.querySelectorAll('a')).toHaveLength(0);

    clickSpy.mockRestore();
  });

  // Safari aborts the download if the object URL dies in the same task as the click; leaking it
  // entirely would pin the whole blob in memory until the page unloads.
  it('revokes the object URL on a later tick, not synchronously', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['xlsx']), 'vyvoz.xlsx');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub');

    clickSpy.mockRestore();
  });
});
