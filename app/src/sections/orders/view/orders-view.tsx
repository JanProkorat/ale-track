import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import TableBody from '@mui/material/TableBody';
import { Table, Button, Dialog, DialogTitle, DialogActions, TableContainer } from '@mui/material';

import { useApiCall } from 'src/hooks/use-api-call';
import { useAuthorizedClient } from 'src/api/use-authorized-client';

import { TableNoData } from 'src/components/table/table-no-data';
import { TableEmptyRows } from 'src/components/table/table-empty-rows';

import { PlanningState } from '../../../api/Client';
import { OrdersTableRow } from '../orders-table-row';
import { emptyRows } from '../../../providers/utils';
import { Scrollbar } from '../../../components/scrollbar';
import { useTable } from '../../../providers/TableProvider';
import { OrdersTableToolbar } from '../orders-table-toolbar';
import { OrderDetailView } from '../detail-view/order-detail-view';
import { CreateOrderView } from '../detail-view/create-order-view';
import { PlanningStateTab } from '../components/planning-state-tab';
import { SplitViewLayout } from '../../../layouts/dashboard/split-view-layout';
import { SortableTableHead } from '../../../components/table/sortable-table-head';

import type { OrderListItemDto } from '../../../api/Client';

export function OrdersView() {
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();
  const { executeApiCallWithDefault } = useApiCall();
  const client = useAuthorizedClient();

  const [orders, setOrders] = useState<OrderListItemDto[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined);
  const [createOrderDrawerVisible, setCreateOrderDrawerVisible] = useState<boolean>(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingOrderIdForConfirmation, setPendingOrderIdForConfirmation] = useState<
    string | null | undefined
  >(undefined);
  const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);

  const [filterClientName, setFilterClientName] = useState<string | null>(null);
  const [filterPlanningState, setFilterPlanningState] = useState<PlanningState>(PlanningState.Active);

  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string>('name');

  const table = useTable({ order, setOrder, orderBy, setOrderBy });

  const columns = [
    { id: 'clientName', label: t('orders.clientName') },
    { id: 'deliveryDate', label: t('orders.requiredDeliveryDate') },
  ];

  const fetchOrders = useCallback(async () => {
    const filters: Record<string, string> = {};

    filters.planningState = `startswith:${PlanningState[filterPlanningState as unknown as keyof typeof PlanningState]}`;

    if (filterClientName !== null) {
      filters.clientName = `startswith:${filterClientName}`;
    }

    filters.sort = `${order}:${orderBy}`;

    return await executeApiCallWithDefault(() => client.fetchOrders(filters), []);
  }, [executeApiCallWithDefault, filterClientName, filterPlanningState, order, orderBy]);

  useEffect(() => {
    void fetchOrders().then((data) => {
      setOrders(data);
      if (data.length > 0) {
        if (orderId) {
          const exists = data.some((c) => c.id === orderId);
          if (exists) {
            setSelectedOrderId(orderId);
          } else {
            const firstId = data[0].id!;
            setSelectedOrderId(firstId);
            navigate(`/orders/${firstId}`, { replace: true });
          }
        } else {
          const firstId = data[0].id!;
          setSelectedOrderId(firstId);
          navigate(`/orders/${firstId}`, { replace: true });
        }
      } else {
        setSelectedOrderId(undefined);
      }
      setInitialLoading(false);
    });
  }, [fetchOrders, navigate, orderId]);

  const handleRowClick = useCallback((id: string) => {
    if (selectedOrderId === id) return;
    if (hasDetailChanges) {
      setPendingOrderId(id);
    } else {
      setSelectedOrderId(id);
      navigate(`/orders/${id}`);
    }
  }, [selectedOrderId, hasDetailChanges, navigate]);

  const handleSelectRow = useCallback((id: string) => table.onSelectRow(id), [table]);

  const updateSelectedId = (id: string) => {
    if (hasDetailChanges) {
      setPendingOrderId(id);
    } else {
      setSelectedOrderId(id);
      navigate(`/orders/${id}`);

    }
  };

  const handleDeleteOrder = async () => {
    await fetchOrders().then((newData) => {
      setOrders(newData);
      setSelectedOrderId(newData.length > 0 ? newData[0].id : undefined);
    });
  };

  const handleOrderCreated = async (newOrderId: string) => {
    await fetchOrders().then((data) => {
      setOrders(data);
      setSelectedOrderId(newOrderId);
      setCreateOrderDrawerVisible(false);
    });
  };

  const handleNewOrderClick = () => {
    if (selectedOrderId !== undefined && selectedOrderId !== null && hasDetailChanges) {
      setPendingOrderIdForConfirmation(null);
    } else {
      setCreateOrderDrawerVisible(true);
    }
  };

  const handleDisplayedOrderChange = async (shouldLoadNewData: boolean) => {
    if (shouldLoadNewData) {
      await fetchOrders().then((updated) => {
        setOrders(updated);

        if (pendingOrderId !== null) setSelectedOrderId(pendingOrderId);
      });
    }
    setPendingOrderId(null);
  };

  const closeDrawer = () => {
    fetchOrders().then(setOrders);
    setCreateOrderDrawerVisible(false);
  };

  const ordersListCard = (
    <>
      <OrdersTableToolbar
        numSelected={table.selected.length}
        filterClientName={filterClientName}
        onFilterClientName={setFilterClientName}
      />
      <PlanningStateTab onPlanningStateChange={setFilterPlanningState} />
      <Scrollbar>
        <TableContainer sx={{ overflow: 'unset' }}>
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
                    onSelectRow={handleSelectRow}
                    onRowClick={handleRowClick}
                    isSelected={selectedOrderId === row.id}
                  />
                ))}

              <TableEmptyRows
                height={68}
                emptyRows={emptyRows(table.page, table.rowsPerPage, orders.length)}
              />

              {orders.length === 0 && <TableNoData colSpan={columns.length} />}
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
        rightContent={
          <OrderDetailView
            id={selectedOrderId}
            shouldCheckPendingChanges={pendingOrderId !== null}
            onDelete={handleDeleteOrder}
            onConfirmed={handleDisplayedOrderChange}
            onProgressbarVisibilityChange={setInitialLoading}
            onHasChangesChange={setHasDetailChanges}
          />
        }
        leftContentWidth={35}
        leftContentMaxWidth={35}
        drawerContent={
          <CreateOrderView width={1100} onClose={closeDrawer} onSave={handleOrderCreated} />
        }
        drawerOpen={createOrderDrawerVisible}
        onDrawerClose={closeDrawer}
        drawerWidth={1100}
      />
      <Dialog
        open={pendingOrderIdForConfirmation !== undefined}
        onClose={() => setPendingOrderIdForConfirmation(undefined)}
      >
        <DialogTitle>{t('common.unsavedChangesLossConfirm')}</DialogTitle>
        <DialogActions>
          <Button
            onClick={() => setPendingOrderIdForConfirmation(undefined)}
            variant="contained"
            color="primary"
          >
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
  );
}
