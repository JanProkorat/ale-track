// Both rules here are invisible to every other test: drop one and nothing fails except
// the phone, where the viewport starts jumping again. They are cheap to assert and were
// each written in response to a real report, so they get a guard.

import { describe, it, expect } from 'vitest';
import { theme } from './theme';

type Rules = Record<string, unknown>;

describe('theme — mobile zoom guards', () => {
  /** iOS Safari force-zooms when a focused form control is under 16px, and the
   * prototype's 14px body size makes every field exactly that. */
  it('lifts form controls to 16px on a touch pointer', () => {
    const input = theme.components?.MuiInputBase?.styleOverrides?.input as Rules;

    expect(input['@media (pointer: coarse)']).toEqual({ fontSize: 16 });
  });

  it('opts interactive elements out of double-tap zoom', () => {
    const baseline = theme.components?.MuiCssBaseline?.styleOverrides as (t: unknown) => Rules;
    const css = baseline(theme);

    const rule = Object.entries(css).find(([selector]) => selector.includes('.MuiButtonBase-root'));
    expect(rule?.[1]).toEqual({ touchAction: 'manipulation' });
    // dnd-kit puts role="button" on drag handles that need `touch-action: none`; matching
    // that role here would fight them for the same declaration.
    expect(rule?.[0]).not.toContain('[role="button"]');
  });

  /** The other way to stop the zooming is a maximum-scale / user-scalable viewport lock,
   * which also kills pinch-zoom — a WCAG 1.4.4 failure. It must stay out. */
  it('never locks the viewport scale', () => {
    const baseline = theme.components?.MuiCssBaseline?.styleOverrides as (t: unknown) => Rules;

    expect(JSON.stringify(baseline(theme))).not.toContain('user-scalable');
  });
});
