import { useMemo, useState } from 'react';
import { Autocomplete, Box, TextField, Typography, createFilterOptions } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import { buildGroupRows, type ComboRow } from './comboboxGroups';

export interface ComboOption {
  value: string;
  label: string;
  /** Optional group heading (e.g. region, brewery) for sectioned lists. */
  group?: string;
}

/** App-wide filterable typeahead. Every select in the app is one of these —
 * users type to filter and pick. Wraps MUI Autocomplete with a value-string API.
 *
 * `collapsibleGroups` solves the same problem as ProductCombobox's brewery
 * heads, but deliberately more cheaply: heads are *disabled* options (keyboard
 * navigation skips them, MUI refuses them as a value) with pointer events put
 * back by `sx`, instead of ProductCombobox's enabled heads + intercepted
 * selection. That trade gives up Enter-to-toggle, and buys not having to make
 * this shared component's `open` and `inputValue` controlled for the ~20 call
 * sites that don't group at all. */
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
  collapsibleGroups = false,
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
  /** Renders each `group` as a clickable header that folds its options away.
   * Opt-in: without it the groups render as MUI's plain, always-open headings.
   * Collapse state is per-mount, so it survives reopening the dropdown but not
   * a reload. */
  collapsibleGroups?: boolean;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  const grouped = options.some((o) => o.group);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());

  // Only the choices are matched against the query; headers are rebuilt around
  // the survivors afterwards, so the search behaves exactly as it does for a
  // flat list (MUI's own matcher, accents ignored).
  const matchOptions = useMemo(() => createFilterOptions<ComboRow>(), []);

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(group)) {
        next.add(group);
      }
      return next;
    });
  };

  const collapsible = collapsibleGroups && grouped;

  return (
    <Autocomplete<ComboRow, false, boolean, false>
      value={selected}
      onChange={(_e, opt) => onChange(opt ? opt.value : null)}
      options={options}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      groupBy={grouped && !collapsible ? (o) => o.group ?? '' : undefined}
      filterOptions={
        collapsible
          ? (opts, state) => buildGroupRows(matchOptions(opts, state), collapsed, Boolean(state.inputValue))
          : undefined
      }
      // Headers sit in the same list as the choices, so they have to be skipped
      // by arrow-key navigation and refused as a value. Disabling them does
      // both; the row itself re-enables pointer events to stay clickable.
      getOptionDisabled={collapsible ? (o) => Boolean(o.header) : undefined}
      renderOption={
        collapsible
          ? (props, option) => {
              const { key, ...liProps } = props;
              if (!option.header) {
                return <li key={key} {...liProps}>{option.label}</li>;
              }
              return (
                <Box
                  component="li"
                  key={key}
                  {...liProps}
                  aria-expanded={!option.collapsed}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleGroup(option.label);
                  }}
                  sx={{
                    // MUI dims disabled options and kills their pointer events;
                    // a header is only "disabled" to keep it out of keyboard
                    // navigation and out of the value, so undo both.
                    '&.Mui-disabled': { opacity: 1, pointerEvents: 'auto' },
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                  }}
                >
                  {option.collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  <Typography sx={{ fontWeight: 700, fontSize: 12.5, flex: 1, minWidth: 0 }} noWrap>
                    {option.label}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{option.count}</Typography>
                </Box>
              );
            }
          : undefined
      }
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
