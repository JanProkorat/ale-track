import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog, Box, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { NAV_GROUPS, navPermModule } from './nav-config';
import { useAuth } from 'src/auth/AuthProvider';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { PATHS } from 'src/routes/paths';
import { orderNumber } from 'src/lib/format';

// Max record hits shown per entity type, so a broad query can't flood the list.
const PER_TYPE = 8;

interface Result {
  key: string;
  icon: ReactNode;
  primary: string;
  secondary: string;
  path: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { canSee } = useAuth();
  const ds = useDataSource();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Record sources — fetched only while the palette is open (and the user may
  // see that module). Same query keys as the module hooks, so the cache is shared.
  const breweriesQ = useQuery({
    queryKey: qk.breweries.list({}),
    queryFn: ({ signal }) => ds.getBreweriesListEndpoint({}, signal),
    enabled: open && canSee('breweries'),
  });
  const clientsQ = useQuery({
    queryKey: qk.clients.list({}),
    queryFn: ({ signal }) => ds.getClientListEndpoint({}, signal),
    enabled: open && canSee('clients'),
  });
  const ordersQ = useQuery({
    queryKey: qk.orders.list({}),
    queryFn: ({ signal }) => ds.getOrdersListEndpoint({}, signal),
    enabled: open && canSee('orders'),
  });

  const items = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const modules: Result[] = NAV_GROUPS.flatMap((g) => g.items)
      .filter((it) => canSee(navPermModule(it)) && (!q || it.label.toLowerCase().includes(q)))
      .map((it) => ({ key: `m-${it.key}`, icon: it.icon, primary: it.label, secondary: 'Modul', path: it.path }));

    // Records only surface once there's a query — otherwise show just the modules.
    if (!q) return modules;

    const breweries: Result[] = (breweriesQ.data ?? [])
      .filter((b) => (b.name ?? '').toLowerCase().includes(q))
      .slice(0, PER_TYPE)
      .map((b) => ({ key: `b-${b.id}`, icon: <SportsBarOutlinedIcon />, primary: b.name ?? '—', secondary: 'Pivovar', path: `${PATHS.breweries}/${b.id}` }));

    const clients: Result[] = (clientsQ.data ?? [])
      .filter((c) => (c.name ?? '').toLowerCase().includes(q))
      .slice(0, PER_TYPE)
      .map((c) => ({ key: `c-${c.id}`, icon: <PersonOutlineOutlinedIcon />, primary: c.name ?? '—', secondary: 'Klient', path: `${PATHS.clients}/${c.id}` }));

    const orders: Result[] = (ordersQ.data ?? [])
      .filter((o) => (o.clientName ?? '').toLowerCase().includes(q) || orderNumber(o.id).toLowerCase().includes(q))
      .slice(0, PER_TYPE)
      .map((o) => ({ key: `o-${o.id}`, icon: <ReceiptLongOutlinedIcon />, primary: `${o.clientName ?? 'Objednávka'} · ${orderNumber(o.id)}`, secondary: 'Objednávka', path: `${PATHS.orders}/${o.id}` }));

    return [...modules, ...breweries, ...clients, ...orders];
  }, [query, canSee, breweriesQ.data, clientsQ.data, ordersQ.data]);

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
          placeholder="Hledat objednávky, klienty, pivovary, moduly…"
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
            <ListItemText primary={it.primary} secondary={it.secondary} slotProps={{ primary: { fontWeight: 700, fontSize: 13.5 } }} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}
