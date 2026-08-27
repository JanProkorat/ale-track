// The numbered circle is shared by Přehled zastávek and the vykládka, and in the vykládka it is
// also the control that marks a stop off. Two things earn tests: that the circle only becomes a
// button where there is something to mark, and that a finished stop reads as a check.

import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { StopAvatar, type StopAvatarKind } from './StopAvatar';

function renderAvatar(props: {
  kind?: StopAvatarKind;
  done?: boolean;
  onToggleDone?: () => void;
} = {}) {
  return render(
    <MuiThemeProvider theme={theme}>
      <StopAvatar
        kind={props.kind ?? 'order'}
        seq={3}
        clientId="client-a"
        done={props.done}
        onToggleDone={props.onToggleDone}
        label="Označit jako hotovo"
        testId="stop"
      />
    </MuiThemeProvider>,
  );
}

describe('StopAvatar', () => {
  it('shows the route position while the stop is still to come', () => {
    renderAvatar();

    expect(screen.getByTestId('stop')).toHaveTextContent('3');
    expect(screen.queryByTestId('stop-done-check')).not.toBeInTheDocument();
  });

  // The circle also turns green when done — asserted nowhere, because under cssVariables the
  // background is a CSS variable that happy-dom's computed style does not resolve. What a test
  // can hold onto is the check taking the number's place.
  it('reads as a check once the run has finished with the stop', () => {
    renderAvatar({ done: true });

    expect(screen.getByTestId('stop-done-check')).toBeInTheDocument();
    expect(screen.getByTestId('stop')).not.toHaveTextContent('3');
  });

  // Přehled zastávek passes no handler: there the circle is a label, not a control, and must not
  // announce itself as something to press.
  it('is not a control without a handler', () => {
    renderAvatar({ done: true });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is a real button, announcing its state, when it can be marked', () => {
    const toggle = vi.fn();
    renderAvatar({ onToggleDone: toggle });

    const circle = screen.getByRole('button', { name: 'Označit jako hotovo' });
    expect(circle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(circle);

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('announces a finished stop as pressed', () => {
    renderAvatar({ done: true, onToggleDone: vi.fn() });

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  // The kind badge keeps its corner whatever the circle is doing, so a finished pickup still says
  // it is a pickup.
  it('keeps the kind badge on a finished pickup', () => {
    renderAvatar({ kind: 'supplier', done: true });

    expect(screen.getByTestId('stop-done-check')).toBeInTheDocument();
    // The check plus the kind icon.
    expect(screen.getByTestId('stop').querySelectorAll('svg')).toHaveLength(2);
  });
});
