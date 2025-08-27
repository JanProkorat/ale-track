import dayjs from "dayjs";
import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import TableBody from "@mui/material/TableBody";
import {Table, Button, Dialog, DialogTitle, DialogActions, TableContainer} from "@mui/material";

import { TableNoData } from "src/components/table/table-no-data";
import { TableEmptyRows } from "src/components/table/table-empty-rows";

import {OrdersTableRow} from "../orders-table-row";
import {emptyRows} from "../../../providers/utils";
import {Scrollbar} from "../../../components/scrollbar";
import {useTable} from "../../../providers/TableProvider";
import {OrdersTableToolbar} from "../orders-table-toolbar";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {OrderDetailView} from "../detail-view/order-detail-view";
import {CreateOrderView} from "../detail-view/create-order-view";
import {SplitViewLayout} from "../../../layouts/dashboard/split-view-layout";
import {SortableTableHead} from "../../../components/table/sortable-table-head";

import type {OrderState, OrderListItemDto} from "../../../api/Client";

export function OrdersView() {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [orders, setOrders] = useState<OrderListItemDto[]>([]);
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined);
    const [createOrderDrawerVisible, setCreateOrderDrawerVisible] = useState<boolean>(false);
    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
    const [pendingOrderIdForConfirmation, setPendingOrderIdForConfirmation] = useState<string|null|undefined>(undefined);
    const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);

    const [filterDate, setFilterDate] = useState<Date | null>(null);
    const [filterClientName, setFilterClientName] = useState<string | null>(null);
    const [filterState, setFilterState] = useState<OrderState | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    const columns = [
        {id: 'clientName', label: t('orders.clientName')},
        {id: 'state', label: t('orders.state')},
        {id: 'deliveryDate', label: t('orders.deliveryDate')}
    ];

    useEffect(() => {
        void fetchOrders().then((data) => {
            setOrders(data);
            setSelectedOrderId(data.length > 0 ? data[0].id : undefined);
            setInitialLoading(false);
        });
    }, [])

    const fetchOrders = async () => {
        try {
            const filters: Record<string, string> = {};

            if (filterDate !== null) {
                filters.deliveryDate = `eq:${dayjs(filterDate).format('YYYY-MM-DD')}`;
            }
            
            if (filterClientName !== null) {
                filters.clientName = `startswith:${filterClientName}`;
            }
            
            if (filterState !== null) {
                filters.state = `eq:${filterState}`;
            }

            filters.sort = `${order}:${orderBy}`;
            
            const client = new AuthorizedClient();
            return await client.fetchOrders(filters);

        } catch (e) {
            showSnackbar('orders.fetchError', 'error');
            console.error('Error fetching orders', e);
            return [];
        }
    }

    const handleRowClick = (id: string) => {
        if (selectedOrderId === id)
            return;

        updateSelectedId(id);
    };

    const updateSelectedId = (id: string) => {
        if (hasDetailChanges) {
            setPendingOrderId(id);
        } else {
            setSelectedOrderId(id);
        }
    }
    
    const handleDeleteOrder = async () => {
        await fetchOrders().then((newData) => {
            setOrders(newData);
            setSelectedOrderId(newData.length > 0 ? newData[0].id : undefined);
        })
    }

    const handleOrderCreated = async (newOrderId: string) => {
        await fetchOrders().then((data) => {
            setOrders(data);
            setSelectedOrderId(newOrderId);
            setCreateOrderDrawerVisible(false)
        });
    }

    const handleNewOrderClick = () => {
        if (selectedOrderId !== undefined && selectedOrderId !== null && hasDetailChanges) {
            setPendingOrderIdForConfirmation(null);
        } else {
            setCreateOrderDrawerVisible(true);
        }
    }

    const handleDisplayedOrderChange = async (shouldLoadNewData: boolean) => {
        if (shouldLoadNewData) {
            await fetchOrders().then((updated) => {
                setOrders(updated);

                if (pendingOrderId !== null)
                    setSelectedOrderId(pendingOrderId);
            });

        }
        setPendingOrderId(null);
    }

    const closeDrawer = () => {
        fetchOrders().then(setOrders);
        setCreateOrderDrawerVisible(false);
    }

    const ordersListCard = (
        <>
            <OrdersTableToolbar
                numSelected={table.selected.length}
                filterDate={filterDate}
                onFilterDate={(value) => {
                    setFilterDate(value ?? null);
                    table.onResetPage();
                }}
                filterClientName={filterClientName}
                onFilterClientName={setFilterClientName}
                filterState={filterState}
                onFilterState={setFilterState}
            />

            <Scrollbar>
                <TableContainer sx={{overflow: 'unset'}}>
                    <Table>
                        <SortableTableHead
                            order={table.order}
                            orderBy={table.orderBy}
                            rowCount={orders.length}
                            numSelected={table.selected.length}
                            onSort={table.onSort}
                            onSelectAllRows={(checked) =>
                                table.onSelectAllRows(
                                    checked,
                                    orders.map((orderEntity) => orderEntity.id!)
                                )
                            }
                            headLabel={columns}
                        />
                        <TableBody>
                            {orders
                                .slice(
                                    table.page * table.rowsPerPage,
                                    table.page * table.rowsPerPage + table.rowsPerPage
                                )
                                .map((row) => (
                                    <OrdersTableRow
                                        key={row.id}
                                        row={row}
                                        selected={table.selected.includes(row.id!)}
                                        onSelectRow={() => table.onSelectRow(row.id!)}
                                        onRowClick={() => handleRowClick(row.id!)}
                                        isSelected={selectedOrderId === row.id}
                                    />
                                ))}

                            <TableEmptyRows
                                height={68}
                                emptyRows={emptyRows(table.page, table.rowsPerPage, orders.length)}
                            />

                            {orders.length == 0 && <TableNoData colSpan={columns.length} />}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Scrollbar>
        </>
    );

    return (
        <>
            <SplitViewLayout
                title={t('orders.title')}
                initialLoading={initialLoading}
                newLabel={t('orders.new')}
                onNewClick={handleNewOrderClick}
                leftContent={ordersListCard}
                rightContent={<OrderDetailView
                    id={selectedOrderId}
                    shouldCheckPendingChanges={pendingOrderId !== null}
                    onDelete={handleDeleteOrder}
                    onConfirmed={handleDisplayedOrderChange}
                    onProgressbarVisibilityChange={setInitialLoading}
                    onHasChangesChange={setHasDetailChanges}
                />}
                leftContentWidth={50}
                leftContentMaxWidth={40}
                drawerContent={<CreateOrderView
                    width={850}
                    onClose={closeDrawer}
                    onSave={handleOrderCreated}
                />}
                drawerOpen={createOrderDrawerVisible}
                onDrawerClose={closeDrawer}
                drawerWidth={850}
            />
            <Dialog
                open={pendingOrderIdForConfirmation !== undefined}
                onClose={() => setPendingOrderIdForConfirmation(undefined)}
            >
                <DialogTitle>
                    {t('common.unsavedChangesLossConfirm')}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setPendingOrderIdForConfirmation(undefined)} variant="contained" color="primary">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        color="inherit"
                        onClick={() => {
                            setHasDetailChanges(false);

                            if (pendingOrderIdForConfirmation === null) {
                                setSelectedOrderId(undefined);
                            } else {
                                updateSelectedId(pendingOrderIdForConfirmation!);
                            }

                            setPendingOrderIdForConfirmation(undefined);
                        }}
                    >
                        {t('common.continue')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );}