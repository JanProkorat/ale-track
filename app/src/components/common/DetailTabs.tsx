import {
  createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Box, Stack } from '@mui/material';

/**
 * The tab strip's action slot. Held as state rather than only a ref so that mounting it
 * re-renders the consumers waiting to fill it.
 */
const TabActionSlotContext = createContext<HTMLDivElement | null>(null);

/**
 * A detail screen's tab strip, with a right-aligned slot for the open tab's actions on the
 * same row.
 *
 * Before this, every tab that had an action stacked it *under* the strip — a lone button on
 * its own line, pushing the content it belongs to down the page. The actions now sit at the
 * end of the strip, one notch smaller than the page header's buttons so the header stays the
 * loudest thing on the screen.
 *
 * Panels deliver their buttons through {@link TabActions} rather than as a prop, so a panel
 * keeps owning the drawer state its buttons open. Lifting that into three detail screens to
 * pass an `actions` prop down would have moved real logic to serve a layout change.
 */
export function DetailTabs({ tabs, children }: { tabs: ReactNode; children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  // A layout effect, not a plain one: it runs before the browser paints, so actions never
  // show for a frame in their fallback position below the strip before moving up into it.
  useLayoutEffect(() => setSlot(slotRef.current), []);

  return (
    <TabActionSlotContext.Provider value={slot}>
      <Stack
        direction="row"
        alignItems="flex-end"
        spacing={2}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {/* minWidth:0 keeps the scrollable strip from pushing the actions off the row. */}
        <Box sx={{ minWidth: 0, flex: 1 }}>{tabs}</Box>
        <Box
          ref={slotRef}
          data-testid="tab-actions-slot"
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            flexShrink: 0,
            pb: 0.75,
            // Sized here rather than by passing size="small" to each button: the metrics are
            // a property of this slot, so a panel cannot forget them.
            '& .MuiButton-root': { minHeight: 32, py: 0.35, px: 1.25, fontSize: 13 },
            '& .MuiButton-root .MuiButton-startIcon > *': { fontSize: 17 },
          }}
        />
      </Stack>
      {children}
    </TabActionSlotContext.Provider>
  );
}

/**
 * Renders the open tab's action buttons into the tab strip.
 *
 * Falls back to rendering in place when there is no {@link DetailTabs} above it — a panel
 * reused on a screen without tabs keeps its actions rather than silently losing them, which
 * is the failure this would otherwise hide.
 */
export function TabActions({ children }: { children: ReactNode }) {
  const slot = useContext(TabActionSlotContext);
  if (!slot) return <>{children}</>;
  return createPortal(children, slot);
}
