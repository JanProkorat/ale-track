// The numbered circle that stands for one stop on a route.
//
// Shared by "Přehled zastávek" and the vykládka list: both number the same stops, so the colour
// a client's circle gets and the badge a warehouse or supplier stop gets have to be the same in
// both — two copies of this would drift the moment one of them gained a kind.

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
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
export function StopAvatar({ kind, seq, clientId, testId }: {
  kind: StopAvatarKind;
  seq: number;
  clientId?: string;
  testId?: string;
}) {
  const isOrder = kind === 'order';
  return (
    <Box
      data-testid={testId}
      sx={{
        width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
        fontSize: isOrder ? 12 : 11, fontWeight: 800, color: '#fff', flexShrink: 0,
        bgcolor: isOrder ? colorForClient(clientId ?? '') : ROUTE_STOP_COLOR,
        position: 'relative',
      }}
    >
      {seq}
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
