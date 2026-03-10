import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Badge from '@mui/material/Badge';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import BottomNavigation from '@mui/material/BottomNavigation';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import useAuth from 'src/hooks/useAuth';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import ThemeModeSwitcher from './ThemeModeSwitcher';
import { navItems, mobileNavItems } from './navConfig';
import InlineLanguageSwitcher from './InlineLanguageSwitcher';
import InlineCurrencySwitcher from './InlineCurrencySwitcher';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MobileBottomNavProps {
     badgeCounts?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MobileBottomNav({ badgeCounts = {} }: MobileBottomNavProps) {
     const { t } = useTranslation();
     const { pathname } = useLocation();
     const navigate = useNavigate();
     const { user, isAdmin, logout } = useAuth();
     const unsaved = useUnsavedChanges();
     const [moreOpen, setMoreOpen] = useState(false);

     const initials = user
          ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
          : '?';

     // Items not shown in bottom bar go into the "More" drawer
     const overflowItems = navItems.slice(4).filter((item) => !item.adminOnly || isAdmin);

     // Determine which bottom tab is active
     const activeIndex = mobileNavItems.findIndex((item) =>
          item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
     );
     const isOverflowActive = activeIndex === -1 && pathname !== '/login';

     return (
          <>
               <Paper
                    elevation={8}
                    sx={{
                         position: 'fixed',
                         bottom: 0,
                         left: 0,
                         right: 0,
                         zIndex: (theme) => theme.zIndex.appBar,
                         display: { xs: 'block', sm: 'none' },
                         borderTop: '1px solid',
                         borderColor: 'divider',
                    }}
               >
                    <BottomNavigation
                         value={isOverflowActive ? 4 : activeIndex}
                         onChange={(_, newValue) => {
                              if (newValue === 4) {
                                   setMoreOpen(true);
                              } else {
                                   unsaved.navigate(() => navigate(mobileNavItems[newValue].path));
                              }
                         }}
                         showLabels
                         sx={{ height: 64, bgcolor: 'background.paper' }}
                    >
                         {mobileNavItems.map((item) => {
                              const Icon = item.icon;
                              const badge = item.badgeKey ? (badgeCounts[item.badgeKey] ?? 0) : 0;
                              return (
                                   <BottomNavigationAction
                                        key={item.path}
                                        label={t(item.labelKey)}
                                        icon={
                                             <Badge badgeContent={badge} sx={{ '& .MuiBadge-badge': { bgcolor: '#FF6C40', color: '#fff' } }} invisible={badge === 0} max={99}>
                                                  <Icon />
                                             </Badge>
                                        }
                                        sx={{
                                             minWidth: 0,
                                             '&.Mui-selected': { color: 'primary.main' },
                                        }}
                                   />
                              );
                         })}
                         <BottomNavigationAction
                              label={t('nav.more')}
                              icon={<MoreHorizOutlined />}
                              sx={{
                                   minWidth: 0,
                                   '&.Mui-selected': { color: 'primary.main' },
                              }}
                         />
                    </BottomNavigation>
               </Paper>

               {/* "More" drawer */}
               <Drawer
                    anchor="bottom"
                    open={moreOpen}
                    onClose={() => setMoreOpen(false)}
                    sx={{
                         '& .MuiDrawer-paper': {
                              borderTopLeftRadius: 16,
                              borderTopRightRadius: 16,
                              maxHeight: '70vh',
                         },
                    }}
               >
                    <Box sx={{ py: 1, px: 0.5 }}>
                         {/* Drag indicator */}
                         <Box
                              sx={{
                                   width: 40,
                                   height: 4,
                                   borderRadius: 2,
                                   bgcolor: 'grey.300',
                                   mx: 'auto',
                                   mb: 1,
                              }}
                         />

                         {/* User section */}
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                              <Avatar
                                   sx={{
                                        width: 36,
                                        height: 36,
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                   }}
                              >
                                   {initials}
                              </Avatar>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                   <Typography variant="subtitle2" noWrap sx={{ lineHeight: 1.3 }}>
                                        {user?.firstName} {user?.lastName}
                                   </Typography>
                                   <Typography variant="caption" color="text.secondary" noWrap>
                                        {user?.userName}
                                   </Typography>
                              </Box>
                         </Box>

                         <Divider sx={{ mx: 1, my: 0.5 }} />

                         {/* Nav overflow items */}
                         <List>
                              {overflowItems.map((item) => {
                                   const Icon = item.icon;
                                   const isActive = pathname.startsWith(item.path);
                                   const badge = item.badgeKey ? (badgeCounts[item.badgeKey] ?? 0) : 0;

                                   return (
                                        <ListItemButton
                                             key={item.path}
                                             selected={isActive}
                                             onClick={() => {
                                                  unsaved.navigate(() => {
                                                       navigate(item.path);
                                                       setMoreOpen(false);
                                                  });
                                             }}
                                             sx={{
                                                  borderRadius: 1.5,
                                                  mx: 1,
                                                  mb: 0.5,
                                                  color: isActive ? 'primary.main' : 'text.secondary',
                                             }}
                                        >
                                             <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                                                  <Badge badgeContent={badge} sx={{ '& .MuiBadge-badge': { bgcolor: '#FF6C40', color: '#fff' } }} invisible={badge === 0}>
                                                       <Icon fontSize="small" />
                                                  </Badge>
                                             </ListItemIcon>
                                             <ListItemText
                                                  primary={t(item.labelKey)}
                                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                             />
                                        </ListItemButton>
                                   );
                              })}
                         </List>

                         <Divider sx={{ mx: 1, my: 0.5 }} />

                         {/* Language + theme + currency */}
                         <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
                              <InlineLanguageSwitcher />
                              <ThemeModeSwitcher />
                              <InlineCurrencySwitcher />
                         </Box>

                         <Divider sx={{ mx: 1, my: 0.5 }} />

                         {/* Logout */}
                         <Box sx={{ px: 2, py: 1 }}>
                              <Button
                                   fullWidth
                                   size="small"
                                   onClick={() => {
                                        setMoreOpen(false);
                                        logout();
                                   }}
                                   startIcon={<LogoutOutlined />}
                                   sx={{
                                        justifyContent: 'flex-start',
                                        color: 'error.main',
                                        fontWeight: 500,
                                   }}
                              >
                                   {t('auth.logout')}
                              </Button>
                         </Box>
                    </Box>
               </Drawer>
          </>
     );
}
