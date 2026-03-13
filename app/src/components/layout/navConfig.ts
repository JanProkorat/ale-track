import type { SvgIconComponent } from '@mui/icons-material';

import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import SportsBarOutlined from '@mui/icons-material/SportsBarOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import InventoryOutlined from '@mui/icons-material/Inventory2Outlined';
import MoveToInboxOutlined from '@mui/icons-material/MoveToInboxOutlined';
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavItem {
     labelKey: string; // i18n key, e.g. "nav.dashboard"
     path: string;
     icon: SvgIconComponent;
     adminOnly?: boolean;
     /** Show a badge count (fed externally) */
     badgeKey?: string;
}

// ---------------------------------------------------------------------------
// Navigation items — order matches scene2.png sidebar design
// ---------------------------------------------------------------------------

export const navItems: NavItem[] = [
     { labelKey: 'nav.dashboard', path: '/', icon: DashboardOutlined },
     { labelKey: 'nav.clients', path: '/clients', icon: PeopleOutlined, badgeKey: 'clients' },
     { labelKey: 'nav.orders', path: '/orders', icon: ShoppingCartOutlined, badgeKey: 'orders' },
     { labelKey: 'nav.breweries', path: '/breweries', icon: SportsBarOutlined, badgeKey: 'breweries' },
     { labelKey: 'nav.drivers', path: '/drivers', icon: BadgeOutlined, badgeKey: 'drivers' },
     { labelKey: 'nav.vehicles', path: '/vehicles', icon: DirectionsCarOutlined, badgeKey: 'vehicles' },
     { labelKey: 'nav.outgoingShipments', path: '/outgoing-shipments', icon: MoveToInboxOutlined, badgeKey: 'outgoingShipments' },
     { labelKey: 'nav.productDeliveries', path: '/product-deliveries', icon: LocalShippingOutlined, badgeKey: 'productDeliveries' },
     { labelKey: 'nav.inventory', path: '/inventory', icon: InventoryOutlined, badgeKey: 'inventoryItems' },
     { labelKey: 'nav.users', path: '/users', icon: ManageAccountsOutlined, adminOnly: true, badgeKey: 'users' },
];

// Bottom-nav items for mobile (first 3 + outgoing shipments + "More")
export const mobileNavItems: NavItem[] = [
     ...navItems.slice(0, 3),
     navItems.find((item) => item.path === '/outgoing-shipments')!,
];
