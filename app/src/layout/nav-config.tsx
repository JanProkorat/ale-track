import type { ReactNode } from 'react';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import AirportShuttleOutlinedIcon from '@mui/icons-material/AirportShuttleOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import { type ModuleKey } from 'src/auth/permissions';
import { PATHS } from 'src/routes/paths';

export interface NavItem {
  key: ModuleKey;
  label: string;
  path: string;
  icon: ReactNode;
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
    ],
  },
  {
    heading: 'Sklad',
    items: [
      { key: 'deliveries', label: 'Dovozy zboží', path: PATHS.deliveries, icon: icon(<MoveToInboxOutlinedIcon fontSize="small" />) },
      { key: 'inventory', label: 'Sklad', path: PATHS.inventory, icon: icon(<Inventory2OutlinedIcon fontSize="small" />) },
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
