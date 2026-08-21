// The geometry the nakládka's two number clusters share — Zdroj's three sourcing lines
// and Faktury's chips.
//
// They share it, not just a look: `− value +` on tracks that stay the same width whether
// or not a line has buttons, so every number in a cluster sits in one column. A line
// without a stepper — "z pivovaru", or the computed first invoice — leaves its two button
// cells empty rather than pulling its number in beside its label.
//
// Sizes follow the pointer, not the viewport: 28px under a mouse, 44px under a finger.
// The one place that gives the bump back is a card under 500px, where Faktury and Zdroj
// sit side by side — two clusters at 44px want about 400px of the 338 a 390px phone
// leaves, so they stay at their pointer size there. That is a real loss of thumb comfort,
// and the alternative is stacking the two clusters, which made every row four blocks tall.
//
// Plain `.ts`, with {@link StepperButton} in its own file: a module exporting a component
// beside its helpers trips react-refresh, and CI holds the warning count at zero new.

export const STEPPER_BUTTON = 28;
export const STEPPER_BUTTON_TOUCH = 44;

/** Cancels the coarse-pointer bump where the two clusters share a phone's row. */
export const NARROW_CARD = '@container nakladka (max-width: 500px)';

/** What a stepper needs to nudge one number by a piece, in either cluster. */
export interface StepperAdjust {
  onAdjust: (delta: number) => void;
  canDecrease: boolean;
  canIncrease: boolean;
  decreaseLabel: string;
  increaseLabel: string;
}

/**
 * `gridTemplateColumns` for a cluster: the two button tracks with the value between
 * them, plus whatever the caller puts before (Zdroj's label) and after (the chip's
 * loading tick).
 *
 * `valueTouch` exists for the one value that is a field rather than a number: the theme
 * lifts an input to 16px under a coarse pointer, because iOS Safari zooms the whole page
 * for anything smaller, and the cell has to grow with it or clip a three-digit count.
 */
export function stepperTracks({ value, valueTouch = value, lead, tail }: {
  value: number;
  valueTouch?: number;
  lead?: string;
  tail?: string;
}) {
  const template = (button: number, cell: number) =>
    [lead, `${button}px`, `${cell}px`, `${button}px`, tail].filter(Boolean).join(' ');

  return {
    gridTemplateColumns: template(STEPPER_BUTTON, value),
    '@media (pointer: coarse)': {
      gridTemplateColumns: template(STEPPER_BUTTON_TOUCH, valueTouch),
      [NARROW_CARD]: { gridTemplateColumns: template(STEPPER_BUTTON, valueTouch) },
    },
  } as const;
}
