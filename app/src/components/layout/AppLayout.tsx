import { Outlet } from 'react-router-dom';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useModuleCounts } from 'src/hooks/useModuleCounts';

import MobileBottomNav from './MobileBottomNav';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH } from './Sidebar';

// ---------------------------------------------------------------------------
// AppLayout
// ---------------------------------------------------------------------------
// Responsive behaviour (no top bar — user section lives in sidebar):
// xs  (0-599)   — no sidebar, bottom nav with "More" drawer (includes user info)
// sm  (600-899) — mini sidebar (permanent, 72px)
// md  (900-1199)— mini sidebar (permanent, 72px)
// lg+ (1200+)   — full sidebar (permanent, 260px)
// ---------------------------------------------------------------------------

export default function AppLayout() {
     const theme = useTheme();
     const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
     const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

     const { counts: badgeCounts } = useModuleCounts();

     const showSidebar = !isMobile;
     const sidebarMini = showSidebar && !isDesktop;
     const sidebarWidth = isDesktop ? SIDEBAR_WIDTH : showSidebar ? SIDEBAR_MINI_WIDTH : 0;

     return (
          <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
               {/* Sidebar — permanent for sm+ */}
               {showSidebar && (
                    <Sidebar
                         open
                         onClose={() => {}}
                         variant="permanent"
                         mini={sidebarMini}
                         badgeCounts={badgeCounts}
                    />
               )}

               {/* Main content */}
               <Box
                    component="main"
                    sx={{
                         flexGrow: 1,
                         display: 'flex',
                         flexDirection: 'column',
                         minWidth: 0,
                         pb: { xs: '80px', sm: 0 },
                    }}
               >
                    <Box sx={{ flex: 1, p: { xs: 2, sm: 3 } }}>
                         <Outlet />
                    </Box>
               </Box>

               {/* Mobile bottom nav */}
               {isMobile && <MobileBottomNav badgeCounts={badgeCounts} />}
          </Box>
     );
}
