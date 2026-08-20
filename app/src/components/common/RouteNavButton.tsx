import { useState } from 'react';
import { Box, Menu, MenuItem, Stack, Tooltip as MuiTooltip, Typography } from '@mui/material';
import AssistantDirectionIcon from '@mui/icons-material/AssistantDirectionOutlined';
import { plural } from 'src/lib/format';
import type { LatLng } from 'src/lib/geo';
import { googleMapsRouteLink, mapyRouteLink, type NavLink } from 'src/lib/routeLinks';

/** Hands the planned route to an external navigation app. Deliberately free of
 * any Leaflet import so it renders (and tests) outside a map — `RouteMap` drops
 * it into its own control stack.
 *
 * `container` should be the element that goes native-fullscreen, so the menu
 * stays visible in fullscreen; a portal to `document.body` would not. */
export function RouteNavButton({ depot, stops, container }: {
  depot: LatLng;
  stops: LatLng[];
  container?: HTMLElement | null;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // No Apple Maps entry — its URL scheme takes a single destination, so a link
  // could only ever cover the first leg of the round (see routeLinks.ts).
  const targets: { key: string; label: string; link: NavLink | null }[] = [
    { key: 'mapy', label: 'Mapy.cz', link: mapyRouteLink(depot, stops) },
    { key: 'google', label: 'Google Maps', link: googleMapsRouteLink(depot, stops) },
  ];
  const available = targets.filter((t): t is typeof t & { link: NavLink } => t.link !== null);

  if (available.length === 0) {
    return null;
  }

  return (
    <>
      <MuiTooltip title="Otevřít v navigaci" placement="left">
        <Box component="button" type="button" aria-label="Otevřít v navigaci" onClick={(e) => setAnchor(e.currentTarget)}>
          <AssistantDirectionIcon />
        </Box>
      </MuiTooltip>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        container={container ?? undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {available.map((target) => (
          <MenuItem
            key={target.key}
            component="a"
            href={target.link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchor(null)}
          >
            <Stack>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{target.label}</Typography>
              {target.link.omitted > 0 && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {`Bez ${target.link.omitted} ${plural(target.link.omitted, 'zastávky', 'zastávek', 'zastávek')}`}
                </Typography>
              )}
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
