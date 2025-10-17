import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Table } from "@mui/material";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { useTable } from "src/providers/TableProvider";

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
        {id: 'weight', label: t('products.weight')},
        {id: 'priceVat', label: t('products.priceVat')},
        {id: 'priceUnitVat', label: t('products.priceUnitVat')},
        {id: 'type', label: t('products.type')},
        {id: ''}
    ];

    const getSortedProducts = () => {
        const sorted = [...deliveryProducts].sort((a, b) => {
            const productA = products.find(p => p.id === a.productId);
            const productB = products.find(p => p.id === b.productId);

            if (!productA || !productB) return 0;

            let compareValueA: any;
            let compareValueB: any;

            // Mapování column id na property v product objektu
            switch (table.orderBy) {
                case 'name':
                    compareValueA = productA.name?.toLowerCase() || '';
                    compareValueB = productB.name?.toLowerCase() || '';
                    break;
                case 'quantity':
                    compareValueA = a.quantity || 0;
                    compareValueB = b.quantity || 0;
                    break;
                case 'kind':
                    compareValueA = productA.kind || '';
                    compareValueB = productB.kind || '';
                    break;
                case 'size':
                    compareValueA = productA.packageSize || 0;
                    compareValueB = productB.packageSize || 0;
                    break;
                case 'priceVat':
                    compareValueA = productA.priceWithVat || 0;
                    compareValueB = productB.priceWithVat || 0;
                    break;
                case 'priceUnitVat':
                    compareValueA = productA.priceForUnitWithVat || 0;
                    compareValueB = productB.priceForUnitWithVat || 0;
                    break;
                case 'type':
                    compareValueA = productA.type || '';
                    compareValueB = productB.type || '';
                    break;
                default:
                    return 0;
            }

            if (compareValueA < compareValueB) {
                return table.order === 'asc' ? -1 : 1;
            }
            if (compareValueA > compareValueB) {
                return table.order === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return sorted;
    };

    return (
        <TableContainer sx={{ mt: 2, maxWidth: '100%', overflowX: 'auto' }}>
            <Table sx={{ minWidth: 800 }}>
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
                    {getSortedProducts()
                        .map((row, index) => {
                            const product = products.find(d => d.id === row.productId);
                            const originalIndex = deliveryProducts.findIndex(p => p.productId === row.productId);
                            return product === undefined ? null :  <ProductDeliveryStopProductRow
                                disabled={disabled}
                                key={product.id}
                                row={product}
                                quantity={row.quantity}
                                onDeleteClick={() => {
                                    const updatedProducts = [...deliveryProducts];
                                    updatedProducts.splice(originalIndex, 1);
                                    onProductsChanged(updatedProducts);
                                }}
                                onQuantityChange={(quantity) => {
                                    const updatedProducts = [...deliveryProducts];
                                    const existing = updatedProducts[originalIndex];
                                    const ctor = existing instanceof UpdateProductDeliveryItemDto
                                        ? UpdateProductDeliveryItemDto
                                        : CreateProductDeliveryItemDto;

                                    updatedProducts[originalIndex] = new ctor({
                                        ...existing,
                                        quantity
                                    }) as T;
                                    onProductsChanged(updatedProducts);
                                }}
                            />
                        })}

                    {deliveryProducts.length == 0 && <TableNoData colSpan={columns.length}/>}
                </TableBody>
            </Table>
        </TableContainer>

    )
}