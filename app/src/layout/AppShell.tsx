import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { CurrencyMenu } from './CurrencyMenu';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [currencyAnchor, setCurrencyAnchor] = useState<HTMLElement | null>(null);

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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar collapsed={collapsed} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar
          onToggleSidebar={() => setCollapsed((v) => !v)}
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
