import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from 'react';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import {Scrollbar} from 'src/components/scrollbar';

import {BreweryDetailView} from "../detail-view";
import {emptyRows} from "../../../providers/utils";
import {BreweriesTableRow} from '../breweries-table-row';
import {useTable} from "../../../providers/TableProvider";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {BreweriesTableToolbar} from "../breweries-table-toolbar";
import {TableNoData} from '../../../components/table/table-no-data';
import {BreweryDetailCard} from "../detail-view/brewery-detail-card";
import {TableEmptyRows} from '../../../components/table/table-empty-rows';
import {SplitViewLayout} from "../../../layouts/dashboard/split-view-layout";
import {SortableTableHead} from '../../../components/table/sortable-table-head';

import type {BreweriesProps} from '../breweries-table-row';

// ----------------------------------------------------------------------

export function BreweriesView() {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();

    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [filterName, setFilterName] = useState<string>('');
    const [breweries, setBreweries] = useState<BreweriesProps[]>([]);
    const [selectedBreweryId, setSelectedBreweryId] = useState<string | null>(null);
    const [createBreweryDrawerVisible, setCreateBreweryDrawerVisible] = useState<boolean>(false);
    const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);
    const [pendingBreweryId, setPendingBreweryId] = useState<string | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    useEffect(() => {
        const loadInitial = async () => {
            const loaded = await fetchBreweries();
            setBreweries(loaded);
            setSelectedBreweryId(loaded.length > 0 ? loaded[0].id : null);
            setInitialLoading(false);
        };
        void loadInitial();
    }, []);

    useEffect(() => {
        if (!initialLoading) {
            void fetchBreweries().then(setBreweries);
        }
    }, [filterName, order, orderBy]);

    const fetchBreweries = async () => {
        try {
            const client = new AuthorizedClient();
            const filters: Record<string, string> = {};

            if (filterName) filters.name = `startswith:${filterName}`;
            filters.sort = `${order}:${orderBy}`;

            const response = await client.fetchBreweries(filters);
            return response.map(item => ({
                id: item.id,
                name: item.name,
                streetName: item.streetName,
                streetNumber: item.streetNumber,
                city: item.city,
                zip: item.zip,
                country: item.country
            } as BreweriesProps));
        } catch (error) {
            showSnackbar('Error fetching breweries', 'error');
            console.error('Error fetching breweries:', error);
            return [];
        }
    };

    const closeDrawer = () => {
        fetchBreweries().then(setBreweries);
        setCreateBreweryDrawerVisible(false);
    }

    const handleRowClick = (id: string) => {
        if (hasDetailChanges) {
            setPendingBreweryId(id);
        } else {
            setSelectedBreweryId(id);
        }
    };

    const handleDisplayedBreweryChange = (shouldLoadNewData: boolean) => {
        if (shouldLoadNewData){
            fetchBreweries().then(setBreweries);

            if (pendingBreweryId !== null)
                setSelectedBreweryId(pendingBreweryId);
        }
        setPendingBreweryId(null);
    }

    const handleAfterDeletingBrewery = async () => {
        await fetchBreweries().then((newData) => {
            setBreweries(newData);
            setSelectedBreweryId(newData.length > 0 ? newData[0].id : null);
        })
    }

    const breweriesListCard = (
        <>
            <BreweriesTableToolbar
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
                            rowCount={breweries.length}
                            numSelected={table.selected.length}
                            onSort={table.onSort}
                            onSelectAllRows={(checked) =>
                                table.onSelectAllRows(
                                    checked,
                                    breweries.map((brewery) => brewery.id)
                                )
                            }
                            headLabel={[
                                {id: 'name', label: t('breweries.name')},
                            ]}
                        />
                        <TableBody>
                            {breweries
                                .slice(
                                    table.page * table.rowsPerPage,
                                    table.page * table.rowsPerPage + table.rowsPerPage
                                )
                                .map((row) => (
                                    <BreweriesTableRow
                                        key={row.id}
                                        row={row}
                                        selected={table.selected.includes(row.id)}
                                        onSelectRow={() => table.onSelectRow(row.id)}
                                        onRowClick={() => handleRowClick(row.id)}
                                        isSelected={selectedBreweryId === row.id}
                                    />
                                ))}

                            <TableEmptyRows
                                height={68}
                                emptyRows={emptyRows(table.page, table.rowsPerPage, breweries.length)}
                            />

                            {breweries.length == 0 && <TableNoData colSpan={1} />}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Scrollbar>
        </>
    );

    return (
        <SplitViewLayout
            title={t('breweries.title')}
            initialLoading={initialLoading}
            newLabel={t('breweries.new')}
            onNewClick={() => setCreateBreweryDrawerVisible(true)}
            leftContent={breweriesListCard}
            rightContent={<BreweryDetailCard
                id={selectedBreweryId}
                onDelete={handleAfterDeletingBrewery}
                onHasChangesChange={setHasDetailChanges}
                shouldCheckPendingChanges={pendingBreweryId !== null}
                onConfirmed={handleDisplayedBreweryChange}
                onProgressbarVisibilityChange={setInitialLoading}
            />}
            drawerOpen={createBreweryDrawerVisible}
            onDrawerClose={closeDrawer}
            drawerContent={<BreweryDetailView onClose={closeDrawer} />}
        />
    );
}