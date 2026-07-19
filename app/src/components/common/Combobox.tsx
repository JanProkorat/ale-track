import { Autocomplete, TextField } from '@mui/material';

export interface ComboOption {
  value: string;
  label: string;
  /** Optional group heading (e.g. region, brewery) for sectioned lists. */
  group?: string;
}

/** App-wide filterable typeahead. Every select in the app is one of these —
 * users type to filter and pick. Wraps MUI Autocomplete with a value-string API. */
export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  size = 'small',
  fullWidth = true,
  required,
  error,
  helperText,
  clearable = true,
  autoFocus,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  clearable?: boolean;
  autoFocus?: boolean;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  const grouped = options.some((o) => o.group);
  return (
    <Autocomplete<ComboOption, false, boolean, false>
      value={selected}
      onChange={(_e, opt) => onChange(opt ? opt.value : null)}
      options={options}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      groupBy={grouped ? (o) => o.group ?? '' : undefined}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      disableClearable={!clearable}
      noOptionsText="Nic nenalezeno"
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          autoFocus={autoFocus}
        />
      )}
    />
  );
}
