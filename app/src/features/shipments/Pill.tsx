// Small rounded status chip used across the Fakturace band header (route stop
// counts, cross-billing, lock state, …). Its own file — rather than living
// inside ShipmentInvoicing.tsx, which already brushes the 500-line guideline —
// because BandBillingRecipients.tsx needs the exact same look for its one
// interactive pill, and duplicating the style would be the "third chip style"
// the design explicitly rules out.

import { Box } from '@mui/material';

export function Pill({ tint, color, icon, onClick, disabled, pressed, ariaLabel, children }: {
  tint: 'okTint' | 'infoTint' | 'amberTint' | 'critTint' | 'greyTint';
  color: string;
  icon?: React.ReactNode;
  /** Present only for the pills that are also controls — renders as a real button
   *  (native focus/keyboard handling) instead of a plain span. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Makes the pill announce as a toggle, for the ones that carry a state rather than open something. */
  pressed?: boolean;
  /** For pills whose visible word repeats down the screen — several bands each say "Hotovo". */
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-pressed={onClick && pressed !== undefined ? pressed : undefined}
      aria-label={ariaLabel}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 23,
        px: 1.25, py: 0, borderRadius: 99, fontSize: 11.5, fontWeight: 700, color,
        bgcolor: (t) => t.vars!.palette.brand[tint],
        whiteSpace: 'nowrap',
        ...(onClick && {
          border: 0, margin: 0, appearance: 'none', fontFamily: 'inherit',
          cursor: 'pointer',
          '&:hover': { filter: 'brightness(0.95)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
          // The write is in flight: the pill already shows where it is going, it just cannot be
          // clicked again until it lands.
          '&:disabled': { cursor: 'default', opacity: 0.55, filter: 'none' },
        }),
      }}
    >
      {icon}
      {children}
    </Box>
  );
}
