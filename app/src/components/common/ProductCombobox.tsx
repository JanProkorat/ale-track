import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, Chip, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useBreweryColors } from 'src/hooks/useBreweries';
import { fmtLiters, plural } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { type ProductListItemDto } from 'src/generated/api-client';
import {
  buildRows,
  productComboLabel,
  type ComboRow,
  type ProductRow,
  type RowMotion,
} from './productComboModel';

/** Length of the open/close animation; also how long a closing row is kept. */
const MOTION_MS = 180;

/** Tall enough for the tallest row (name + chips) — see the keyframes below. */
const ROW_MAX_HEIGHT = 64;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Rows slide from zero height, which means animating `max-height` rather than
 * `height` (auto is not interpolable). The cap is reached before the animation
 * ends for short rows, so the easing is front-loaded to keep the motion even.
 */
const motionSx = (motion: RowMotion | undefined) => (motion ? {
  overflow: 'hidden',
  animation: `aletrack-row-${motion} ${MOTION_MS}ms ease-out`,
  animationFillMode: 'both',
  '@keyframes aletrack-row-in': {
    from: { maxHeight: 0, opacity: 0, transform: 'translateY(-4px)', paddingTop: 0, paddingBottom: 0 },
    to: { maxHeight: ROW_MAX_HEIGHT, opacity: 1, transform: 'none' },
  },
  '@keyframes aletrack-row-out': {
    from: { maxHeight: ROW_MAX_HEIGHT, opacity: 1, transform: 'none' },
    to: { maxHeight: 0, opacity: 0, transform: 'translateY(-4px)', paddingTop: 0, paddingBottom: 0 },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
} : null);

/**
 * Product picker shaped like the delivery/order catalog: brewery panels
 * (colour square, count, sticky head) containing products, with same-name size
 * variants nested under their own head. Both levels collapse.
 *
 * Collapsing works by dropping rows from the option list rather than hiding
 * them with CSS — arrow keys walk the rendered options, so a hidden-but-present
 * row would be a focus trap. Head rows stay *enabled* options because MUI puts
 * `pointer-events: none` on `aria-disabled` ones, which would make them
 * unclickable; instead the selection of a head is intercepted below and turned
 * into a collapse toggle, which gives Enter-to-toggle for free.
 */
export function ProductCombobox({
  label,
  value,
  onChange,
  products,
  trailing,
  loading,
  placeholder,
  disabled,
  required,
  error,
  helperText,
  clearable = true,
  autoFocus,
  size = 'small',
  fullWidth = true,
}: {
  label?: string;
  value: string | null;
  onChange: (productId: string | null) => void;
  products: ProductListItemDto[];
  /** Right-aligned context for a row, e.g. "skladem 12 ks". */
  trailing?: (product: ProductListItemDto) => string | undefined;
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  clearable?: boolean;
  autoFocus?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}) {
  const colorForBrewery = useBreweryColors();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [input, setInput] = useState('');
  // Set when the "selection" was a head row, so the close that MUI fires right
  // after can be ignored and the popup stays put.
  const toggledRef = useRef(false);

  const selected = useMemo<ProductRow | null>(() => {
    const p = products.find((x) => x.id === value);
    return p ? { type: 'product', key: p.id ?? '', product: p, breweryId: p.breweryId, standalone: true } : null;
  }, [products, value]);
  const selectedLabel = selected ? productComboLabel(selected.product) : '';

  // The input mirrors the selection whenever the popup is shut; while it is
  // open the text belongs to the user's search. MUI's own reset (which would
  // paste a head's label into the input) is ignored in onInputChange.
  useEffect(() => {
    if (!open) setInput(selectedLabel);
  }, [open, selectedLabel]);

  const options = useMemo<ComboRow[]>(
    () => products.map((p): ComboRow => ({
      type: 'product', key: p.id ?? '', product: p, breweryId: p.breweryId, standalone: true,
    })),
    [products],
  );

  // Rows animating in or out, cleared by a timer once the animation is over.
  // Collapsing has to defer the removal: the rows are the animation, so pulling
  // them from the option list immediately would leave nothing to watch.
  const [motion, setMotion] = useState<ReadonlyMap<string, RowMotion>>(() => new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const endMotion = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) { clearTimeout(timer); timers.current.delete(key); }
    setMotion((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearAllMotion = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setMotion(new Map());
  }, []);

  useEffect(() => clearAllMotion, [clearAllMotion]);

  const toggle = useCallback((key: string) => {
    const collapsing = !collapsed.has(key);
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

    // A toggle mid-animation replaces it rather than queueing behind it.
    const running = timers.current.get(key);
    if (running) { clearTimeout(running); timers.current.delete(key); }
    if (prefersReducedMotion()) { endMotion(key); return; }

    setMotion((prev) => new Map(prev).set(key, collapsing ? 'out' : 'in'));
    timers.current.set(key, setTimeout(() => endMotion(key), MOTION_MS));
  }, [collapsed, endMotion]);

  return (
    <Autocomplete<ComboRow, false, boolean, false>
      open={open}
      onOpen={() => { setCollapsed(new Set()); clearAllMotion(); setOpen(true); }}
      onClose={(_e, reason) => {
        if (toggledRef.current && reason === 'selectOption') { toggledRef.current = false; return; }
        setOpen(false);
      }}
      value={selected}
      onChange={(_e, row) => {
        if (row == null) { onChange(null); return; }
        if (row.type === 'product') { onChange(row.product.id ?? null); return; }
        toggledRef.current = true;
        toggle(row.key);
      }}
      inputValue={input}
      onInputChange={(_e, next, reason) => {
        // Only the user's own typing (and the clear button) may write the input.
        // Every other reason — 'selectOption' above all — is MUI echoing the
        // picked option's label back, which for a head row would paste the
        // brewery name in as a search term. The effect above owns that text.
        if (reason === 'input') setInput(next);
        if (reason === 'clear') setInput('');
      }}
      options={options}
      filterOptions={(opts, state) => buildRows(
        opts.flatMap((o) => (o.type === 'product' ? [o.product] : [])),
        { collapsed, search: state.inputValue, motion },
      )}
      // A row on its way out is inert: MUI skips disabled options in keyboard
      // navigation and blocks pointer events on them, so a click landing on a
      // shrinking row can't pick a product the user never aimed at.
      getOptionDisabled={(row) => row.type !== 'brewery' && row.motion === 'out'}
      getOptionLabel={(row) => {
        if (row.type === 'product') return productComboLabel(row.product);
        return row.type === 'brewery' ? row.breweryName : row.name;
      }}
      // Without this MUI keys every option by its label, and a brewery carries
      // plenty of products with the same name *and* size. The duplicate React
      // keys left collapsed rows stranded in the listbox and duplicated them on
      // the next expand; row keys are id-based and unique.
      getOptionKey={(row) => row.key}
      isOptionEqualToValue={(o, v) => o.key === v.key}
      renderOption={(props, row) => {
        const { key, ...liProps } = props as typeof props & { key: string };
        if (row.type === 'brewery') {
          return (
            <Box
              component="li"
              key={key}
              {...liProps}
              aria-expanded={!row.collapsed}
              sx={{
                position: 'sticky', top: -8, zIndex: 2,
                px: 1.25, py: 0.75, gap: 1,
                bgcolor: (t) => t.vars!.palette.brand.surface2,
                borderBottom: 1, borderColor: 'divider',
              }}
            >
              <ExpandMoreIcon
                fontSize="small"
                sx={{ color: 'text.secondary', flexShrink: 0, transition: 'transform .15s', transform: row.collapsed ? 'rotate(-90deg)' : 'none' }}
              />
              <Box sx={{ width: 9, height: 9, borderRadius: '2px', flexShrink: 0, bgcolor: colorForBrewery(row.breweryId) ?? 'text.disabled' }} />
              <Typography sx={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 0.3, textTransform: 'uppercase', flex: 1, minWidth: 0 }} noWrap>
                {row.breweryName}
              </Typography>
              <Chip
                size="small"
                label={`${row.count} ${plural(row.count, 'produkt', 'produkty', 'produktů')}`}
                sx={{ height: 20, fontSize: 11 }}
              />
            </Box>
          );
        }

        if (row.type === 'name') {
          return (
            <Box
              component="li"
              key={key}
              {...liProps}
              aria-expanded={!row.collapsed}
              sx={{ pl: 2, pr: 1.25, py: 0.75, gap: 1, bgcolor: 'action.hover', ...motionSx(row.motion) }}
            >
              <ExpandMoreIcon
                fontSize="small"
                sx={{ color: 'text.secondary', flexShrink: 0, transition: 'transform .15s', transform: row.collapsed ? 'rotate(-90deg)' : 'none' }}
              />
              <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0 }} noWrap>{row.name}</Typography>
              <Chip
                size="small"
                label={`${row.count} ${plural(row.count, 'velikost', 'velikosti', 'velikostí')}`}
                sx={{ height: 20, fontSize: 11 }}
              />
            </Box>
          );
        }

        const p = row.product;
        const hint = trailing?.(p);
        return (
          <Box
            component="li"
            key={key}
            {...liProps}
            sx={{
              display: 'block', pl: row.standalone ? 2 : 4, pr: 1.25, py: 0.75,
              '&[aria-selected="true"]': { bgcolor: (t) => t.vars!.palette.brand.amberTint },
              ...motionSx(row.motion),
            }}
          >
            {row.standalone && (
              <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{p.name}</Typography>
            )}
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: row.standalone ? 0.5 : 0 }}>
              <Chip size="small" label={kindLabel(p.kind)} sx={{ height: 20, fontSize: 11 }} />
              {p.packageSize != null && (
                <Chip size="small" label={fmtLiters(p.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
              )}
              <Box sx={{ flex: 1 }} />
              {hint && (
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary' }} noWrap>{hint}</Typography>
              )}
            </Stack>
          </Box>
        );
      }}
      slotProps={{ listbox: { sx: { maxHeight: 420, py: 0.5 } } }}
      loading={loading}
      loadingText="Načítání…"
      noOptionsText="Nic nenalezeno"
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      disableClearable={!clearable}
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
