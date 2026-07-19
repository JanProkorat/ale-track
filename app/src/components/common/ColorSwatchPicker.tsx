import { Box, ButtonBase } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

/** Pick a color from a fixed palette. Used for brewery/driver color coding. */
export function ColorSwatchPicker({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (color: string) => void;
  colors: string[];
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {colors.map((c) => {
        const selected = value?.toLowerCase() === c.toLowerCase();
        return (
          <ButtonBase
            key={c}
            onClick={() => onChange(c)}
            aria-label={c}
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              bgcolor: c,
              color: '#fff',
              boxShadow: selected ? (t) => `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${c}` : 'none',
              transition: 'box-shadow .12s',
            }}
          >
            {selected && <CheckIcon sx={{ fontSize: 18 }} />}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
