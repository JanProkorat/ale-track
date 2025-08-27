import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import TableBody from "@mui/material/TableBody";
import Typography from "@mui/material/Typography";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import {Dialog, DialogTitle, DialogActions} from "@mui/material";

import {emptyRows} from "../../../providers/utils";
import {Iconify} from "../../../components/iconify";
import {ProductsTableRow} from "../products-table-row";
import {Scrollbar} from "../../../components/scrollbar";
import {useTable} from "../../../providers/TableProvider";
import {ProductsTableToolbar} from "../products-table-toolbar";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {TableNoData} from "../../../components/table/table-no-data";
import {ProductDetailView} from "../detail-view/product-detail-view";
import {TableEmptyRows} from "../../../components/table/table-empty-rows";
import {SortableTableHead} from "../../../components/table/sortable-table-head";

import type {BreweryProductListItemDto} from "../../../api/Client";

type ProductsViewProps = {
    breweryId: string
};

export function ProductsView({ breweryId }: Readonly<ProductsViewProps>) {
    const {t} = useTranslation();
    const { showSnackbar } = useSnackbar();

    const [products, setProducts] = useState<BreweryProductListItemDto[]>([]);
    const [productIdToDelete, setProductIdToDelete] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null | undefined>(undefined);

    const [filterName, setFilterName] = useState<string>('');

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('name');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    useEffect(() => {
        void fetchProducts();
    }, [filterName, breweryId, order, orderBy]);

    const fetchProducts = async () => {
        try {
            const client = new AuthorizedClient();
            const filters: Record<string, string> = {};

            if (filterName) filters.name = `startswith:${filterName}`;
            filters.sort = `${order}:${orderBy}`;

            const response = await client.fetchBreweryProducts(breweryId, filters);
            setProducts(response);
        } catch (error) {
            showSnackbar('Error fetching products', 'error');
            console.error('Error fetching products:', error);
        }
    };

    const handleDeleteProduct = async () => {
        if (productIdToDelete) {
            try {
                const client = new AuthorizedClient();
                await client.deleteProductEndpoint(productIdToDelete);
                showSnackbar(t('product.deleteSuccess'), 'success');
            } catch (e) {
                showSnackbar(t('product.deleteError'), 'error');
                console.error('Error deleting product', e);
            } finally {
                setProductIdToDelete(null);
                void fetchProducts();
            }
        }
    }

    const closeDrawer = (shouldReloadData: boolean) => {
        setSelectedProductId(undefined);
        if (shouldReloadData)
            void fetchProducts();
    }
    
    const notFound = !products.length;
    const columns = [
        {id: 'name', label: t('products.name')},
        {id: 'platoDegree', label: t('products.platoDegree')},
        {id: 'kind', label: t('products.kind')},
        {id: 'size', label: t('products.packageSize')},
        {id: 'alcoholPercentage', label: t('products.alcoholPercentage')},
        {id: 'priceVat', label: t('products.priceVat')},
        {id: 'priceUnitVat', label: t('products.priceUnitVat')},
        {id: 'priceUnitNoVat', label: t('products.priceUnitNoVat')},
        {id: 'type', label: t('products.type')},
        {id: ''}
    ];

    return (
        <Box >
            {/* Nadpis a tlačítko */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {t('products.title')}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line" />}
                    size="small"
                    sx={{mb:1}}
                    onClick={() => setSelectedProductId(null)}
                >
                    {t('products.new')}
                </Button>
            </Box>

            <ProductsTableToolbar
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
                            rowCount={products.length}
                            numSelected={table.selected.length}
                            onSort={table.onSort}
                            onSelectAllRows={(checked) =>
                                table.onSelectAllRows(
                                    checked,
                                    products.map((product) => product.id!)
                                )
                            }
                            headLabel={columns}
                        />
                        <TableBody>
                            {products
                                .slice(
                                    table.page * table.rowsPerPage,
                                    table.page * table.rowsPerPage + table.rowsPerPage
                                )
                                .map((row) => (
                                    <ProductsTableRow
                                        key={row.id}
                                        row={row}
                                        selected={table.selected.includes(row.id!)}
                                        onSelectRow={() => table.onSelectRow(row.id!)}
                                        onRowClick={() => setSelectedProductId(row.id!)}
                                        onDeleteClick={() => setProductIdToDelete(row.id!)}
                                    />
                                ))}

                            <TableEmptyRows
                                height={68}
                                emptyRows={emptyRows(table.page, table.rowsPerPage, products.length)}
                            />

                            {notFound && <TableNoData colSpan={columns.length} />}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Scrollbar>

            <TablePagination
                component="div"
                page={table.page}
                count={products.length}
                rowsPerPage={table.rowsPerPage}
                onPageChange={table.onChangePage}
                rowsPerPageOptions={[5, 10, 25]}
                onRowsPerPageChange={table.onChangeRowsPerPage}
                labelRowsPerPage={t('table.rowsPerPage')}
            />

            <Drawer
                anchor="right"
                open={selectedProductId !== undefined}
                onClose={() => setSelectedProductId(undefined)}
            >
                <Box sx={{width: 700, p: 2}}>
                    <ProductDetailView id={selectedProductId!} breweryId={breweryId} onClose={closeDrawer}/>
                </Box>
            </Drawer>

            <Dialog
                open={productIdToDelete != null}
                onClose={() => setProductIdToDelete(null)}
            >
                <DialogTitle>
                    {t('products.deleteConfirm')}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setProductIdToDelete(null)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteProduct}
                    >
                        {t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}