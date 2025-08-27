import dayjs from "dayjs";
import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import {Button, Dialog, DialogTitle, DialogActions} from "@mui/material";

import {emptyRows} from "../../../providers/utils";
import {Scrollbar} from "../../../components/scrollbar";
import {useTable} from "../../../providers/TableProvider";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {TableNoData} from "../../../components/table/table-no-data";
import {TableEmptyRows} from "../../../components/table/table-empty-rows";
import {ProductDeliveriesTableRow} from "../product-deliveries-table-row";
import {SplitViewLayout} from "../../../layouts/dashboard/split-view-layout";
import {SortableTableHead} from "../../../components/table/sortable-table-head";
import {ProductDeliveriesTableToolbar} from "../product-deliveries-table-toolbar";
import {ProductDeliveryDetailView} from "../detail-view/product-delivery-detail-view";
import {CreateProductDeliveryView} from "../detail-view/create-product-delivery-view";

import type {ProductDeliveryListItemDto} from "../../../api/Client";

export function ProductDeliveriesView() {
    const {t} = useTranslation();
    const { showSnackbar } = useSnackbar();

    const [initialLoading, setInitialLoading] = useState<boolean>(false);
    const [deliveries, setDeliveries] = useState<ProductDeliveryListItemDto[]>([]);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | undefined>(undefined);
    const [pendingDeliveryId, setPendingDeliveryId] = useState<string | null>(null);
    const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);
    const [createDeliveryDrawerVisible, setCreateDeliveryDrawerVisible] = useState<boolean>(false);
    const [pendingDeliveryIdForConfirmation, setPendingDeliveryIdForConfirmation] = useState<string|null|undefined>(undefined);

    const [filterDate, setFilterDate] = useState<Date | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [orderBy, setOrderBy] = useState<string>('deliveryDate');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    useEffect(() => {
        setInitialLoading(true);
        const loadInitial = async () => {
            const loaded = await fetchProductDeliveries();
            setDeliveries(loaded);
            setSelectedDeliveryId(loaded.length > 0 ? loaded[0].id : undefined);
            setInitialLoading(false);
        };
        void loadInitial();
    }, []);

    useEffect(() => {
        if (!initialLoading) {
            void fetchProductDeliveries().then(setDeliveries);
        }
    }, [filterDate, order, orderBy]);

    const fetchProductDeliveries = async () => {
        try {
            const client = new AuthorizedClient();
            const filters: Record<string, string> = {};

            if (filterDate !== null) {
                filters.deliveryDate = `eq:${dayjs(filterDate).format('YYYY-MM-DD')}`;
            }

            filters.sort = `${order}:${orderBy}`;

            return await client.fetchProductDeliveries(filters);
        } catch (error) {
            showSnackbar(t('productDeliveries.loadListError'), 'error');
            console.error('Error fetching product deliveries:', error);
            return [];
        }
    };

    const handleRowClick = (id: string) => {
        if (selectedDeliveryId === id)
            return;

        updateSelectedId(id);
    };

    const updateSelectedId = (id: string) => {
        if (hasDetailChanges) {
            setPendingDeliveryId(id);
        } else {
            setSelectedDeliveryId(id);
        }
    }

    const handleDisplayedDeliveryChange = async (shouldLoadNewData: boolean) => {
        if (shouldLoadNewData) {
            const updated = await fetchProductDeliveries();
            setDeliveries(updated);

            if (pendingDeliveryId !== null)
                setSelectedDeliveryId(pendingDeliveryId);
        }
        setPendingDeliveryId(null);
    }

    const handleDeleteDelivery = async () => {
        await fetchProductDeliveries().then((newData) => {
            setDeliveries(newData);
            setSelectedDeliveryId(newData.length > 0 ? newData[0].id : undefined);
        })
    }

    const handleDeliveryCreated = async (newDeliveryId: string) => {
        await fetchProductDeliveries().then(setDeliveries);
        setSelectedDeliveryId(newDeliveryId);
        setCreateDeliveryDrawerVisible(false);
    }

    const handleNewDeliveryClick = () => {
        if (selectedDeliveryId !== undefined && selectedDeliveryId !== null && hasDetailChanges) {
            setPendingDeliveryIdForConfirmation(null);
        } else {
            setCreateDeliveryDrawerVisible(true)
        }
    }

    const closeDrawer = () => {
        fetchProductDeliveries().then(setDeliveries);
        setCreateDeliveryDrawerVisible(false);
    }

    const deliveriesListCard = (
        <>
            <ProductDeliveriesTableToolbar
                numSelected={table.selected.length}
                filterDate={filterDate}
                onFilterDate={(value: string | null) => {
                    setFilterDate(value != null ? dayjs(value).toDate() : null);
                    table.onResetPage();
                }}
            />

            <Scrollbar>
                <TableContainer sx={{overflow: 'unset'}}>
                    <Table>
                        <SortableTableHead
                            order={table.order}
                            orderBy={table.orderBy}
                            rowCount={deliveries.length}
                            numSelected={table.selected.length}
                            onSort={table.onSort}
                            onSelectAllRows={(checked) =>
                                table.onSelectAllRows(
                                    checked,
                                    deliveries.map((delivery) => delivery.id!)
                                )
                            }
                            headLabel={[
                                {id: 'deliveryDate', label: t('productDeliveries.deliveryDate')},
                                {id: 'state', label: t('productDeliveries.state')},
                            ]}
                        />
                        <TableBody>
                            {deliveries
                                .slice(
                                    table.page * table.rowsPerPage,
                                    table.page * table.rowsPerPage + table.rowsPerPage
                                )
                                .map((row) => (
                                    <ProductDeliveriesTableRow
                                        key={row.id}
                                        row={row}
                                        selected={table.selected.includes(row.id!)}
                                        onSelectRow={() => table.onSelectRow(row.id!)}
                                        onRowClick={() => handleRowClick(row.id!)}
                                        isSelected={selectedDeliveryId === row.id}
                                    />
                                ))}

                            <TableEmptyRows
                                height={68}
                                emptyRows={emptyRows(table.page, table.rowsPerPage, deliveries.length)}
                            />

                            {deliveries.length == 0 && <TableNoData colSpan={2} />}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Scrollbar>
        </>
    );

    return (
        <>
            <SplitViewLayout
                title={t('productDeliveries.title')}
                initialLoading={initialLoading}
                newLabel={t('productDeliveries.new')}
                onNewClick={handleNewDeliveryClick}
                leftContentWidth={30}
                leftContent={deliveriesListCard}
                rightContent={<ProductDeliveryDetailView
                    id={selectedDeliveryId}
                    shouldCheckPendingChanges={pendingDeliveryId !== null}
                    onDelete={handleDeleteDelivery}
                    onConfirmed={handleDisplayedDeliveryChange}
                    onProgressbarVisibilityChange={setInitialLoading}
                    onHasChangesChange={setHasDetailChanges}
                />}
                drawerContent={<CreateProductDeliveryView
                    width={850}
                    onClose={closeDrawer}
                    onSave={handleDeliveryCreated}
                />}
                onDrawerClose={closeDrawer}
                drawerOpen={createDeliveryDrawerVisible}
                drawerWidth={850}
            />

            <Dialog
                open={pendingDeliveryIdForConfirmation !== undefined}
                onClose={() => setPendingDeliveryIdForConfirmation(undefined)}
            >
                <DialogTitle>
                    {t('common.unsavedChangesLossConfirm')}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setPendingDeliveryIdForConfirmation(undefined)} variant="contained" color="primary">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        color="inherit"
                        onClick={() => {
                            setHasDetailChanges(false);

                            if (pendingDeliveryIdForConfirmation === null) {
                                setSelectedDeliveryId(undefined);
                            } else {
                                updateSelectedId(pendingDeliveryIdForConfirmation!);
                            }

                            setPendingDeliveryIdForConfirmation(undefined);
                        }}
                    >
                        {t('common.continue')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}