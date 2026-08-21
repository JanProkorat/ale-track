import { IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import { NARROW_CARD, STEPPER_BUTTON } from './nakladkaControls';

/**
 * One ± button of a nakládka cluster, on the track {@link stepperTracks} reserves for it.
 *
 * An outlined square rather than a bare icon: it has to read as pressable inside a filled
 * chip, where a borderless glyph disappears into the tint.
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
        width: STEPPER_BUTTON,
        height: STEPPER_BUTTON,
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
          [NARROW_CARD]: { minWidth: STEPPER_BUTTON, minHeight: STEPPER_BUTTON },
        },
      }}
    >
      {sign < 0 ? <RemoveIcon sx={{ fontSize: 15 }} /> : <AddIcon sx={{ fontSize: 15 }} />}
    </IconButton>
  );
}
