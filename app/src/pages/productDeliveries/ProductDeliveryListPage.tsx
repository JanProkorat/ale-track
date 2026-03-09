import type { ProductDeliveryListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMemo, useState, useCallback } from 'react';

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

import { ProductDeliveryState } from 'src/generated/api-client';

import { useProductDeliveries } from 'src/hooks/useProductDeliveries';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import DeliveryNameList from './components/DeliveryNameList';
import DeliveryInlineDetail from './components/DeliveryInlineDetail';
import CreateDeliveryDrawer from './components/CreateDeliveryDrawer';

// ---------------------------------------------------------------------------
// Tab filter constants
// ---------------------------------------------------------------------------

type TabKey = 'active' | 'finished' | 'cancelled';

const ACTIVE_STATES = new Set<string | ProductDeliveryState>([
     ProductDeliveryState.InPlanning, ProductDeliveryState.OnTheWay,
     'InPlanning', 'OnTheWay',
]);
const FINISHED_STATES = new Set<string | ProductDeliveryState>([ProductDeliveryState.Finished, 'Finished']);
const CANCELLED_STATES = new Set<string | ProductDeliveryState>([ProductDeliveryState.Cancelled, 'Cancelled']);

function filterByTab(deliveries: ProductDeliveryListItemDto[], tab: TabKey): ProductDeliveryListItemDto[] {
     switch (tab) {
          case 'active':
               return deliveries.filter((d) => d.state != null && ACTIVE_STATES.has(d.state));
          case 'finished':
               return deliveries.filter((d) => d.state != null && FINISHED_STATES.has(d.state));
          case 'cancelled':
               return deliveries.filter((d) => d.state != null && CANCELLED_STATES.has(d.state));
          default:
               return deliveries;
     }
}

// ---------------------------------------------------------------------------

export default function ProductDeliveryListPage() {
     const { t } = useTranslation();
     const theme = useTheme();
     const isMobile = useMediaQuery(theme.breakpoints.down('md'));

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedDeliveryId = searchParams.get('id');

     const [tab, setTab] = useState<TabKey>('active');
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const { data: allDeliveries = [], isLoading } = useProductDeliveries();

     const filteredDeliveries = useMemo(() => filterByTab(allDeliveries, tab), [allDeliveries, tab]);

     const setSelectedDeliveryId = useCallback(
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

     const handleCloseDetail = () => setSelectedDeliveryId(null);

     const handleDeliveryCreated = (deliveryId: string) => {
          setDrawerOpen(false);
          setSelectedDeliveryId(deliveryId);
     };

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('productDeliveries.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('productDeliveries.addDelivery')}
                    </Button>
               </Box>

               {/* State tabs */}
               <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Tabs
                         value={tab}
                         onChange={(_e, newValue: TabKey) => {
                              setTab(newValue);
                              setSelectedDeliveryId(null);
                         }}
                         variant="fullWidth"
                    >
                         <Tab label={t('productDeliveries.tabActive')} value="active" />
                         <Tab label={t('productDeliveries.tabFinished')} value="finished" />
                         <Tab label={t('productDeliveries.tabCancelled')} value="cancelled" />
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
                    {/* Left panel */}
                    {isMobile ? (
                         <Card sx={{ width: '100%', p: 2 }}>
                              <Autocomplete
                                   options={filteredDeliveries}
                                   getOptionLabel={(option) =>
                                        `${option.deliveryDate ? new Date(option.deliveryDate).toLocaleDateString() : ''} — ${(option.stopNames ?? []).join(', ')}`
                                   }
                                   loading={isLoading}
                                   value={filteredDeliveries.find((d) => d.id === selectedDeliveryId) ?? null}
                                   onChange={(_e, newValue) =>
                                        setSelectedDeliveryId(newValue?.id ?? null)
                                   }
                                   isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                   renderInput={(params) => (
                                        <TextField
                                             {...params}
                                             size="small"
                                             placeholder={t('productDeliveries.selectDelivery')}
                                        />
                                   )}
                              />
                         </Card>
                    ) : (
                         <Box sx={{ flexShrink: 0 }}>
                              <DeliveryNameList
                                   deliveries={filteredDeliveries}
                                   loading={isLoading}
                                   selectedId={selectedDeliveryId}
                                   onSelect={setSelectedDeliveryId}
                              />
                         </Box>
                    )}

                    {/* Right panel — delivery detail */}
                    <Card
                         sx={{
                              flex: 1,
                              minWidth: 0,
                              width: { xs: '100%', md: 'auto' },
                              minHeight: { md: 400 },
                              p: 2,
                              display: 'flex',
                              flexDirection: 'column',
                              ...(!selectedDeliveryId && {
                                   alignItems: 'center',
                                   justifyContent: 'center',
                              }),
                         }}
                    >
                         <DeliveryInlineDetail
                              deliveryId={selectedDeliveryId}
                              onDeleted={handleCloseDetail}
                              onDirtyChange={setDirty}
                         />
                    </Card>
               </Box>

               {/* Create delivery drawer */}
               <CreateDeliveryDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleDeliveryCreated}
               />
          </Box>
     );
}
