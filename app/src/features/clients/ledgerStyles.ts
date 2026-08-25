// Shared look of the "record a change" affordance, which appears on two screens — the order
// detail's header and each stop of the run's Vykládka. One copy, so the two cannot drift into
// looking like different actions.

/**
 * An outlined button in the prototype's amber: amber border, amber label, no fill.
 *
 * Paired with `variant="outlined"` at each call site. The amber is the prototype's `.btn-soft`
 * palette, which this theme already carries — `amberStrong` for the label, `amberTint` for the
 * hover ground. Deliberately `amberStrong` and not `primary.dark` (that one is `amberHover`, a
 * lighter shade a few older soft buttons happen to use): against the card the darker amber is the
 * more readable of the two.
 *
 * The ground stays transparent until hover, so this sits beside Upravit as a button of the same
 * family — the amber marks it as the different action, the outline keeps it from shouting.
 *
 * Colours go through `theme.vars.palette.*` — under MUI cssVars a `theme.palette.*` read inside
 * a callback freezes at the light value and only dark mode shows it.
 */
export const recordButtonSx = {
  fontWeight: 700,
  borderColor: 'primary.main',
  color: (t: { vars?: { palette: { brand: Record<string, string> } } }) =>
    t.vars!.palette.brand.amberStrong,
  '&:hover': {
    borderColor: 'primary.main',
    bgcolor: (t: { vars?: { palette: { brand: Record<string, string> } } }) =>
      t.vars!.palette.brand.amberTint,
  },
} as const;

/** Full phrase, kept as the accessible name and the tooltip while the button reads just "Změna". */
export const RECORD_CHANGE_LABEL = 'Zaznamenat změnu';

/** What the button itself shows. */
export const RECORD_CHANGE_SHORT = 'Změna';
