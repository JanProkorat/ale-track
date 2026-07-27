import { type ReactNode } from 'react';
import { Box, ButtonBase } from '@mui/material';

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Segmented control matching the prototype's `.seg`: a grey rounded track with
 * a white, shadowed active pill. Used for status/view filters. */
export function SegControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: '2px',
        p: '3px',
        borderRadius: '8px',
        bgcolor: (t) => t.vars!.palette.brand.surface3,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            sx={{
              px: 1.6,
              py: 0.75,
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: on ? 'text.primary' : 'text.secondary',
              bgcolor: on ? 'background.paper' : 'transparent',
              boxShadow: on ? 1 : 'none',
              transition: 'background .12s, color .12s',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
