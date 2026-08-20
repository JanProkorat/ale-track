import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { CurrencyMenu } from './CurrencyMenu';
import { NAV_GROUPS, isNavPathActive, navPermModule } from './nav-config';
import { useAuth } from 'src/auth/AuthProvider';
import { PATHS } from 'src/routes/paths';
import { type ModuleKey } from 'src/auth/permissions';

/** The module a path belongs to (longest matching nav prefix), or null for the
 * dashboard / unknown paths. Used to gate direct-URL access. */
function moduleForPath(pathname: string): ModuleKey | null {
  const match = NAV_GROUPS
    .flatMap((g) => g.items)
    .filter((it) => it.path !== PATHS.dashboard && isNavPathActive(pathname, it.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? navPermModule(match) : null;
}

export function AppShell() {
  const { canSee } = useAuth();
  const { pathname } = useLocation();
  const theme = useTheme();
  // 860px — the prototype's sidebar breakpoint.
  const isMobile = useMediaQuery(theme.breakpoints.down('mobile'));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [currencyAnchor, setCurrencyAnchor] = useState<HTMLElement | null>(null);

  // Navigating dismisses the overlay, as in the prototype. Covers the command
  // palette and programmatic navigation; Sidebar handles a tap on the active route.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Guard direct-URL access: if this path belongs to a module the user can't
  // see, send them to the dashboard instead of rendering a page that only 403s.
  const moduleKey = moduleForPath(pathname);
  if (moduleKey && !canSee(moduleKey)) {
    return <Navigate to={PATHS.dashboard} replace />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Sidebar
        collapsed={collapsed}
        mobile={isMobile}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar
          // One hamburger, two jobs: it opens the overlay on mobile and toggles
          // the desktop column's collapsed width above the breakpoint.
          onToggleSidebar={() => (isMobile ? setMobileNavOpen((v) => !v) : setCollapsed((v) => !v))}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenCurrency={(el) => setCurrencyAnchor(el)}
        />
        {/* flex '1 0 auto' (basis auto, no shrink) so main sizes to its content
            and grows the document — otherwise flex-basis:0 + the 100vh sidebar
            cap the page at one viewport and tall content can't be scrolled to. */}
        <Box component="main" sx={{ flex: '1 0 auto', minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CurrencyMenu anchorEl={currencyAnchor} onClose={() => setCurrencyAnchor(null)} />
    </Box>
  );
}
