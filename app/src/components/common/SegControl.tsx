import { type ReactNode } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { mobileGrid } from './segControlModel';

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
  const { columns, lastSpansRow } = mobileGrid(options.length);

  return (
    <Box
      sx={{
        display: columns ? { xs: 'grid', compact: 'inline-flex' } : 'inline-flex',
        gridTemplateColumns: columns
          ? { xs: `repeat(${columns}, minmax(0, 1fr))`, compact: 'none' }
          : undefined,
        flexWrap: 'wrap',
        gap: '2px',
        p: '3px',
        borderRadius: '8px',
        bgcolor: (t) => t.vars!.palette.brand.surface3,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const spansRow = lastSpansRow && i === options.length - 1;
        return (
          <ButtonBase
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            sx={{
              gridColumn: spansRow ? { xs: '1 / -1', compact: 'auto' } : undefined,
              // Tighter gutters and minWidth:0 in a grid cell: a long label like
              // "Dokončené 431" wraps inside its cell rather than overflowing it.
              px: columns ? { xs: 0.75, compact: 1.6 } : 1.6,
              py: 0.75,
              minWidth: 0,
              justifyContent: 'center',
              textAlign: 'center',
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
