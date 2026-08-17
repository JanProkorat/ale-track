import type { ReactNode } from 'react';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import AirportShuttleOutlinedIcon from '@mui/icons-material/AirportShuttleOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import { type ModuleKey } from 'src/auth/permissions';
import { PATHS } from 'src/routes/paths';

export interface NavItem {
  /** Unique per nav item — not a `ModuleKey`, because two items may gate on one module. */
  key: string;
  /** Module whose permission gates this item. Defaults to `key` when the two coincide. */
  permModule?: ModuleKey;
  label: string;
  path: string;
  icon: ReactNode;
}

/** The module a nav item is gated by. Every permission check goes through this, never `key`. */
export function navPermModule(item: Pick<NavItem, 'key' | 'permModule'>): ModuleKey {
  return item.permModule ?? (item.key as ModuleKey);
}

/**
 * Whether a nav item covers the current route — its own path, or anything nested under it.
 *
 * The boundary matters: a bare `startsWith` makes `/sales-reports` match `/sales`, which lit
 * up two nav items at once. Only a full path segment counts as being inside a module. The
 * dashboard matches exactly, since `/` is a prefix of every route.
 */
export function isNavPathActive(pathname: string, path: string): boolean {
  if (path === PATHS.dashboard) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export interface NavGroup {
  heading: string | null;
  items: NavItem[];
}

const icon = (node: ReactNode) => node;

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: null,
    items: [
      { key: 'dashboard', label: 'Nástěnka', path: PATHS.dashboard, icon: icon(<DashboardOutlinedIcon fontSize="small" />) },
    ],
  },
  {
    heading: 'Prodej',
    items: [
      { key: 'orders', label: 'Objednávky', path: PATHS.orders, icon: icon(<ReceiptLongOutlinedIcon fontSize="small" />) },
      { key: 'shipments', label: 'Vývozy', path: PATHS.shipments, icon: icon(<LocalShippingOutlinedIcon fontSize="small" />) },
      { key: 'reports', label: 'Reporty', path: PATHS.reports, icon: icon(<InsightsOutlinedIcon fontSize="small" />) },
    ],
  },
  {
    heading: 'Garážový prodej',
    items: [
      { key: 'deliveries', label: 'Dovozy zboží', path: PATHS.deliveries, icon: icon(<MoveToInboxOutlinedIcon fontSize="small" />) },
      { key: 'inventory', label: 'Sklad', path: PATHS.inventory, icon: icon(<Inventory2OutlinedIcon fontSize="small" />) },
      { key: 'sales', label: 'Prodeje', path: PATHS.sales, icon: icon(<ShoppingCartOutlinedIcon fontSize="small" />) },
      {
        key: 'salesReports',
        // Whoever runs the counter sees its numbers — no separate analytics permission.
        permModule: 'sales',
        label: 'Reporty',
        path: PATHS.salesReports,
        icon: icon(<QueryStatsOutlinedIcon fontSize="small" />),
      },
    ],
  },
  {
    heading: 'Evidence',
    items: [
      { key: 'breweries', label: 'Pivovary', path: PATHS.breweries, icon: icon(<SportsBarOutlinedIcon fontSize="small" />) },
      { key: 'clients', label: 'Klienti', path: PATHS.clients, icon: icon(<StorefrontOutlinedIcon fontSize="small" />) },
      { key: 'drivers', label: 'Řidiči', path: PATHS.drivers, icon: icon(<BadgeOutlinedIcon fontSize="small" />) },
      { key: 'vehicles', label: 'Vozy', path: PATHS.vehicles, icon: icon(<AirportShuttleOutlinedIcon fontSize="small" />) },
    ],
  },
  {
    heading: 'Správa',
    items: [
      { key: 'users', label: 'Uživatelé', path: PATHS.users, icon: icon(<GroupOutlinedIcon fontSize="small" />) },
    ],
  },
];
