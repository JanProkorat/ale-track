import { useTranslation } from 'react-i18next';
import { varAlpha } from 'minimal-shared/utils';
import { useParams, useNavigate } from 'react-router-dom';
import React, { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Drawer from '@mui/material/Drawer';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import { linearProgressClasses } from '@mui/material/LinearProgress';
import { Tab, Card, Tabs, Button, Typography, LinearProgress } from '@mui/material';

import { Scrollbar } from 'src/components/scrollbar';

import { Region } from '../../../api/Client';
import { CreateClientView } from '../detail-view';
import { emptyRows } from '../../../providers/utils';
import { Iconify } from '../../../components/iconify';
import { ClientsTableRow } from '../clients-table-row';
import { useApiCall } from '../../../hooks/use-api-call';
import { useTable } from '../../../providers/TableProvider';
import { DashboardContent } from '../../../layouts/dashboard';
import { ClientsTableToolbar } from '../clients-table-toolbar';
import { mapEnumValue } from '../../../utils/format-enum-value';
import { useAuthorizedClient } from 'src/api/use-authorized-client';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { UpdateClientView } from '../detail-view/update-client-view';
import { TableNoData } from '../../../components/table/table-no-data';
import { TableEmptyRows } from '../../../components/table/table-empty-rows';
import { SortableTableHead } from '../../../components/table/sortable-table-head';

import type { ClientListItemDto } from '../../../api/Client';

// ----------------------------------------------------------------------

export function ClientsView() {
  const client = useAuthorizedClient();
  const { executeApiCallWithDefault } = useApiCall();
  const { showSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const { clientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const isInternalNavigationRef = useRef(false);

  const [selectedRegion, setSelectedRegion] = useLocalStorage<Region>(
    'clients-selected-region',
    Region.ZittauCity
  );
  const [clients, setClients] = useState<ClientListItemDto[]>([]);
  const [selectedClientId, setSelectedClientId] = useLocalStorage<string | null>(
    'clients-selected-client-id',
    clientId ?? null
  );

  const [suppressRegionEffect, setSuppressRegionEffect] = useState<boolean>(true);
  const [createClientDrawerVisible, setCreateClientDrawerVisible] = useState<boolean>(false);
  const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [filterName, setFilterName] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string>('name');
  const table = useTable({ order, setOrder, orderBy, setOrderBy });

  const fetchClients = useCallback(async (region?: Region) => {
    const filters: Record<string, string> = {};
    if (filterName) filters.name = `startswith:${filterName}`;
    if (region !== undefined && region !== null) filters.region = `eq:${region}`;
    filters.sort = `${order}:${orderBy}`;

    return await executeApiCallWithDefault(
      () => client.fetchClients(filters),
      [],
      t('clients.errorFetchingClients')
    );
  }, [executeApiCallWithDefault, filterName, order, orderBy, t]);

  const fetchWithFilters = useCallback(async (region: Region) => {
    await fetchClients(region).then((data) => {
      setClients(data);
      if (data.length > 0) {
        const firstId = data[0].id!;
        setSelectedClientId(firstId);
        isInternalNavigationRef.current = true;
        navigate(`/clients/${firstId}`, { replace: true });
      } else if (selectedClientId !== null) {
        setSelectedClientId(null);
        isInternalNavigationRef.current = true;
        navigate(`/clients`, { replace: true });
      }
    });
  }, [fetchClients, navigate, selectedClientId, setSelectedClientId]);

  useEffect(() => {
    // Skip if this is an internal navigation we triggered
    if (isInternalNavigationRef.current) {
      isInternalNavigationRef.current = false;
      return;
    }

    setInitialLoading(true);
    if (clientId) {
      fetchClients().then((data) => {
        if (data.length === 0) {
          showSnackbar(t('clients.loadDetailError'), 'error');
        } else {
          const urlClient = data.find((c) => c.id === clientId);
          let regionToSet = selectedRegion;
          if (urlClient !== undefined) {
            regionToSet = mapEnumValue(Region, urlClient.region)!;
            setSelectedRegion(regionToSet);
            setSelectedClientId(clientId);
          } else {
            showSnackbar(t('clients.loadDetailError'), 'error');
            navigate(`/clients`);
          }
          setClients(data.filter((d) => mapEnumValue(Region, d.region) === regionToSet));
        }
      }).finally(() => {
        setSuppressRegionEffect(false);
        setInitialLoading(false);
      });
    } else {
      fetchWithFilters(selectedRegion).finally(() => {
        setSuppressRegionEffect(false);
        setInitialLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (suppressRegionEffect)
      return;

    fetchWithFilters(selectedRegion);
  }, [selectedRegion, filterName, order, orderBy, suppressRegionEffect, fetchWithFilters]);

  const handleRowClick = useCallback((id: string) => {
    if (hasDetailChanges) {
      setPendingClientId(id);
    } else {
      setSelectedClientId(id);
      isInternalNavigationRef.current = true;
      navigate(`/clients/${id}`);
    }
  }, [hasDetailChanges, navigate, setSelectedClientId]);

  const handleSelectRow = useCallback((id: string) => table.onSelectRow(id), [table]);

  const handleAfterDeletingClient = async () => {
    await fetchClients().then((newData) => {
      setClients(newData);
      setSelectedClientId(newData.length > 0 ? newData[0].id! : null);
    });
  };

  const handleDisplayedClientChange = (shouldLoadNewData: boolean) => {
    if (shouldLoadNewData) {
      fetchClients().then((newData) => {
        setClients(newData);
        if (pendingClientId !== null) {
          setSelectedClientId(pendingClientId);
        }
      });
    }
    setPendingClientId(null);
  };

  const closeDrawer = () => {
    fetchClients().then((data) => {
      setClients(data);
    });
    setCreateClientDrawerVisible(false);
  };

  const clientListCard = (
    <>
      <ClientsTableToolbar
        numSelected={table.selected.length}
        filterName={filterName}
        onFilterName={(event: React.ChangeEvent<HTMLInputElement>) => {
          setFilterName(event.target.value);
          table.onResetPage();
        }}
      />

      <Scrollbar>
        <TableContainer sx={{ overflow: 'unset' }}>
          <Table>
            <SortableTableHead
              order={table.order}
              orderBy={table.orderBy}
              rowCount={clients.length}
              numSelected={table.selected.length}
              onSort={table.onSort}
              headLabel={[{ id: 'name', label: t('clients.name') }]}
            />
            <TableBody>
              {clients
                .slice(
                  table.page * table.rowsPerPage,
                  table.page * table.rowsPerPage + table.rowsPerPage
                )
                .map((row) => (
                  <ClientsTableRow
                    key={row.id}
                    row={row}
                    selected={table.selected.includes(row.id!)}
                    onSelectRow={handleSelectRow}
                    onRowClick={handleRowClick}
                    isSelected={selectedClientId === row.id}
                  />
                ))}

              <TableEmptyRows
                height={68}
                emptyRows={emptyRows(table.page, table.rowsPerPage, clients.length)}
              />

              {clients.length === 0 && <TableNoData colSpan={1} />}
            </TableBody>
          </Table>
        </TableContainer>
      </Scrollbar>
    </>
  );

  return (
    <DashboardContent>
      <Box sx={{ mb: 5, display: 'flex', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {t('clients.title')}
        </Typography>
        <Button
          variant="contained"
          color="inherit"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setCreateClientDrawerVisible(true)}
        >
          {t('clients.new')}
        </Button>
      </Box>

      <Box sx={{ display: 'flex' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ position: 'relative', alignItems: 'center' }}>
            {initialLoading ? (
              <LinearProgress
                sx={{
                  zIndex: 1,
                  position: 'absolute',
                  top: 190,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '40%',
                  bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                  [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
                }}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Card sx={{ p: 2 }}>
                  <Tabs
                    value={selectedRegion}
                    onChange={(_, newValue) => setSelectedRegion(newValue)}
                    textColor="secondary"
                    indicatorColor="secondary"
                    variant="fullWidth"
                  >
                    {Object.keys(Region)
                      .filter((key) => isNaN(Number(key)))
                      .map((region) => {
                        const regionEnumValue = Region[region as keyof typeof Region];
                        return (
                          <Tab key={region} value={regionEnumValue} label={t('region.' + region)} />
                        );
                      })}
                  </Tabs>
                </Card>
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ width: '20%', pr: 2 }}>
                    <Card>{clientListCard}</Card>
                  </Box>
                  <Card
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 300,
                      p: 2,
                    }}
                  >
                    {selectedClientId ? (
                      <UpdateClientView
                        id={selectedClientId}
                        shouldCheckPendingChanges={pendingClientId !== null}
                        onDelete={handleAfterDeletingClient}
                        onConfirmed={handleDisplayedClientChange}
                        onHasChangesChange={setHasDetailChanges}
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', textAlign: 'center' }}
                      >
                        {t('clients.noDetailToDisplay')}
                      </Typography>
                    )}
                  </Card>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <Drawer anchor="right" open={createClientDrawerVisible} onClose={closeDrawer}>
        <Box sx={{ width: 900, p: 2 }}>
          <CreateClientView region={selectedRegion} onClose={closeDrawer} />
        </Box>
      </Drawer>
    </DashboardContent>
  );
}
