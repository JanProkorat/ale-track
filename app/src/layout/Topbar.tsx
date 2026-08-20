import { useState } from 'react';
import { Box, IconButton, Tooltip, Badge, ButtonBase, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useThemeMode } from 'src/theme/ThemeProvider';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { RemindersDrawer } from 'src/features/reminders/RemindersDrawer';

export const TOPBAR_H = 62;

// Show the platform-correct search shortcut hint (⌘K on Apple, Ctrl+K elsewhere).
// The handler itself accepts both metaKey and ctrlKey regardless.
const IS_MAC = typeof navigator !== 'undefined'
  && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
const SEARCH_SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl+K';

export function Topbar({
  onToggleSidebar,
  onOpenPalette,
  onOpenCurrency,
}: {
  onToggleSidebar: () => void;
  onOpenPalette: () => void;
  onOpenCurrency: (el: HTMLElement) => void;
}) {
  const { resolved, toggle } = useThemeMode();
  const { currency } = useCurrency();
  const [remindersOpen, setRemindersOpen] = useState(false);

  return (
    <Box
      component="header"
      sx={{
        height: TOPBAR_H,
        flex: '0 0 auto',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.75, compact: 1.5 },
        px: { xs: 1.5, mobile: 2.5 },
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Opens the nav overlay below the mobile breakpoint, collapses the desktop
          column above it — hence the neutral label. */}
      <IconButton onClick={onToggleSidebar} size="small" aria-label="Menu">
        <MenuIcon />
      </IconButton>

      {/* Prototype line 334: below 720px the pill becomes a 40px icon-only circle.
          Dropping its minWidth:190 is what stops the topbar row overflowing on a
          phone, and the ⌘K hint is meaningless on touch anyway. */}
      <ButtonBase
        onClick={onOpenPalette}
        aria-label="Hledat"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 40,
          flex: { xs: '0 0 auto', compact: '0 1 340px' },
          width: { xs: 40, compact: 'auto' },
          minWidth: { xs: 0, compact: 190 },
          maxWidth: { xs: 40, compact: 360 },
          px: { xs: 0, compact: 1.75 },
          justifyContent: { xs: 'center', compact: 'flex-start' },
          borderRadius: 999,
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          color: 'text.secondary',
        }}
      >
        <SearchIcon fontSize="small" />
        <Typography
          sx={{ flex: 1, textAlign: 'left', fontSize: 13.5, display: { xs: 'none', compact: 'block' } }}
        >
          Hledat…
        </Typography>
        <Box
          component="kbd"
          sx={{
            display: { xs: 'none', compact: 'block' },
            fontSize: 11,
            fontWeight: 700,
            px: 0.75,
            py: '1px',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {SEARCH_SHORTCUT}
        </Box>
      </ButtonBase>

      <Box sx={{ flex: 1 }} />

      <ButtonBase
        onClick={(e) => onOpenCurrency(e.currentTarget)}
        title="Měna a kurz"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          height: 38,
          px: 1.4,
          borderRadius: 1.25,
          border: 1,
          borderColor: 'divider',
          fontWeight: 800,
          fontSize: 13.5,
          color: 'text.secondary',
        }}
      >
        {currency === 'EUR' ? '€' : 'Kč'}
        <KeyboardArrowDownIcon fontSize="small" />
      </ButtonBase>

      <Tooltip title="Připomínky">
        <IconButton size="small" onClick={() => setRemindersOpen(true)} aria-label="Připomínky">
          <Badge color="error" variant="dot">
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title="Přepnout motiv">
        <IconButton size="small" onClick={toggle}>
          {resolved === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>
      </Tooltip>

      <RemindersDrawer open={remindersOpen} onClose={() => setRemindersOpen(false)} />
    </Box>
  );
}
