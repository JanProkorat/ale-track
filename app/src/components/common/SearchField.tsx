import { useEffect, useRef, useState } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';

/** Debounced search box. Keeps its own text state and pushes changes up after
 * `delay`ms, so list filtering doesn't run on every keystroke. */
export function SearchField({
  value,
  onChange,
  placeholder = 'Hledat…',
  delay = 200,
  width = 260,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
  width?: number | string;
}) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => onChangeRef.current(local), delay);
    return () => clearTimeout(t);
  }, [local, delay]);

  return (
    <TextField
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder={placeholder}
      size="small"
      sx={{ width }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="disabled" />
            </InputAdornment>
          ),
          endAdornment: local ? (
            <InputAdornment position="end">
              <IconButton size="small" edge="end" onClick={() => setLocal('')} aria-label="Vymazat">
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}
