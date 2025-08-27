import {useTranslation} from 'react-i18next';
import React, {useState, useEffect} from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Drawer from "@mui/material/Drawer";
import TableBody from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import {DashboardContent} from 'src/layouts/dashboard';

import {Iconify} from 'src/components/iconify';
import {Scrollbar} from 'src/components/scrollbar';

import {emptyRows} from '../../../providers/utils';
import {VehiclesTableRow} from '../vehicles-table-row';
import {useTable} from "../../../providers/TableProvider";
import {VehiclesTableToolbar} from '../vehicles-table-toolbar';
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {TableNoData} from '../../../components/table/table-no-data';
import {VehicleDetailView} from "../detail-view/vehicle-detail-view";
import {TableEmptyRows} from '../../../components/table/table-empty-rows';
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {SortableTableHead} from '../../../components/table/sortable-table-head';

import type {VehiclesProps} from '../vehicles-table-row';

// ----------------------------------------------------------------------

export function VehiclesView() {
    const {showSnackbar} = useSnackbar();
    const {triggerRefresh} = useEntityStatsRefresh();

    const {t} = useTranslation();

    const [filterName, setFilterName] = useState<string>('');
    const [vehicles, setVehicles] = useState<VehiclesProps[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null | undefined>(undefined);
    const [vehicleIdToDelete, setVehicleIdToDelete] = useState<string | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    useEffect(() => {
        void fetchVehicles();
    }, [filterName, order, orderBy]);

    const fetchVehicles = async () => {
        try {
            const vehicle = new AuthorizedClient();
            const filters: Record<string, string> = {};

            if (filterName) filters.name = `startswith:${filterName}`;
            filters.sort = `${order}:${orderBy}`;

            const response = await vehicle.fetchVehicles(filters);
            setVehicles(response.map(item => ({
                id: item.id,
                name: item.name,
                maxWeight: item.maxWeight,
            } as VehiclesProps)));
        } catch (error) {
            showSnackbar('Error fetching vehicles', 'error');
            console.error('Error fetching vehicles:', error);
        }
    };

    const handleDeleteVehicle = async () => {
        if (vehicleIdToDelete) {
            try {
                const vehicle = new AuthorizedClient();
                await vehicle.deleteVehicleEndpoint(vehicleIdToDelete);
                triggerRefresh();
                showSnackbar('Vehicle deleted', 'success');
            } catch (e) {
                showSnackbar('Error deleting vehicles', 'error');
                console.error('Error deleting vehicle', e);
            } finally {
                setVehicleIdToDelete(null);
                void fetchVehicles();
            }
        }
    }

    const closeDrawer = () => {
        setSelectedVehicleId(undefined);
        void fetchVehicles();
    }

    const notFound = !vehicles.length;

    return (
        <DashboardContent>
            <Box
                sx={{
                    mb: 5,
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <Typography variant="h4" sx={{flexGrow: 1}}>
                    {t('vehicles.title')}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line"/>}
                    onClick={() => setSelectedVehicleId(null)}
                >
                    {t('vehicles.new')}
                </Button>
            </Box>

            <Card>
                <VehiclesTableToolbar
                    numSelected={table.selected.length}
                    filterName={filterName}
                    onFilterName={(event: React.ChangeEvent<HTMLInputElement>) => {
                        setFilterName(event.target.value);
                        table.onResetPage();
                    }}
                />

                <Scrollbar>
                    <TableContainer sx={{overflow: 'unset'}}>
                        <Table sx={{minWidth: 800}}>
                            <SortableTableHead
                                order={table.order}
                                orderBy={table.orderBy}
                                rowCount={vehicles.length}
                                numSelected={table.selected.length}
                                onSort={table.onSort}
                                onSelectAllRows={(checked) =>
                                    table.onSelectAllRows(
                                        checked,
                                        vehicles.map((vehicle) => vehicle.id)
                                    )
                                }
                                headLabel={[
                                    {id: 'name', label: t('vehicles.name')},
                                    {id: 'maxWeight', label: t('vehicles.maxWeight')},
                                    {id: ''},
                                ]}
                            />
                            <TableBody>
                                {vehicles
                                    .slice(
                                        table.page * table.rowsPerPage,
                                        table.page * table.rowsPerPage + table.rowsPerPage
                                    )
                                    .map((row) => (
                                        <VehiclesTableRow
                                            key={row.id}
                                            row={row}
                                            selected={table.selected.includes(row.id)}
                                            onSelectRow={() => table.onSelectRow(row.id)}
                                            onRowClick={() => setSelectedVehicleId(row.id)}
                                            onDeleteClick={() => setVehicleIdToDelete(row.id)}
                                        />
                                    ))}

                                <TableEmptyRows
                                    height={68}
                                    emptyRows={emptyRows(table.page, table.rowsPerPage, vehicles.length)}
                                />

                                {notFound && <TableNoData colSpan={3} />}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Scrollbar>

                <TablePagination
                    component="div"
                    page={table.page}
                    count={vehicles.length}
                    rowsPerPage={table.rowsPerPage}
                    onPageChange={table.onChangePage}
                    rowsPerPageOptions={[5, 10, 25]}
                    onRowsPerPageChange={table.onChangeRowsPerPage}
                    labelRowsPerPage={t('table.rowsPerPage')}
                />
            </Card>

            <Drawer
                anchor="right"
                open={selectedVehicleId !== undefined}
                onClose={() => setSelectedVehicleId(undefined)}
            >
                <Box sx={{width: 700, p: 2}}>
                    <VehicleDetailView
                        id={selectedVehicleId!}
                        onClose={closeDrawer} 
                        onSave={() => {
                            setSelectedVehicleId(undefined);
                            void fetchVehicles();
                        }}
                    />
                </Box>
            </Drawer>

            {/* Delete confirmation dialog */}
            <Dialog
                open={vehicleIdToDelete !== null}
                onClose={() => setVehicleIdToDelete(null)}
            >
                <DialogTitle>
                    {t('vehicles.deleteConfirm')}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setVehicleIdToDelete(null)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteVehicle}
                    >
                        {t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </DashboardContent>
    );
}