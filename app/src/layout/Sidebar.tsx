import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, Drawer, Stack, Typography, ButtonBase, Avatar } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { NAV_GROUPS } from './nav-config';
import { AccountMenu } from './AccountMenu';
import { Logo } from 'src/components/common/Logo';
import { useAuth } from 'src/auth/AuthProvider';
import { useModuleCounts } from 'src/hooks/useReports';
import { PATHS } from 'src/routes/paths';
import { initials } from 'src/lib/format';
import { type ModuleKey } from 'src/auth/permissions';

export const SIDEBAR_W = 250;
export const SIDEBAR_W_COLLAPSED = 74;

// Which module-counts field backs each nav item's badge (dashboard has none).
const COUNT_FIELD: Partial<Record<ModuleKey, string>> = {
  orders: 'ordersCount',
  shipments: 'outgoingShipmentsCount',
  deliveries: 'productDeliveriesCount',
  inventory: 'inventoryItemsCount',
  breweries: 'breweriesCount',
  clients: 'clientsCount',
  drivers: 'driversCount',
  vehicles: 'vehiclesCount',
  users: 'usersCount',
};

export function Sidebar({
  collapsed,
  mobile = false,
  open = false,
  onClose,
}: {
  collapsed: boolean;
  /** Below the `mobile` breakpoint the sidebar is a slide-in overlay, not a column. */
  mobile?: boolean;
  /** Overlay visibility. Ignored when `mobile` is false. */
  open?: boolean;
  onClose?: () => void;
}) {
  const { user, canSee } = useAuth();
  const { pathname } = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const counts = useModuleCounts().data as Record<string, number | undefined> | undefined;

  const isActive = (path: string) =>
    path === PATHS.dashboard ? pathname === path : pathname.startsWith(path);

  // The overlay always shows the full-width sidebar: the prototype resets
  // `.sidebar.collapsed` back to the full width below 860px, so the desktop
  // collapse state is deliberately ignored on mobile.
  const expanded = mobile || !collapsed;

  const content = (
    <>
      {/* Brand */}
      <Stack direction="row" alignItems="center" spacing={1.4} sx={{ px: 2.25, height: 62, flex: '0 0 auto' }}>
        <Logo size={34} />
        {expanded && (
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            Ale<Box component="span" sx={{ color: 'primary.main' }}>Track</Box>
          </Typography>
        )}
      </Stack>

      {/* Nav */}
      <Box sx={{ flex: '1 1 auto', overflowY: 'auto', px: 1.5, pb: 2.5 }}>
        {NAV_GROUPS.map((group, gi) => {
          const items = group.items.filter((it) => canSee(it.key));
          if (!items.length) return null;
          return (
            <Box key={gi}>
              {group.heading && expanded && (
                <Typography
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#69788C',
                    px: 1.5,
                    pt: 2,
                    pb: 0.75,
                  }}
                >
                  {group.heading}
                </Typography>
              )}
              {items.map((it) => {
                const active = isActive(it.path);
                const field = COUNT_FIELD[it.key];
                const count = field ? counts?.[field] ?? 0 : 0;
                // Prototype: badge shown only for non-active items with a count.
                const showBadge = count > 0 && !active;
                return (
                  <ButtonBase
                    key={it.key}
                    component={NavLink}
                    to={it.path}
                    // AppShell closes the overlay on a pathname change, which misses a
                    // tap on the route you're already on — close here too.
                    onClick={mobile ? onClose : undefined}
                    sx={{
                      width: '100%',
                      justifyContent: expanded ? 'flex-start' : 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1.1,
                      my: '1px',
                      borderRadius: 1.75,
                      fontWeight: 600,
                      fontSize: 13.5,
                      color: active ? '#fff' : '#B4C0CE',
                      position: 'relative',
                      whiteSpace: 'nowrap',
                      background: active
                        ? 'linear-gradient(90deg, rgba(240,140,0,.20), rgba(240,140,0,.04))'
                        : 'transparent',
                      '&:hover': { background: active ? undefined : 'rgba(255,255,255,.07)', color: '#fff' },
                      '&::before': active
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 6,
                            bottom: 6,
                            width: 3,
                            bgcolor: 'primary.main',
                            borderRadius: '0 3px 3px 0',
                          }
                        : undefined,
                    }}
                  >
                    <Box sx={{ display: 'grid', placeItems: 'center', flex: '0 0 20px', opacity: 0.92 }}>
                      {it.icon}
                    </Box>
                    {expanded && <span>{it.label}</span>}
                    {showBadge && (expanded ? (
                      <Box
                        component="span"
                        sx={{
                          ml: 'auto', bgcolor: 'primary.main', color: '#3a2402',
                          fontSize: 11, fontWeight: 800, lineHeight: 1.5,
                          minWidth: 20, px: 0.9, py: '1px', borderRadius: 99, textAlign: 'center',
                        }}
                      >
                        {count}
                      </Box>
                    ) : (
                      <Box
                        component="span"
                        sx={{
                          position: 'absolute', top: 3, right: 4,
                          bgcolor: 'primary.main', color: '#3a2402',
                          fontSize: 9, fontWeight: 800, lineHeight: 1.4,
                          minWidth: 14, px: 0.5, borderRadius: 99, textAlign: 'center',
                        }}
                      >
                        {count}
                      </Box>
                    ))}
                  </ButtonBase>
                );
              })}
            </Box>
          );
        })}
      </Box>

      {/* Account footer */}
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          flex: '0 0 auto',
          borderTop: '1px solid rgba(255,255,255,.08)',
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          justifyContent: expanded ? 'flex-start' : 'center',
          textAlign: 'left',
          '&:hover': { bgcolor: 'rgba(255,255,255,.06)' },
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 13, fontWeight: 800 }}>
          {initials(user?.firstName, user?.lastName)}
        </Avatar>
        {expanded && (
          <>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 13 }} noWrap>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography sx={{ color: '#7c8b9e', fontSize: 11.5 }}>
                {user?.roles.includes('Admin') ? 'Administrátor' : 'Uživatel'}
              </Typography>
            </Box>
            <KeyboardArrowDownIcon sx={{ color: '#69788c', fontSize: 18, flex: '0 0 auto' }} />
          </>
        )}
      </ButtonBase>
      <AccountMenu anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  );

  // Deviation from the prototype: it slides the panel in with only a shadow,
  // MUI's temporary Drawer adds a scrim. Keeping the scrim — it gives a
  // tap-to-close target and matches what FormDrawer already does in this app.
  if (mobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              width: SIDEBAR_W,
              bgcolor: 'brand.navy',
              color: '#C6D0DC',
              backgroundImage: 'none',
              borderRight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Box
      component="aside"
      sx={{
        width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W,
        flex: `0 0 ${collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W}px`,
        bgcolor: 'brand.navy',
        color: '#C6D0DC',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        // dvh, not vh: mobile browser chrome makes 100vh overshoot the visible area.
        height: '100dvh',
        transition: 'width .22s cubic-bezier(.4,0,.2,1), flex-basis .22s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {content}
    </Box>
  );
}
