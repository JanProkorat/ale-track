import { describe, expect, it } from 'vitest';
import { PATHS } from 'src/routes/paths';
import { isNavPathActive } from './nav-config';

describe('isNavPathActive', () => {
  it('marks the item whose path is the current route', () => {
    expect(isNavPathActive('/sales', PATHS.sales)).toBe(true);
  });

  it('keeps the module active on its detail and editor routes', () => {
    expect(isNavPathActive('/sales/abc123', PATHS.sales)).toBe(true);
    expect(isNavPathActive('/sales/abc123/edit', PATHS.sales)).toBe(true);
    expect(isNavPathActive('/sales/new', PATHS.sales)).toBe(true);
  });

  /**
   * The regression this guards: a bare startsWith made /sales-reports match /sales too, so
   * both Prodeje and the garage-sale Reporty rendered active at once. Only a full path segment
   * counts as being inside a module.
   */
  it('does not mark a module active for a sibling path that merely shares its prefix', () => {
    expect(isNavPathActive('/sales-reports', PATHS.sales)).toBe(false);
    expect(isNavPathActive('/sales-reports', PATHS.salesReports)).toBe(true);
  });

  it('matches the dashboard only exactly, never as a prefix of everything', () => {
    expect(isNavPathActive('/', PATHS.dashboard)).toBe(true);
    expect(isNavPathActive('/sales', PATHS.dashboard)).toBe(false);
  });
});
