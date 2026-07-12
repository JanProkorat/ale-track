import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import SportsBarOutlined from '@mui/icons-material/SportsBarOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import MoveToInboxOutlined from '@mui/icons-material/MoveToInboxOutlined';
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';

import { useModuleCounts } from 'src/hooks/useModuleCounts';

interface StatCardItem {
     labelKey: string;
     countKey: string;
     icon: React.ReactNode;
     path: string;
}

const STAT_ITEMS: StatCardItem[] = [
     { labelKey: 'dashboard.activeOrders', countKey: 'orders', icon: <ShoppingCartOutlined />, path: '/orders' },
     { labelKey: 'dashboard.activeShipments', countKey: 'outgoingShipments', icon: <MoveToInboxOutlined />, path: '/outgoing-shipments' },
     { labelKey: 'dashboard.activeDeliveries', countKey: 'productDeliveries', icon: <LocalShippingOutlined />, path: '/product-deliveries' },
     { labelKey: 'dashboard.totalClients', countKey: 'clients', icon: <PeopleOutlined />, path: '/clients' },
     { labelKey: 'dashboard.totalBreweries', countKey: 'breweries', icon: <SportsBarOutlined />, path: '/breweries' },
     { labelKey: 'dashboard.totalDrivers', countKey: 'drivers', icon: <BadgeOutlined />, path: '/drivers' },
     { labelKey: 'dashboard.inventoryItems', countKey: 'inventoryItems', icon: <Inventory2Outlined />, path: '/inventory' },
];

export default function StatCards() {
     const { t } = useTranslation();
     const { counts, isLoading } = useModuleCounts();
     const navigate = useNavigate();

     return (
          <Box
               sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                         xs: 'repeat(2, 1fr)',
                         sm: 'repeat(4, 1fr)',
                         md: 'repeat(7, 1fr)',
                    },
                    gap: 2,
               }}
          >
               {STAT_ITEMS.map((item) => (
                    <Card
                         key={item.countKey}
                         variant="outlined"
                         onClick={() => navigate(item.path)}
                         sx={{
                              p: 2,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 1,
                              transition: 'all 0.2s',
                              '&:hover': {
                                   borderColor: 'primary.main',
                                   bgcolor: 'action.hover',
                              },
                         }}
                    >
                         <Box sx={{ color: 'primary.main' }}>{item.icon}</Box>
                         {isLoading ? (
                              <Skeleton width={40} height={32} />
                         ) : (
                              <Typography variant="h5" fontWeight={700}>
                                   {counts[item.countKey] ?? 0}
                              </Typography>
                         )}
                         <Typography variant="caption" color="text.secondary" textAlign="center">
                              {t(item.labelKey)}
                         </Typography>
                    </Card>
               ))}
          </Box>
     );
}
