import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';

import useAuth from 'src/hooks/useAuth';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import { navItems } from './navConfig';
import ThemeModeSwitcher from './ThemeModeSwitcher';
import InlineLanguageSwitcher from './InlineLanguageSwitcher';
import InlineCurrencySwitcher from './InlineCurrencySwitcher';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_MINI_WIDTH = 72;

// ---------------------------------------------------------------------------
// Badge chip — coral circle matching scene2.png
// ---------------------------------------------------------------------------

function NavBadgeChip({ count }: { count: number }) {
     if (!count) return null;
     return (
          <Box
               component="span"
               sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 22,
                    height: 22,
                    px: 0.5,
                    borderRadius: '11px',
                    bgcolor: '#FF6C40',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    lineHeight: 1,
               }}
          >
               {count > 99 ? '99+' : count}
          </Box>
     );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarProps {
     open: boolean;
     onClose?: () => void;
     variant: 'permanent' | 'temporary';
     mini?: boolean;
     badgeCounts?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({ open, onClose, variant, mini = false, badgeCounts = {} }: SidebarProps) {
     const { t } = useTranslation();
     const { pathname } = useLocation();
     const navigate = useNavigate();
     const { user, isAdmin, logout } = useAuth();
     const unsaved = useUnsavedChanges();

     const [popoverAnchor, setPopoverAnchor] = useState<null | HTMLElement>(null);

     const width = mini ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;

     const initials = user
          ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
          : '?';

     const drawerContent = (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
               {/* Logo area */}
               <Box
                    sx={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: 1.5,
                         px: mini ? 1 : 2.5,
                         py: 2.5,
                         justifyContent: mini ? 'center' : 'flex-start',
                    }}
               >
                    <Box
                         component="img"
                         src="/assets/images/logo/logo-small.png"
                         alt="AleTrack"
                         sx={{ height: 32 }}
                    />
                    {!mini && (
                         <Box
                              component="span"
                              sx={{
                                   fontWeight: 700,
                                   fontSize: '1.15rem',
                                   color: 'text.primary',
                                   letterSpacing: '-0.02em',
                              }}
                         >
                              AleTrack
                         </Box>
                    )}
               </Box>

               {/* Nav items */}
               <List sx={{ flex: 1, px: mini ? 0.5 : 1, pt: 0.5 }} disablePadding>
                    {navItems
                         .filter((item) => !item.adminOnly || isAdmin)
                         .map((item) => {
                              const isActive =
                                   item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
                              const Icon = item.icon;
                              const badgeCount = item.badgeKey ? (badgeCounts[item.badgeKey] ?? 0) : 0;

                              return (
                                   <ListItemButton
                                        key={item.path}
                                        selected={isActive}
                                        onClick={() => {
                                             unsaved.navigate(() => {
                                                  navigate(item.path);
                                                  if (variant === 'temporary') onClose?.();
                                             });
                                        }}
                                        sx={{
                                             minHeight: 44,
                                             borderRadius: 2,
                                             mx: mini ? 0.5 : 1,
                                             mb: 0.25,
                                             px: mini ? 1.5 : 2,
                                             justifyContent: mini ? 'center' : 'flex-start',
                                             color: isActive ? 'primary.main' : 'text.secondary',
                                             bgcolor: isActive ? 'action.selected' : 'transparent',
                                             '&.Mui-selected': {
                                                  bgcolor: 'action.selected',
                                                  '&:hover': { bgcolor: 'action.selected' },
                                             },
                                             '&:hover': {
                                                  bgcolor: isActive ? 'action.selected' : 'action.hover',
                                             },
                                        }}
                                   >
                                        <ListItemIcon
                                             sx={{
                                                  minWidth: mini ? 0 : 36,
                                                  color: 'inherit',
                                                  justifyContent: 'center',
                                             }}
                                        >
                                             {mini ? (
                                                  <Badge
                                                       badgeContent={badgeCount}
                                                       max={99}
                                                       invisible={badgeCount === 0}
                                                       sx={{
                                                            '& .MuiBadge-badge': {
                                                                 bgcolor: '#FF6C40',
                                                                 color: '#fff',
                                                                 fontSize: '0.6rem',
                                                                 minWidth: 16,
                                                                 height: 16,
                                                                 padding: '0 3px',
                                                            },
                                                       }}
                                                  >
                                                       <Icon fontSize="small" />
                                                  </Badge>
                                             ) : (
                                                  <Icon fontSize="small" />
                                             )}
                                        </ListItemIcon>
                                        {!mini && (
                                             <>
                                                  <ListItemText
                                                       primary={t(item.labelKey)}
                                                       primaryTypographyProps={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: isActive ? 600 : 400,
                                                       }}
                                                  />
                                                  <NavBadgeChip count={badgeCount} />
                                             </>
                                        )}
                                   </ListItemButton>
                              );
                         })}
               </List>

               {/* User section — bottom */}
               <Divider sx={{ mx: mini ? 1 : 2 }} />

               {mini ? (
                    /* Mini mode — avatar button with popover */
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 2 }}>
                         <IconButton onClick={(e) => setPopoverAnchor(e.currentTarget)} size="small">
                              <Avatar
                                   sx={{
                                        width: 34,
                                        height: 34,
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                   }}
                              >
                                   {initials}
                              </Avatar>
                         </IconButton>

                         <Popover
                              open={Boolean(popoverAnchor)}
                              anchorEl={popoverAnchor}
                              onClose={() => setPopoverAnchor(null)}
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                              slotProps={{ paper: { sx: { mt: 1, minWidth: 180, borderRadius: 2 } } }}
                         >
                              <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                                   <Typography variant="subtitle2" noWrap>
                                        {user?.firstName} {user?.lastName}
                                   </Typography>
                                   <Typography variant="caption" color="text.secondary" noWrap>
                                        {user?.userName}
                                   </Typography>
                              </Box>
                              <Divider sx={{ my: 0.5 }} />
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, px: 2, py: 1 }}>
                                   <InlineLanguageSwitcher />
                                   <InlineCurrencySwitcher />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
                                   <ThemeModeSwitcher />
                              </Box>
                              <Divider sx={{ my: 0.5 }} />
                              <Box sx={{ px: 1, pb: 1 }}>
                                   <Button
                                        fullWidth
                                        size="small"
                                        onClick={() => {
                                             setPopoverAnchor(null);
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
                         </Popover>
                    </Box>
               ) : (
                    /* Full mode — user section */
                    <Box sx={{ px: 2, py: 2 }}>
                         {/* Avatar + name */}
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
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

                         <Divider sx={{ my: 1 }} />

                         {/* Language + currency */}
                         <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <InlineLanguageSwitcher />
                              <InlineCurrencySwitcher />
                         </Box>

                         {/* Theme mode switch */}
                         <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                              <ThemeModeSwitcher />
                         </Box>

                         <Divider sx={{ my: 1 }} />

                         {/* Logout */}
                         <Button
                              fullWidth
                              size="small"
                              onClick={logout}
                              startIcon={<LogoutOutlined />}
                              sx={{
                                   color: 'error.main',
                                   fontWeight: 500,
                                   fontSize: '0.8rem',
                              }}
                         >
                              {t('auth.logout')}
                         </Button>
                    </Box>
               )}
          </Box>
     );

     return (
          <Drawer
               variant={variant}
               open={open}
               onClose={onClose}
               sx={{
                    width,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                         width,
                         boxSizing: 'border-box',
                         borderRight: '1px solid',
                         borderColor: 'divider',
                         bgcolor: 'background.paper',
                         transition: 'width 200ms ease-in-out',
                    },
               }}
          >
               {drawerContent}
          </Drawer>
     );
}
