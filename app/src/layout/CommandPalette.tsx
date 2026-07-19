import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Box, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { NAV_GROUPS } from './nav-config';
import { useAuth } from 'src/auth/AuthProvider';

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { canSee } = useAuth();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const flat = NAV_GROUPS.flatMap((g) => g.items).filter((it) => canSee(it.key));
    const q = query.trim().toLowerCase();
    return q ? flat.filter((it) => it.label.toLowerCase().includes(q)) : flat;
  }, [query, canSee]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
    }
  }, [open]);

  useEffect(() => {
    setSel(0);
  }, [query]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: { position: 'fixed', top: '11vh', m: 0, width: 'min(640px, 94vw)', borderRadius: 3 } },
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSel((s) => Math.min(s + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSel((s) => Math.max(s - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const it = items[sel];
          if (it) go(it.path);
        }
      }}
      transitionDuration={120}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.25, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <SearchIcon color="disabled" />
        <InputBase
          inputRef={inputRef}
          autoFocus
          fullWidth
          placeholder="Hledat objednávky, klienty, produkty, pivovary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ fontSize: 16 }}
        />
      </Box>
      <List sx={{ maxHeight: 'min(60vh, 440px)', overflowY: 'auto', p: 1 }}>
        {items.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center', fontSize: 13.5 }}>
            Nic nenalezeno pro „{query}"
          </Typography>
        )}
        {items.map((it, i) => (
          <ListItemButton
            key={it.key}
            selected={i === sel}
            onMouseEnter={() => setSel(i)}
            onClick={() => go(it.path)}
            sx={{ borderRadius: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{it.icon}</ListItemIcon>
            <ListItemText primary={it.label} secondary="Přejít do modulu" slotProps={{ primary: { fontWeight: 700, fontSize: 13.5 } }} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}
