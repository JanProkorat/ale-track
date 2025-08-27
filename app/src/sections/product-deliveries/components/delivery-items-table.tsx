import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Table } from "@mui/material";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { useTable } from "src/providers/TableProvider";

import { TableEmptyRows } from "src/components/table/table-empty-rows";

import {emptyRows} from "../../../providers/utils";
import {TableNoData} from "../../../components/table/table-no-data";
import {SortableTableHead} from "../../../components/table/sortable-table-head";
import { CreateProductDeliveryItemDto, UpdateProductDeliveryItemDto} from "../../../api/Client";
import { ProductDeliveryStopProductRow } from "../detail-view/product-delivery-stop-product-row";

import type {BreweryProductListItemDto} from "../../../api/Client";

type AllowedItem = CreateProductDeliveryItemDto | UpdateProductDeliveryItemDto;

type DeliveryItemsTableProps<T extends AllowedItem> = {
    deliveryProducts: T[],
    products: BreweryProductListItemDto[],
    onProductsChanged: (products: T[]) => void,
    disabled?: boolean,
}

export function DeliveryItemsTable<T extends AllowedItem>({deliveryProducts, products, onProductsChanged, disabled}: Readonly<DeliveryItemsTableProps<T>>) {
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
        <TableContainer sx={{overflow: 'unset', mt: 2}}>
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
                            (deliveryProducts.map((product) => product.productId!))
                        )
                    }
                    headLabel={columns}
                    checkboxVisible
                />
                <TableBody>
                    {deliveryProducts
                        .slice(
                            table.page * table.rowsPerPage,
                            table.page * table.rowsPerPage + table.rowsPerPage
                        )
                        .map((row, index) => {
                            const product = products.find(d => d.id === row.productId);
                            return product === undefined ? null :  <ProductDeliveryStopProductRow
                                disabled={disabled}
                                key={product.id}
                                row={product}
                                quantity={row.quantity}
                                onDeleteClick={() => {
                                    const updatedProducts = [...deliveryProducts];
                                    updatedProducts.splice(index, 1);
                                    onProductsChanged(updatedProducts);
                                }}
                                onQuantityChange={(quantity) => {
                                    const updatedProducts = [...deliveryProducts];
                                    const existing = updatedProducts[index];
                                    const ctor = existing instanceof UpdateProductDeliveryItemDto
                                        ? UpdateProductDeliveryItemDto
                                        : CreateProductDeliveryItemDto;

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
                        emptyRows={emptyRows(table.page, table.rowsPerPage, deliveryProducts.length)}
                    />

                    {deliveryProducts.length == 0 && <TableNoData colSpan={columns.length}/>}
                </TableBody>
            </Table>
        </TableContainer>

    )
}