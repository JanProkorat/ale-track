import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Avatar from '@mui/material/Avatar';
import AppBar from '@mui/material/AppBar';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import MenuItem from '@mui/material/MenuItem';
import MenuIcon from '@mui/icons-material/Menu';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import useAuth from 'src/hooks/useAuth';

import LanguageSwitcher from './LanguageSwitcher';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopBarProps {
     onMenuToggle: () => void;
     sidebarWidth: number;
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

export default function TopBar({ onMenuToggle, sidebarWidth }: TopBarProps) {
     const { t } = useTranslation();
     const { user, logout } = useAuth();
     const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

     const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : '?';

     return (
          <AppBar
               position="fixed"
               elevation={0}
               sx={{
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    width: { md: `calc(100% - ${sidebarWidth}px)` },
                    ml: { md: `${sidebarWidth}px` },
                    transition: 'width 200ms ease-in-out, margin 200ms ease-in-out',
               }}
          >
               <Toolbar sx={{ gap: 1 }}>
                    {/* Hamburger — visible below md */}
                    <IconButton
                         edge="start"
                         onClick={onMenuToggle}
                         sx={{ display: { md: 'none' } }}
                    >
                         <MenuIcon />
                    </IconButton>

                    <Box sx={{ flex: 1 }} />

                    {/* Language switcher */}
                    <LanguageSwitcher />

                    {/* User avatar + menu */}
                    <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 0.5 }}>
                         <Avatar
                              sx={{
                                   width: 36,
                                   height: 36,
                                   fontSize: '0.875rem',
                                   fontWeight: 600,
                                   bgcolor: 'primary.main',
                                   color: 'primary.contrastText',
                              }}
                         >
                              {initials}
                         </Avatar>
                    </IconButton>

                    <Menu
                         anchorEl={anchorEl}
                         open={Boolean(anchorEl)}
                         onClose={() => setAnchorEl(null)}
                         anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                         transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                         slotProps={{ paper: { sx: { minWidth: 180, mt: 1 } } }}
                    >
                         <Box sx={{ px: 2, py: 1.5 }}>
                              <Typography variant="subtitle2" noWrap>
                                   {user?.firstName} {user?.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                   {user?.userName}
                              </Typography>
                         </Box>
                         <Divider sx={{ my: 0.5 }} />
                         <MenuItem
                              onClick={() => {
                                   setAnchorEl(null);
                                   logout();
                              }}
                              sx={{ color: 'error.main' }}
                         >
                              {t('auth.logout')}
                         </MenuItem>
                    </Menu>
               </Toolbar>
          </AppBar>
     );
}
