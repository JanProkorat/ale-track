import type { OutgoingShipmentListItemDto } from 'src/generated/api-client';

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
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import { OutgoingShipmentState } from 'src/generated/api-client';

import { useOutgoingShipments } from 'src/hooks/useOutgoingShipments';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import ShipmentInlineDetail from './components/ShipmentInlineDetail';
import CreateShipmentDrawer from './components/CreateShipmentDrawer';

// ---------------------------------------------------------------------------
// Tab filter constants
// ---------------------------------------------------------------------------

type TabKey = 'active' | 'delivered' | 'cancelled';

const ACTIVE_STATES = new Set<string | OutgoingShipmentState>([
     OutgoingShipmentState.Created, OutgoingShipmentState.Loaded, OutgoingShipmentState.InTransit,
     'Created', 'Loaded', 'InTransit',
]);
const DELIVERED_STATES = new Set<string | OutgoingShipmentState>([OutgoingShipmentState.Delivered, 'Delivered']);
const CANCELLED_STATES = new Set<string | OutgoingShipmentState>([OutgoingShipmentState.Cancelled, 'Cancelled']);

function filterByTab(
     shipments: OutgoingShipmentListItemDto[],
     tab: TabKey,
): OutgoingShipmentListItemDto[] {
     switch (tab) {
          case 'active':
               return shipments.filter((s) => s.state != null && ACTIVE_STATES.has(s.state));
          case 'delivered':
               return shipments.filter((s) => s.state != null && DELIVERED_STATES.has(s.state));
          case 'cancelled':
               return shipments.filter((s) => s.state != null && CANCELLED_STATES.has(s.state));
          default:
               return shipments;
     }
}

// ---------------------------------------------------------------------------

export default function OutgoingShipmentListPage() {
     const { t } = useTranslation();

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedShipmentId = searchParams.get('id');

     const [tab, setTab] = useState<TabKey>('active');
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const { data: allShipments = [], isLoading } = useOutgoingShipments();

     const filteredShipments = useMemo(() => filterByTab(allShipments, tab), [allShipments, tab]);

     const setSelectedShipmentId = useCallback(
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

     // Auto-select first shipment when data loads and nothing is selected
     useEffect(() => {
          if (!selectedShipmentId && !isLoading && filteredShipments.length > 0) {
               setSelectedShipmentId(filteredShipments[0].id ?? null);
          }
     }, [selectedShipmentId, isLoading, filteredShipments, setSelectedShipmentId]);

     const handleCloseDetail = () => setSelectedShipmentId(null);

     const handleShipmentCreated = (shipmentId: string) => {
          setDrawerOpen(false);
          setSelectedShipmentId(shipmentId);
     };

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('outgoingShipments.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('outgoingShipments.addShipment')}
                    </Button>
               </Box>

               {/* State tabs */}
               <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Tabs
                         value={tab}
                         onChange={(_e, newValue: TabKey) => {
                              setTab(newValue);
                              setSelectedShipmentId(null);
                         }}
                         variant="fullWidth"
                    >
                         <Tab label={t('outgoingShipments.tabActive')} value="active" />
                         <Tab label={t('outgoingShipments.tabDelivered')} value="delivered" />
                         <Tab label={t('outgoingShipments.tabCancelled')} value="cancelled" />
                    </Tabs>
               </Paper>

               {/* Detail card */}
               <Card sx={{ p: 2, minHeight: 400 }}>
                    <ShipmentInlineDetail
                         shipmentId={selectedShipmentId}
                         shipments={filteredShipments}
                         shipmentsLoading={isLoading}
                         onSelect={setSelectedShipmentId}
                         onDeleted={handleCloseDetail}
                         onDirtyChange={setDirty}
                    />
               </Card>

               {/* Create shipment drawer */}
               <CreateShipmentDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleShipmentCreated}
               />
          </Box>
     );
}
