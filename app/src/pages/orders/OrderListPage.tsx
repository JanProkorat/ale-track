import type { OrderListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useOrders } from 'src/hooks/useOrders';

import { OrderState } from 'src/generated/api-client';
import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import OrderNameList from './components/OrderNameList';
import OrderInlineDetail from './components/OrderInlineDetail';
import CreateOrderDrawer from './components/CreateOrderDrawer';

// ---------------------------------------------------------------------------
// Tab filter constants
// ---------------------------------------------------------------------------

type TabKey = 'active' | 'finished' | 'cancelled';

const ACTIVE_STATES = new Set<string | OrderState>([
     OrderState.New, OrderState.Planning, OrderState.Delivering,
     'New', 'Planning', 'Delivering',
]);
const FINISHED_STATES = new Set<string | OrderState>([OrderState.Finished, 'Finished']);
const CANCELLED_STATES = new Set<string | OrderState>([OrderState.Cancelled, 'Cancelled']);

function filterByTab(orders: OrderListItemDto[], tab: TabKey): OrderListItemDto[] {
     switch (tab) {
          case 'active':
               return orders.filter((o) => o.state != null && ACTIVE_STATES.has(o.state));
          case 'finished':
               return orders.filter((o) => o.state != null && FINISHED_STATES.has(o.state));
          case 'cancelled':
               return orders.filter((o) => o.state != null && CANCELLED_STATES.has(o.state));
          default:
               return orders;
     }
}

// ---------------------------------------------------------------------------

export default function OrderListPage() {
     const { t } = useTranslation();
     const theme = useTheme();
     const isMobile = useMediaQuery(theme.breakpoints.down('md'));

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedOrderId = searchParams.get('id');

     const [tab, setTab] = useState<TabKey>('active');
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const { data: allOrders = [], isLoading } = useOrders();

     const filteredOrders = useMemo(() => filterByTab(allOrders, tab), [allOrders, tab]);

     const setSelectedOrderId = useCallback(
          (id: string | null) => {
               setSearchParams((prev) => {
                    if (id) {
                         prev.set('id', id);
                    } else {
                         prev.delete('id');
                    }
                    return prev;
               }, { replace: true });
          },
          [setSearchParams],
     );

     // Auto-select first order when data loads and nothing is selected
     useEffect(() => {
          if (!selectedOrderId && !isLoading && filteredOrders.length > 0) {
               setSelectedOrderId(filteredOrders[0].id ?? null);
          }
     }, [selectedOrderId, isLoading, filteredOrders, setSelectedOrderId]);

     const handleCloseDetail = () => setSelectedOrderId(null);

     const handleOrderCreated = (orderId: string) => {
          setDrawerOpen(false);
          setSelectedOrderId(orderId);
     };

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('orders.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('orders.addOrder')}
                    </Button>
               </Box>

               {/* State tabs */}
               <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Tabs
                         value={tab}
                         onChange={(_e, newValue: TabKey) => {
                              setTab(newValue);
                              setSelectedOrderId(null);
                         }}
                         variant="fullWidth"
                    >
                         <Tab label={t('orders.tabActive')} value="active" />
                         <Tab label={t('orders.tabFinished')} value="finished" />
                         <Tab label={t('orders.tabCancelled')} value="cancelled" />
                    </Tabs>
               </Paper>

               {/* Split view */}
               <Box
                    sx={{
                         display: 'flex',
                         flexDirection: { xs: 'column', md: 'row' },
                         alignItems: 'flex-start',
                         gap: 2,
                    }}
               >
                    {/* Left panel — order list (desktop) / dropdown (mobile) */}
                    {isMobile ? (
                         <Card sx={{ width: '100%', p: 2 }}>
                              <Autocomplete
                                   options={filteredOrders}
                                   getOptionLabel={(option) =>
                                        `${option.clientName ?? ''} — ${option.requiredDeliveryDate ? new Date(option.requiredDeliveryDate).toLocaleDateString() : ''}`
                                   }
                                   loading={isLoading}
                                   value={filteredOrders.find((o) => o.id === selectedOrderId) ?? null}
                                   onChange={(_e, newValue) =>
                                        setSelectedOrderId(newValue?.id ?? null)
                                   }
                                   isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                   renderInput={(params) => (
                                        <TextField
                                             {...params}
                                             size="small"
                                             placeholder={t('orders.selectOrder')}
                                        />
                                   )}
                              />
                         </Card>
                    ) : (
                         <Box sx={{ flexShrink: 0 }}>
                              <OrderNameList
                                   orders={filteredOrders}
                                   loading={isLoading}
                                   selectedId={selectedOrderId}
                                   onSelect={setSelectedOrderId}
                              />
                         </Box>
                    )}

                    {/* Right panel — order detail */}
                    <Card
                         sx={{
                              flex: 1,
                              minWidth: 0,
                              width: { xs: '100%', md: 'auto' },
                              minHeight: { md: 400 },
                              p: 2,
                              display: 'flex',
                              flexDirection: 'column',
                              ...(!selectedOrderId && {
                                   alignItems: 'center',
                                   justifyContent: 'center',
                              }),
                         }}
                    >
                         <OrderInlineDetail
                              orderId={selectedOrderId}
                              onDeleted={handleCloseDetail}
                              onDirtyChange={setDirty}
                         />
                    </Card>
               </Box>

               {/* Create order drawer */}
               <CreateOrderDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleOrderCreated}
               />
          </Box>
     );
}
