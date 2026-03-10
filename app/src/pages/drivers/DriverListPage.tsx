import { useState, useEffect, useCallback } from 'react';
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

import { useDrivers } from 'src/hooks/useDrivers';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import DriverNameList from './components/DriverNameList';
import DriverInlineDetail from './components/DriverInlineDetail';
import CreateDriverDrawer from './components/CreateDriverDrawer';

// ---------------------------------------------------------------------------

export default function DriverListPage() {
     const { t } = useTranslation();
     const theme = useTheme();
     const isMobile = useMediaQuery(theme.breakpoints.down('md'));

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedDriverId = searchParams.get('id');

     const [search, setSearch] = useState('');
     const [sortAsc, setSortAsc] = useState(true);
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const { data: drivers = [], isLoading } = useDrivers(search);

     const setSelectedDriverId = useCallback(
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

     // Auto-select first driver (sorted by lastName+firstName ascending) when nothing is selected
     useEffect(() => {
          if (!selectedDriverId && !isLoading && drivers.length > 0) {
               const sorted = [...drivers].sort((a, b) => {
                    const nameA = `${a.lastName ?? ''} ${a.firstName ?? ''}`.trim();
                    const nameB = `${b.lastName ?? ''} ${b.firstName ?? ''}`.trim();
                    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
               });
               setSelectedDriverId(sorted[0].id ?? null);
          }
     }, [selectedDriverId, isLoading, drivers, setSelectedDriverId]);

     const handleCloseDetail = () => setSelectedDriverId(null);

     const handleDriverCreated = (driverId: string) => {
          setDrawerOpen(false);
          setSelectedDriverId(driverId);
     };

     const detailContent = (
          <DriverInlineDetail
               driverId={selectedDriverId}
               onDeleted={handleCloseDetail}
               onDirtyChange={setDirty}
          />
     );

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('drivers.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('drivers.addDriver')}
                    </Button>
               </Box>

               {/* Split view */}
               <Box
                    sx={{
                         display: 'flex',
                         flexDirection: { xs: 'column', md: 'row' },
                         alignItems: 'flex-start',
                         gap: 2,
                    }}
               >
                    {/* Left panel — driver name list (desktop) / dropdown (mobile) */}
                    {isMobile ? (
                         <Card sx={{ width: '100%', p: 2 }}>
                              <Autocomplete
                                   options={drivers}
                                   getOptionLabel={(option) =>
                                        `${option.lastName ?? ''} ${option.firstName ?? ''}`.trim()
                                   }
                                   loading={isLoading}
                                   value={drivers.find((d) => d.id === selectedDriverId) ?? null}
                                   onChange={(_e, newValue) =>
                                        setSelectedDriverId(newValue?.id ?? null)
                                   }
                                   isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                   renderInput={(params) => (
                                        <TextField
                                             {...params}
                                             size="small"
                                             placeholder={t('drivers.selectDriver')}
                                        />
                                   )}
                              />
                         </Card>
                    ) : (
                         <Box sx={{ width: 240, flexShrink: 0 }}>
                              <DriverNameList
                                   drivers={drivers}
                                   loading={isLoading}
                                   search={search}
                                   onSearchChange={setSearch}
                                   selectedId={selectedDriverId}
                                   onSelect={setSelectedDriverId}
                                   sortAsc={sortAsc}
                                   onToggleSort={() => setSortAsc((prev) => !prev)}
                              />
                         </Box>
                    )}

                    {/* Right panel — driver detail */}
                    <Card
                         sx={{
                              flex: 1,
                              minWidth: 0,
                              width: { xs: '100%', md: 'auto' },
                              minHeight: { md: 400 },
                              p: 2,
                              display: 'flex',
                              flexDirection: 'column',
                              ...(!selectedDriverId && {
                                   alignItems: 'center',
                                   justifyContent: 'center',
                              }),
                         }}
                    >
                         {detailContent}
                    </Card>
               </Box>

               {/* Create driver drawer */}
               <CreateDriverDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleDriverCreated}
               />
          </Box>
     );
}
