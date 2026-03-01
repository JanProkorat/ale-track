import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import { Tab, Tabs } from '@mui/material';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { useAuthorizedClient } from 'src/api/use-authorized-client';

import { emptyRows } from '../../../providers/utils';
import { Iconify } from '../../../components/iconify';
import { ProductsTableRow } from '../products-table-row';
import { useApiCall } from '../../../hooks/use-api-call';
import { Scrollbar } from '../../../components/scrollbar';
import { useTable } from '../../../providers/TableProvider';
import { ProductsTableToolbar } from '../products-table-toolbar';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { TableNoData } from '../../../components/table/table-no-data';
import { ProductDetailView } from '../detail-view/product-detail-view';
import { SectionHeader } from '../../../components/label/section-header';
import { TableEmptyRows } from '../../../components/table/table-empty-rows';
import { SortableTableHead } from '../../../components/table/sortable-table-head';
import { DeleteConfirmationDialog } from '../../../components/dialogs/delete-confirmation-dialog';

import type { ProductType, BreweryProductListItemDto } from '../../../api/Client';

type ProductsViewProps = {
     breweryId: string;
};

export function ProductsView({ breweryId }: Readonly<ProductsViewProps>) {
     const client = useAuthorizedClient();
     const { t } = useTranslation();
     const { showSnackbar } = useSnackbar();
     const { executeApiCall, executeApiCallWithDefault } = useApiCall();

     const [productKinds, setProductKinds] = useState<string[]>([]);
     const [products, setProducts] = useState<BreweryProductListItemDto[]>([]);
     const [productIdToDelete, setProductIdToDelete] = useState<string | null>(null);
     const [selectedProductId, setSelectedProductId] = useState<string | null | undefined>(undefined);

     const [filterName, setFilterName] = useState<string>('');
     const [filterKind, setFilterKind] = useState<string>('Keg');
     const [filterType, setFilterType] = useState<ProductType | undefined>(undefined);

     const [order, setOrder] = useState<'asc' | 'desc'>('asc');
     const [orderBy, setOrderBy] = useState<string>('name');

     const table = useTable({ order, setOrder, orderBy, setOrderBy });

     const fetchProducts = useCallback(async () => {
          const filters: Record<string, string> = {};

          filters.kind = `eq:${filterKind}`;
          if (filterName) filters.name = `startswith:${filterName}`;
          filters.sort = `${order}:${orderBy}`;

          await executeApiCallWithDefault(() => client.getProductKindListEndpoint(), []).then((result) =>
               setProductKinds(result)
          );
          const response = await executeApiCallWithDefault(() => client.fetchBreweryProducts(breweryId, filters), []);
          setProducts(response);
     }, [breweryId, client, executeApiCallWithDefault, filterKind, filterName, order, orderBy]);

     useEffect(() => {
          void fetchProducts();
     }, [fetchProducts]);

     const handleDeleteProduct = async () => {
          if (productIdToDelete) {
               const result = await executeApiCall(() => client.deleteProductEndpoint(productIdToDelete));
               if (result) {
                    showSnackbar(t('product.deleteSuccess'), 'success');
                    setProductIdToDelete(null);
                    void fetchProducts();
               }
          }
     };

     const handleSelectRow = useCallback((id: string) => table.onSelectRow(id), [table]);
     const handleRowClick = useCallback((id: string) => setSelectedProductId(id), []);
     const handleDeleteClick = useCallback((id: string) => setProductIdToDelete(id), []);

     const closeDrawer = (shouldReloadData: boolean) => {
          setSelectedProductId(undefined);
          if (shouldReloadData) void fetchProducts();
     };

     const notFound = !products.length;
     const columns = [
          { id: 'name', label: t('products.name') },
          { id: 'platoDegree', label: t('products.platoDegree') },
          { id: 'kind', label: t('products.kind') },
          { id: 'size', label: t('products.packageSize') },
          { id: 'weight', label: t('products.weight') },
          { id: 'alcoholPercentage', label: t('products.alcoholPercentage') },
          { id: 'priceVat', label: t('products.priceVat') },
          { id: 'priceUnitVat', label: t('products.priceUnitVat') },
          { id: 'priceUnitNoVat', label: t('products.priceUnitNoVat') },
          { id: 'type', label: t('products.type') },
          { id: '' },
     ];

     return (
          <Box>
               {/* Nadpis a tlačítko */}
               <SectionHeader text={t('products.title')} sx={{ mb: 2 }}>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<Iconify icon="mingcute:add-line" />}
                         size="small"
                         sx={{ mb: 1 }}
                         onClick={() => setSelectedProductId(null)}
                    >
                         {t('products.new')}
                    </Button>
               </SectionHeader>

               <Tabs
                    value={filterKind}
                    onChange={(_, newValue) => setFilterKind(newValue)}
                    textColor="secondary"
                    indicatorColor="secondary"
                    variant="fullWidth"
               >
                    {productKinds.map((kind) => (
                         <Tab key={kind} value={kind} label={t('productKind.' + kind)} />
                    ))}
               </Tabs>

               <ProductsTableToolbar
                    numSelected={table.selected.length}
                    filterName={filterName}
                    onFilterName={(event: React.ChangeEvent<HTMLInputElement>) => {
                         setFilterName(event.target.value);
                         table.onResetPage();
                    }}
                    filterType={filterType}
                    onFilterType={setFilterType}
               />

               <Scrollbar sx={{ maxHeight: 1000, overflow: 'auto', mb: 2 }}>
                    <TableContainer sx={{ overflow: 'unset' }}>
                         <Table stickyHeader>
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
                                   checkboxVisible
                                   checkboxSticky
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
                                                  onSelectRow={handleSelectRow}
                                                  onRowClick={handleRowClick}
                                                  onDeleteClick={handleDeleteClick}
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
                    rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    onRowsPerPageChange={table.onChangeRowsPerPage}
                    labelRowsPerPage={t('table.rowsPerPage')}
               />

               <Drawer
                    anchor="right"
                    open={selectedProductId !== undefined}
                    onClose={() => setSelectedProductId(undefined)}
               >
                    <Box sx={{ width: { xs: '100vw', md: 700 }, p: 2 }}>
                         <ProductDetailView id={selectedProductId!} breweryId={breweryId} onClose={closeDrawer} />
                    </Box>
               </Drawer>

               <DeleteConfirmationDialog
                    open={productIdToDelete !== null}
                    onClose={() => setProductIdToDelete(null)}
                    onDelete={handleDeleteProduct}
                    deleteConfirmMessage={t('products.deleteConfirm')}
                    cancelLabel={t('common.cancel')}
                    deleteLabel={t('common.delete')}
               />
          </Box>
     );
}
