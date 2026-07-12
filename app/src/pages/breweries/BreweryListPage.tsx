import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import Typography from '@mui/material/Typography';

import { useBreweries } from 'src/hooks/useBreweries';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import LoadingSpinner from 'src/components/common/LoadingSpinner';

import BreweryInlineDetail from './components/BreweryInlineDetail';
import CreateBreweryDrawer from './components/CreateBreweryDrawer';

// ---------------------------------------------------------------------------

export default function BreweryListPage() {
     const { t } = useTranslation();

     const { data: breweries = [], isLoading } = useBreweries();

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedId = searchParams.get('id');
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const setSelectedId = useCallback(
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

     // Auto-select first brewery when data loads
     const activeId = selectedId && breweries.some((b) => b.id === selectedId)
          ? selectedId
          : breweries[0]?.id ?? null;

     // Sync auto-selected id to URL
     useEffect(() => {
          if (activeId && activeId !== selectedId) {
               setSelectedId(activeId);
          }
     }, [activeId, selectedId, setSelectedId]);

     const handleTabChange = (_e: React.SyntheticEvent, newValue: string) => {
          setSelectedId(newValue);
     };

     const handleBreweryCreated = useCallback((breweryId: string) => {
          setDrawerOpen(false);
          setSelectedId(breweryId);
     }, [setSelectedId]);

     const handleDeleted = useCallback(() => {
          setSelectedId(null);
     }, [setSelectedId]);

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('breweries.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('breweries.addBrewery')}
                    </Button>
               </Box>

               {isLoading ? (
                    <LoadingSpinner />
               ) : breweries.length === 0 ? (
                    <Card sx={{ p: 4, textAlign: 'center' }}>
                         <Typography variant="body2" color="text.secondary">
                              {t('common.noData')}
                         </Typography>
                    </Card>
               ) : (
                    <>
                         {/* Brewery tabs */}
                         <Paper variant="outlined" sx={{ p:2, mb: 2 }}>
                              <Tabs
                                   value={activeId ?? false}
                                   onChange={handleTabChange}
                                   variant="fullWidth"
                              >
                                   {breweries.map((b) => (
                                        <Tab
                                             key={b.id}
                                             value={b.id}
                                             label={
                                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                       {b.color && (
                                                            <Box
                                                                 sx={{
                                                                      width: 12,
                                                                      height: 12,
                                                                      borderRadius: '50%',
                                                                      backgroundColor: b.color,
                                                                      border: '1px solid',
                                                                      borderColor: 'divider',
                                                                      flexShrink: 0,
                                                                 }}
                                                            />
                                                       )}
                                                       {b.name}
                                                  </Box>
                                             }
                                        />
                                   ))}
                              </Tabs>
                         </Paper>

                         {/* Brewery detail */}
                         <Card
                              sx={{
                                   p: 2,
                                   display: 'flex',
                                   flexDirection: 'column',
                                   ...(!activeId && {
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 400,
                                   }),
                              }}
                         >
                              <BreweryInlineDetail
                                   breweryId={activeId}
                                   onDeleted={handleDeleted}
                                   onDirtyChange={setDirty}
                              />
                         </Card>
                    </>
               )}

               {/* Create brewery drawer */}
               <CreateBreweryDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleBreweryCreated}
               />

          </Box>
     );
}
