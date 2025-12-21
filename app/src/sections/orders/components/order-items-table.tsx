import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Table } from '@mui/material';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import { Scrollbar } from 'src/components/scrollbar';

import { emptyRows } from '../../../providers/utils';
import { OrderItemTableRow } from './order-item-table-row';
import { useTable } from '../../../providers/TableProvider';
import { TableNoData } from '../../../components/table/table-no-data';
import { TableEmptyRows } from '../../../components/table/table-empty-rows';
import { SortableTableHead } from '../../../components/table/sortable-table-head';
import {
  CreateOrderItemDto,
  UpdateOrderItemDto,
} from '../../../api/Client';

import type { ProductListItemDto, GroupedProductHistoryDto } from '../../../api/Client';

type AllowedItem = CreateOrderItemDto | UpdateOrderItemDto;

type OrderItemsTableProps<T extends AllowedItem> = {
  orderProducts: T[];
  products: GroupedProductHistoryDto;
  onProductsChanged: (products: T[]) => void;
  disabled?: boolean;
};

export function OrderItemsTable<T extends AllowedItem>({
  orderProducts,
  products,
  onProductsChanged,
  disabled,
}: Readonly<OrderItemsTableProps<T>>) {
  const { t } = useTranslation();

  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string>('name');
  const table = useTable({ order, setOrder, orderBy, setOrderBy });

  const allProducts: ProductListItemDto[] = [
    ...(products.recent ?? []),
    ...(products.breweries ?? [])
      .flatMap((b) => b.kinds ?? [])
      .flatMap((k) => k.packageSizes ?? [])
      .flatMap((g) => g.items ?? []),
  ];

  const columns = [
    { id: 'name', label: t('products.name') },
    { id: 'quantity', label: t('productDeliveries.quantity') },
    { id: 'kind', label: t('products.kind') },
    { id: 'size', label: t('products.packageSize') },
    { id: 'weight', label: t('products.weight') },
    { id: 'priceVat', label: t('products.priceVat') },
    { id: 'priceUnitVat', label: t('products.priceUnitVat') },
    { id: 'type', label: t('products.type') },
    { id: '' },
  ];

  return (
    <Scrollbar sx={{ overflow: 'auto', mb: 2 }}>
      <TableContainer sx={{ overflow: 'unset' }}>
        <Table>
          <SortableTableHead
            order={table.order}
            orderBy={table.orderBy}
            rowCount={orderProducts.length}
            numSelected={table.selected.length}
            onSort={table.onSort}
            onSelectAllRows={(checked) =>
              table.onSelectAllRows(
                checked,
                orderProducts.map((product) => product.productId!)
              )
            }
            headLabel={columns}
            checkboxVisible
            checkboxSticky
          />
          <TableBody>
            {orderProducts
              .slice(
                table.page * table.rowsPerPage,
                table.page * table.rowsPerPage + table.rowsPerPage
              )
              .map((row, index) => {
                const product = allProducts.find((d) => d.id === row.productId);
                return product === undefined ? null : (
                  <OrderItemTableRow
                    disabled={disabled}
                    key={product.id}
                    row={product}
                    quantity={row.quantity}
                    reminderState={row.reminderState!}
                    onDeleteClick={() => {
                      const updatedProducts = [...orderProducts];
                      updatedProducts.splice(index, 1);
                      onProductsChanged(updatedProducts);
                    }}
                    onQuantityChange={(quantity: number | undefined) => {
                      const updatedProducts = [...orderProducts];
                      const existing = updatedProducts[index];
                      const ctor =
                        existing instanceof UpdateOrderItemDto
                          ? UpdateOrderItemDto
                          : CreateOrderItemDto;

                      updatedProducts[index] = new ctor({
                        ...existing,
                        quantity,
                      }) as T;
                      onProductsChanged(updatedProducts);
                    }}
                    onReminderStateChanged={(newState) => {
                      const updatedProducts = [...orderProducts];
                      const existing = updatedProducts[index];
                      const ctor =
                        existing instanceof UpdateOrderItemDto
                          ? UpdateOrderItemDto
                          : CreateOrderItemDto;

                      updatedProducts[index] = new ctor({
                        ...existing,
                        reminderState: newState == null ? undefined : newState,
                      }) as T;
                      onProductsChanged(updatedProducts);
                    }}
                  />
                );
              })}

            <TableEmptyRows
              height={68}
              emptyRows={emptyRows(table.page, table.rowsPerPage, orderProducts.length)}
            />

            {orderProducts.length === 0 && <TableNoData colSpan={columns.length} />}
          </TableBody>
        </Table>
      </TableContainer>
    </Scrollbar>
  );
}