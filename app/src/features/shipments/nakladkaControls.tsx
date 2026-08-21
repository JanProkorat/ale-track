// The controls the nakládka's two number clusters are built from — Zdroj's three
// sourcing lines and Faktury's chips.
//
// They share a geometry, not just a look: `− value +` on tracks that stay the same
// width whether or not a line has buttons, so every number in a cluster sits in one
// column. A line without a stepper — "z pivovaru", or the computed first invoice —
// leaves its two button cells empty rather than pulling its number in beside its label.
//
// Sizes follow the pointer, not the viewport: 28px under a mouse, 44px under a finger.
// The one place that gives the bump back is a card under 500px, where Faktury and Zdroj
// sit side by side — two clusters at 44px want about 400px of the 338 a 390px phone
// leaves, so they stay at their pointer size there. That is a real loss of thumb comfort
// and the alternative is stacking the two clusters, which made every row four blocks tall.

import { IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';

/** What a stepper needs to nudge one number by a piece, in either cluster. */
export interface StepperAdjust {
  onAdjust: (delta: number) => void;
  canDecrease: boolean;
  canIncrease: boolean;
  decreaseLabel: string;
  increaseLabel: string;
}

const BUTTON = 28;
const BUTTON_TOUCH = 44;

/** Cancels the coarse-pointer bump where the two clusters share a phone's row. */
const NARROW = '@container nakladka (max-width: 500px)';

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
    gridTemplateColumns: template(BUTTON, value),
    '@media (pointer: coarse)': {
      gridTemplateColumns: template(BUTTON_TOUCH, valueTouch),
      [NARROW]: { gridTemplateColumns: template(BUTTON, valueTouch) },
    },
  } as const;
}

/**
 * One ± button, on the track {@link stepperTracks} reserves for it.
 *
 * An outlined square rather than a bare icon: it has to read as pressable inside a
 * filled chip, where a borderless glyph disappears into the tint.
 */
export function StepperButton({ sign, onClick, disabled, label }: {
  sign: -1 | 1;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <IconButton
      size="small"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      sx={{
        width: BUTTON,
        height: BUTTON,
        borderRadius: '7px',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.secondary',
        justifySelf: 'center',
        '&:hover': {
          bgcolor: 'background.paper',
          borderColor: 'primary.main',
          color: (t) => t.vars!.palette.brand.amberStrong,
        },
        '&.Mui-disabled': { opacity: 0.35, color: 'text.secondary', borderColor: 'divider' },
        // The theme gives every IconButton a 44px minimum under a coarse pointer, which is
        // what the ramp wants — but not once two clusters share a phone's row.
        '@media (pointer: coarse)': {
          [NARROW]: { minWidth: BUTTON, minHeight: BUTTON },
        },
      }}
    >
      {sign < 0 ? <RemoveIcon sx={{ fontSize: 15 }} /> : <AddIcon sx={{ fontSize: 15 }} />}
    </IconButton>
  );
}
