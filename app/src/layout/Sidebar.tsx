import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, Stack, Typography, ButtonBase, Avatar } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { NAV_GROUPS } from './nav-config';
import { AccountMenu } from './AccountMenu';
import { Logo } from 'src/components/common/Logo';
import { useAuth } from 'src/auth/AuthProvider';
import { PATHS } from 'src/routes/paths';
import { initials } from 'src/lib/format';

const NAVY = '#1E2A3A';

export const SIDEBAR_W = 250;
export const SIDEBAR_W_COLLAPSED = 74;

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { user, canSee } = useAuth();
  const { pathname } = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const isActive = (path: string) =>
    path === PATHS.dashboard ? pathname === path : pathname.startsWith(path);

  return (
    <Box
      component="aside"
      sx={{
        width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W,
        flex: `0 0 ${collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W}px`,
        bgcolor: NAVY,
        color: '#C6D0DC',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        transition: 'width .22s cubic-bezier(.4,0,.2,1), flex-basis .22s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Brand */}
      <Stack direction="row" alignItems="center" spacing={1.4} sx={{ px: 2.25, height: 62, flex: '0 0 auto' }}>
        <Logo size={34} />
        {!collapsed && (
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
              {group.heading && !collapsed && (
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
                return (
                  <ButtonBase
                    key={it.key}
                    component={NavLink}
                    to={it.path}
                    sx={{
                      width: '100%',
                      justifyContent: collapsed ? 'center' : 'flex-start',
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
                    {!collapsed && <span>{it.label}</span>}
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
          justifyContent: collapsed ? 'center' : 'flex-start',
          textAlign: 'left',
          '&:hover': { bgcolor: 'rgba(255,255,255,.06)' },
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 13, fontWeight: 800 }}>
          {initials(user?.firstName, user?.lastName)}
        </Avatar>
        {!collapsed && (
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
    </Box>
  );
}
