import {useTranslation} from "react-i18next";
import React, {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Drawer from "@mui/material/Drawer";
import TableBody from "@mui/material/TableBody";
import Typography from "@mui/material/Typography";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";

import {emptyRows} from "../../../providers/utils";
import {Iconify} from "../../../components/iconify";
import {DriversTableRow} from "../drivers-table-row";
import {useApiCall} from "../../../hooks/use-api-call";
import {Scrollbar} from "../../../components/scrollbar";
import {useTable} from "../../../providers/TableProvider";
import {DashboardContent} from "../../../layouts/dashboard";
import {DriversTableToolbar} from "../drivers-table-toolbar";
import {useAuthorizedClient} from "src/api/use-authorized-client";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DriverDetailView} from "../detail-view/driver-detail-view";
import {TableNoData} from "../../../components/table/table-no-data";
import {TableEmptyRows} from "../../../components/table/table-empty-rows";
import {DriversAvailabilityCalendar} from "./drivers-availability-calendar";
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {SortableTableHead} from "../../../components/table/sortable-table-head";

import type {DriversProps} from "../drivers-table-row";

export function DriversView() {
    const client = useAuthorizedClient();
    const {showSnackbar} = useSnackbar();
    const {triggerRefresh} = useEntityStatsRefresh();
    const {executeApiCall, executeApiCallWithDefault} = useApiCall();

    const {t} = useTranslation();

    const [filterFirstName, setFilterFirstName] = useState<string>('');
    const [filterLastName, setFilterLastName] = useState<string>('');
    const [drivers, setDrivers] = useState<DriversProps[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null | undefined>(undefined);
    const [driverIdToDelete, setDriverIdToDelete] = useState<string | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');

    const table = useTable({order, setOrder, orderBy, setOrderBy});
    const notFound = !drivers.length;

    const fetchDrivers = useCallback(async () => {
        const filters: Record<string, string> = {};

        if (filterFirstName) filters.firstName = `startswith:${filterFirstName}`;
        if (filterLastName) filters.lastName = `startswith:${filterLastName}`;
        filters.sort = `${order}:${orderBy}`;

        const response = await executeApiCallWithDefault(() => client.fetchDrivers(filters), []);
        setDrivers(response.map(item => ({
            id: item.id,
            firstName: item.firstName,
            lastName: item.lastName,
            color: item.color,
            availableDates: item.availableDates,
        } as DriversProps)));
    }, [executeApiCallWithDefault, filterFirstName, filterLastName, order, orderBy]);

    useEffect(() => {
        void fetchDrivers();
    }, [fetchDrivers]);

    const handleDeleteDriver = async () => {
        if (driverIdToDelete) {
            const result = await executeApiCall(() => client.deleteDriverEndpoint(driverIdToDelete));
            if (result) {
                triggerRefresh();
                showSnackbar('Driver deleted', 'success');
                setDriverIdToDelete(null);
                void fetchDrivers();
            }
        }
    }

    const handleSelectRow = useCallback((id: string) => table.onSelectRow(id), [table]);
    const handleRowClick = useCallback((id: string) => setSelectedDriverId(id), []);
    const handleDeleteClick = useCallback((id: string) => setDriverIdToDelete(id), []);

    const closeDrawer = () => {
        void fetchDrivers();
        setSelectedDriverId(undefined);
    }

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
                    {t('drivers.title')}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line"/>}
                    onClick={() => setSelectedDriverId(null)}
                >
                    {t('drivers.new')}
                </Button>
            </Box>

            <Box sx={{display: 'flex'}}>
                <Box sx={{width: '40%', pr: 2}}>
                    <Card>
                        <DriversTableToolbar
                            numSelected={table.selected.length}
                            filterFirstName={filterFirstName}
                            filterLastName={filterLastName}
                            onFilterFirstName={(event: React.ChangeEvent<HTMLInputElement>) => {
                                setFilterFirstName(event.target.value);
                                table.onResetPage();
                            }}
                            onFilterLastName={(event: React.ChangeEvent<HTMLInputElement>) => {
                                setFilterLastName(event.target.value);
                                table.onResetPage();
                            }}
                        />

                        <Scrollbar>
                            <TableContainer sx={{overflow: 'unset'}}>
                                <Table>
                                    <SortableTableHead
                                        order={table.order}
                                        orderBy={table.orderBy}
                                        rowCount={drivers.length}
                                        numSelected={table.selected.length}
                                        onSort={table.onSort}
                                        onSelectAllRows={(checked) =>
                                            table.onSelectAllRows(
                                                checked,
                                                drivers.map((client) => client.id)
                                            )
                                        }
                                        headLabel={[
                                            {id: 'firstName', label: t('drivers.firstName')},
                                            {id: 'lastName', label: t('drivers.lastName')},
                                            {id: 'color', label: t('drivers.color')},
                                            {id: ''},
                                        ]}
                                    />
                                    <TableBody>
                                        {drivers
                                            .slice(
                                                table.page * table.rowsPerPage,
                                                table.page * table.rowsPerPage + table.rowsPerPage
                                            )
                                            .map((row) => (
                                                <DriversTableRow
                                                    key={row.id}
                                                    row={row}
                                                    selected={table.selected.includes(row.id)}
                                                    onSelectRow={handleSelectRow}
                                                    onRowClick={handleRowClick}
                                                    onDeleteClick={handleDeleteClick}
                                                />
                                            ))}

                                        <TableEmptyRows
                                            height={68}
                                            emptyRows={emptyRows(table.page, table.rowsPerPage, drivers.length)}
                                        />

                                        {notFound && <TableNoData colSpan={4} />}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Scrollbar>

                        <TablePagination
                            component="div"
                            page={table.page}
                            count={drivers.length}
                            rowsPerPage={table.rowsPerPage}
                            onPageChange={table.onChangePage}
                            rowsPerPageOptions={[5, 10, 25]}
                            onRowsPerPageChange={table.onChangeRowsPerPage}
                            labelRowsPerPage={t('table.rowsPerPage')}
                        />
                    </Card>
                </Box>
                <Box sx={{flexGrow: 1}}>
                   <Card sx={{ display: 'flex', flexDirection: 'column', p: 3 }}>
                       <Box sx={{ width: '100%' }}>
                           <DriversAvailabilityCalendar drivers={drivers} />
                       </Box>
                    </Card>
                </Box>
            </Box>

            <Drawer
                anchor="right"
                open={selectedDriverId !== undefined}
                onClose={() => setSelectedDriverId(undefined)}
            >
                <Box sx={{ width: 700, p: 2 }}>
                    <DriverDetailView
                        id={selectedDriverId!}
                        onClose={closeDrawer}
                    />
                </Box>
            </Drawer>

            <Dialog
                open={driverIdToDelete !== null}
                onClose={() => setDriverIdToDelete(null)}
            >
                <DialogTitle>
                    {t('drivers.deleteConfirm')}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setDriverIdToDelete(null)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteDriver}
                    >
                        {t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </DashboardContent>
    );
}