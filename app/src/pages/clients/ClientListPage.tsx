import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { useClients } from 'src/hooks/useClients';

import { Region } from 'src/generated/api-client';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import RegionTabs from './components/RegionTabs';
import ClientNameList from './components/ClientNameList';
import ClientInlineDetail from './components/ClientInlineDetail';
import CreateClientDrawer from './components/CreateClientDrawer';

// ---------------------------------------------------------------------------
// Map string enum key (e.g. "ZittauCity") to the Region numeric enum value
// ---------------------------------------------------------------------------

function regionKeyToEnum(key: string): Region {
     const entry = Object.entries(Region).find(
          ([k]) => k === key && isNaN(Number(k)),
     );
     return entry ? (entry[1] as Region) : Region.ZittauCity;
}

// ---------------------------------------------------------------------------

export default function ClientListPage() {
     const { t } = useTranslation();
     const theme = useTheme();
     const isMobile = useMediaQuery(theme.breakpoints.down('md'));

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedClientId = searchParams.get('id');

     const [selectedRegion, setSelectedRegion] = useState<Region>(Region.ZittauCity);
     const [search, setSearch] = useState('');
     const [sortAsc, setSortAsc] = useState(true);
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const { data: clients = [], isLoading } = useClients(search, selectedRegion);

     const setSelectedClientId = useCallback(
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

     const handleCloseDetail = () => setSelectedClientId(null);

     const handleClientCreated = (clientId: string, regionKey: string) => {
          setDrawerOpen(false);
          const region = regionKeyToEnum(regionKey);
          if (region !== selectedRegion) {
               setSelectedRegion(region);
          }
          setSelectedClientId(clientId);
     };

     // Region string key for the drawer's initial value
     const selectedRegionKey =
          Object.entries(Region).find(
               ([k, v]) => v === selectedRegion && isNaN(Number(k)),
          )?.[0] ?? 'ZittauCity';

     const detailContent = (
          <ClientInlineDetail
               clientId={selectedClientId}
               onDeleted={handleCloseDetail}
               onDirtyChange={setDirty}
          />
     );

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('clients.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('clients.addClient')}
                    </Button>
               </Box>

               {/* Region tabs */}
               <RegionTabs
                    selectedRegion={selectedRegion}
                    onRegionChange={(r) => {
                         setSelectedRegion(r);
                         setSelectedClientId(null);
                    }}
               />

               {/* Split view */}
               <Box
                    sx={{
                         display: 'flex',
                         flexDirection: { xs: 'column', md: 'row' },
                         alignItems: 'flex-start',
                         gap: 2,
                         mt: 2,
                    }}
               >
                    {/* Left panel — client name list (desktop) / dropdown (mobile) */}
                    {isMobile ? (
                         <Card sx={{ width: '100%', p: 2 }}>
                              <Autocomplete
                                   options={clients}
                                   getOptionLabel={(option) => option.name ?? ''}
                                   loading={isLoading}
                                   value={clients.find((c) => c.id === selectedClientId) ?? null}
                                   onChange={(_e, newValue) =>
                                        setSelectedClientId(newValue?.id ?? null)
                                   }
                                   isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                   renderInput={(params) => (
                                        <TextField
                                             {...params}
                                             size="small"
                                             placeholder={t('clients.selectClient')}
                                        />
                                   )}
                              />
                         </Card>
                    ) : (
                         <Box sx={{ width: 240, flexShrink: 0 }}>
                              <ClientNameList
                                   clients={clients}
                                   loading={isLoading}
                                   search={search}
                                   onSearchChange={setSearch}
                                   selectedId={selectedClientId}
                                   onSelect={setSelectedClientId}
                                   sortAsc={sortAsc}
                                   onToggleSort={() => setSortAsc((prev) => !prev)}
                              />
                         </Box>
                    )}

                    {/* Right panel — client detail */}
                    <Card
                         sx={{
                              flex: 1,
                              minWidth: 0,
                              width: { xs: '100%', md: 'auto' },
                              minHeight: { md: 400 },
                              p: 2,
                              display: 'flex',
                              flexDirection: 'column',
                              ...(!selectedClientId && {
                                   alignItems: 'center',
                                   justifyContent: 'center',
                              }),
                         }}
                    >
                         {detailContent}
                    </Card>
               </Box>

               {/* Create client drawer */}
               <CreateClientDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleClientCreated}
                    initialRegion={selectedRegionKey}
               />

          </Box>
     );
}
