import {useState} from "react";
import {useTranslation} from "react-i18next";

import {Table} from "@mui/material";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { Scrollbar } from "src/components/scrollbar";

import {emptyRows} from "../../../providers/utils";
import {useTable} from "../../../providers/TableProvider";
import { OrderItemTableRow } from "./order-item-table-row";
import {TableNoData} from "../../../components/table/table-no-data";
import {TableEmptyRows} from "../../../components/table/table-empty-rows";
import {CreateOrderItemDto, UpdateOrderItemDto} from "../../../api/Client";
import {SortableTableHead} from "../../../components/table/sortable-table-head";

import type { ProductListItemDto} from "../../../api/Client";

type AllowedItem = CreateOrderItemDto | UpdateOrderItemDto;

type OrderItemsTableProps<T extends AllowedItem> = {
    orderProducts: T[],
    products: ProductListItemDto[],
    onProductsChanged: (products: T[]) => void,
    disabled?: boolean,
}

export function OrderItemsTable<T extends AllowedItem>({orderProducts, products, onProductsChanged, disabled}: Readonly<OrderItemsTableProps<T>>) {
    const {t} = useTranslation();

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');
    const table = useTable({order, setOrder, orderBy, setOrderBy});

    const columns = [
        {id: 'name', label: t('products.name')},
        {id: 'quantity', label: t('productDeliveries.quantity')},
        {id: 'kind', label: t('products.kind')},
        {id: 'size', label: t('products.packageSize')},
        {id: 'priceVat', label: t('products.priceVat')},
        {id: 'priceUnitVat', label: t('products.priceUnitVat')},
        {id: 'type', label: t('products.type')},
        {id: ''}
    ];

    return (
        <Scrollbar>
            <TableContainer sx={{overflow: 'unset'}}>
                <Table>
                    <SortableTableHead
                        order={table.order}
                        orderBy={table.orderBy}
                        rowCount={products.length}
                        numSelected={table.selected.length}
                        onSort={table.onSort}
                        onSelectAllRows={(checked) =>
                            table.onSelectAllRows(
                                checked,
                                (orderProducts.map((product) => product.productId!))
                            )
                        }
                        headLabel={columns}
                        checkboxVisible
                    />
                    <TableBody>
                        {orderProducts
                            .slice(
                                table.page * table.rowsPerPage,
                                table.page * table.rowsPerPage + table.rowsPerPage
                            )
                            .map((row, index) => {
                                const product = products.find(d => d.id === row.productId);
                                return product === undefined ? null :  <OrderItemTableRow
                                    disabled={disabled}
                                    key={product.id}
                                    row={product}
                                    quantity={row.quantity}
                                    onDeleteClick={() => {
                                        const updatedProducts = [...orderProducts];
                                        updatedProducts.splice(index, 1);
                                        onProductsChanged(updatedProducts);
                                    }}
                                    onQuantityChange={(quantity: number | undefined) => {
                                        const updatedProducts = [...orderProducts];
                                        const existing = updatedProducts[index];
                                        const ctor = existing instanceof UpdateOrderItemDto
                                            ? UpdateOrderItemDto
                                            : CreateOrderItemDto;

                                        updatedProducts[index] = new ctor({
                                            ...existing,
                                            quantity
                                        }) as T;
                                        onProductsChanged(updatedProducts);
                                    }}
                                />
                            })}

                        <TableEmptyRows
                            height={68}
                            emptyRows={emptyRows(table.page, table.rowsPerPage, orderProducts.length)}
                        />

                        {orderProducts.length == 0 && <TableNoData colSpan={columns.length}/>}
                    </TableBody>
                </Table>
            </TableContainer>
        </Scrollbar>
    )
}