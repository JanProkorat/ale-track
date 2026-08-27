// The numbered circle that stands for one stop on a route.
//
// Shared by "Přehled zastávek" and the vykládka list: both number the same stops, so the colour
// a client's circle gets and the badge a warehouse or supplier stop gets have to be the same in
// both — two copies of this would drift the moment one of them gained a kind.

import type { ReactNode } from 'react';
import { Box, ButtonBase } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PropaneOutlinedIcon from '@mui/icons-material/PropaneOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { colorForClient } from './clientColor';

export type StopAvatarKind = 'order' | 'supplier' | 'company' | 'custom';

/** A non-delivery stop is one of ours rather than a client's, so it takes the navy the map
 *  already gives those pins instead of a per-client colour. */
const ROUTE_STOP_COLOR = '#1A2B4C';

function iconFor(kind: StopAvatarKind): ReactNode {
  if (kind === 'supplier') return <PropaneOutlinedIcon sx={{ fontSize: 15 }} />;
  if (kind === 'company') return <WarehouseOutlinedIcon sx={{ fontSize: 15 }} />;
  return <PlaceOutlinedIcon sx={{ fontSize: 15 }} />;
}

/**
 * The stop's route position in a circle: the client's own colour for a delivery, navy with a
 * kind badge for one of ours.
 *
 * `clientId` keys the colour rather than the client's name, so the same client keeps its colour
 * across screens even where only one of the two is loaded.
 */
export function StopAvatar({ kind, seq, clientId, done = false, onToggleDone, label, testId }: {
  kind: StopAvatarKind;
  seq: number;
  clientId?: string;
  /** Whether the run has finished with this stop: the circle then reads as a check, not a number. */
  done?: boolean;
  /**
   * Makes the circle itself the control that marks the stop off. Withheld wherever there is
   * nothing to mark — Přehled zastávek passes neither this nor `done`, so the route list keeps
   * the plain numbered circle it has always had.
   */
  onToggleDone?: () => void;
  /** Accessible name for the clickable circle; required with `onToggleDone`. */
  label?: string;
  testId?: string;
}) {
  const isOrder = kind === 'order';
  const clickable = Boolean(onToggleDone);

  return (
    <Box
      component={clickable ? ButtonBase : 'div'}
      data-testid={testId}
      {...(clickable
        ? { onClick: onToggleDone, 'aria-label': label, 'aria-pressed': done, type: 'button' as const }
        : {})}
      sx={{
        width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
        fontSize: isOrder ? 12 : 11, fontWeight: 800, color: '#fff', flexShrink: 0,
        // Green once the run has finished with the stop, so a glance down the list reads what is
        // behind it. The client's own colour comes back if the mark is taken back.
        bgcolor: done
          ? 'success.main'
          : (isOrder ? colorForClient(clientId ?? '') : ROUTE_STOP_COLOR),
        position: 'relative',
        ...(clickable && {
          cursor: 'pointer',
          // A circle that can be pressed has to say so without hover: this list is read on a
          // phone in a van. An unfinished stop wears a dashed ring — an empty slot asking to be
          // filled — which the check fills in and replaces once the stop is done.
          ...(done ? null : { outline: '2px dashed', outlineOffset: 2, outlineColor: 'text.disabled' }),
          transition: 'transform .12s, filter .12s',
          '&:hover': { filter: 'brightness(1.15)', transform: 'scale(1.06)' },
          '&:focus-visible': { outline: '2px solid', outlineOffset: 2, outlineColor: 'primary.main' },
        }),
      }}
    >
      {done
        ? <CheckIcon data-testid="stop-done-check" sx={{ fontSize: 16 }} />
        : seq}
      {!isOrder && (
        <Box sx={{
          position: 'absolute', right: -4, bottom: -4, width: 15, height: 15, borderRadius: '50%',
          display: 'grid', placeItems: 'center', bgcolor: 'background.paper', color: 'text.secondary',
          border: 1, borderColor: 'divider',
        }}
        >
          {iconFor(kind)}
        </Box>
      )}
    </Box>
  );
}
