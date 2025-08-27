import { useTranslation } from 'react-i18next';
import React, {useState, useEffect} from 'react';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import {Scrollbar} from 'src/components/scrollbar';

import {ClientDetailView} from "../detail-view";
import {emptyRows} from '../../../providers/utils';
import {ClientsTableRow} from '../clients-table-row';
import {useTable} from "../../../providers/TableProvider";
import {ClientsTableToolbar} from '../clients-table-toolbar';
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {ClientDetailCard} from "../detail-view/client-detail-card";
import {TableNoData} from '../../../components/table/table-no-data';
import {TableEmptyRows} from '../../../components/table/table-empty-rows';
import {SplitViewLayout} from "../../../layouts/dashboard/split-view-layout";
import {SortableTableHead} from '../../../components/table/sortable-table-head';

import type {ClientsProps} from '../clients-table-row';

// ----------------------------------------------------------------------

export function ClientsView() {
    const { showSnackbar } = useSnackbar();

    const { t } = useTranslation();

    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [filterName, setFilterName] = useState<string>('');
    const [clients, setClients] = useState<ClientsProps[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [createClientDrawerVisible, setCreateClientDrawerVisible] = useState<boolean>(false);
    const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);
    const [pendingClientId, setPendingClientId] = useState<string | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    useEffect(() => {
        const loadInitial = async () => {
            const loaded = await fetchClients();
            setClients(loaded);
            setSelectedClientId(loaded.length > 0 ? loaded[0].id : null);
            setInitialLoading(false);
        };
        void loadInitial();
    }, []);

    useEffect(() => {
        if (!initialLoading) {
            void fetchClients();
        }
    }, [filterName, order, orderBy]);

    const fetchClients = async () => {
        try {
            const client = new AuthorizedClient();
            const filters: Record<string, string> = {};

            if (filterName) filters.name = `startswith:${filterName}`;
            filters.sort = `${order}:${orderBy}`;

            const response = await client.fetchClients(filters);
            return response.map(item => ({
                id: item.id,
                name: item.name,
                streetName: item.streetName,
                streetNumber: item.streetNumber,
                city: item.city,
                zip: item.zip,
                country: item.country
            } as ClientsProps));
        } catch (error) {
            showSnackbar(t('clients.errorFetchingClients'), 'error');
            console.error('Error fetching clients:', error);
            return [];
        }
    };

    const closeDrawer = () => {
        fetchClients().then(setClients);
        setCreateClientDrawerVisible(false);
    }

    const handleRowClick = (id: string) => {
        if (hasDetailChanges) {
            setPendingClientId(id);
        } else {
            setSelectedClientId(id);
        }
    };

    const handleDisplayedClientChange = (shouldLoadNewData: boolean) => {
        if (shouldLoadNewData){
            fetchClients().then(setClients);

            if (pendingClientId !== null)
                setSelectedClientId(pendingClientId);
        }
    }

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
                <TableContainer sx={{overflow: 'unset'}}>
                    <Table>
                        <SortableTableHead
                            order={table.order}
                            orderBy={table.orderBy}
                            rowCount={clients.length}
                            numSelected={table.selected.length}
                            onSort={table.onSort}
                            onSelectAllRows={(checked) =>
                                table.onSelectAllRows(
                                    checked,
                                    clients.map((client) => client.id)
                                )
                            }
                            headLabel={[
                                {id: 'name', label: t('clients.name')}
                            ]}
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
                                        selected={table.selected.includes(row.id)}
                                        onSelectRow={() => table.onSelectRow(row.id)}
                                        onRowClick={() => handleRowClick(row.id)}
                                        isSelected={selectedClientId === row.id}
                                    />
                                ))}

                            <TableEmptyRows
                                height={68}
                                emptyRows={emptyRows(table.page, table.rowsPerPage, clients.length)}
                            />

                            {clients.length == 0 && <TableNoData colSpan={1} />}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Scrollbar>
        </>
    );

    return (
        <SplitViewLayout
            title={t('clients.title')}
            initialLoading={initialLoading}
            newLabel={t('clients.new')}
            onNewClick={() => setCreateClientDrawerVisible(true)}
            leftContent={clientListCard}
            rightContent={<ClientDetailCard
                id={selectedClientId}
                onDelete={() => fetchClients().then(setClients)}
                onHasChangesChange={setHasDetailChanges}
                shouldCheckPendingChanges={pendingClientId !== null}
                onConfirmed={handleDisplayedClientChange}
                onProgressbarVisibilityChange={setInitialLoading}
            />}
            drawerOpen={createClientDrawerVisible}
            onDrawerClose={closeDrawer}
            drawerContent={<ClientDetailView onClose={closeDrawer} />}
        />
    );
}