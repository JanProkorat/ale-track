import type { BreweryProductListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useMemo, useState, forwardRef, useImperativeHandle } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import TableSortLabel from '@mui/material/TableSortLabel';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { useDeleteProduct } from 'src/hooks/useProducts';
import { useBreweryProducts } from 'src/hooks/useBreweries';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCurrency } from 'src/providers/CurrencyProvider';
import { ProductKind, ProductType } from 'src/generated/api-client';

import EmptyState from 'src/components/common/EmptyState';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import CreateProductDrawer from './CreateProductDrawer';
import UpdateProductDrawer from './UpdateProductDrawer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const kindTabs = [
     ProductKind.Keg,
     ProductKind.Bottle,
     ProductKind.Can,
     ProductKind.Multipack,
     ProductKind.Other,
];

type SortKey =
     | 'name'
     | 'platoDegree'
     | 'packageSize'
     | 'weight'
     | 'alcoholPercentage'
     | 'priceWithVat'
     | 'priceForUnitWithVat'
     | 'priceForUnitWithoutVat'
     | 'type';

type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------

export interface BreweryProductsTableHandle {
     openCreateDrawer: () => void;
}

interface BreweryProductsTableProps {
     breweryId: string;
}

const BreweryProductsTable = forwardRef<BreweryProductsTableHandle, BreweryProductsTableProps>(
function BreweryProductsTable({ breweryId }, ref) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { formatPrice } = useCurrency();
     const { data: products = [], isLoading } = useBreweryProducts(breweryId);
     const deleteMutation = useDeleteProduct();

     const [tabIndex, setTabIndex] = useState(0);
     const [search, setSearch] = useState('');
     const [page, setPage] = useState(0);
     const [rowsPerPage, setRowsPerPage] = useState(5);
     const [deleteTarget, setDeleteTarget] = useState<BreweryProductListItemDto | null>(null);
     const [sortBy, setSortBy] = useState<SortKey>('name');
     const [sortDir, setSortDir] = useState<SortDir>('asc');
     const [typeFilter, setTypeFilter] = useState<string>('');
     const [sizeFilter, setSizeFilter] = useState<string>('');
     const [drawerOpen, setDrawerOpen] = useState(false);
     const [editTarget, setEditTarget] = useState<BreweryProductListItemDto | null>(null);

     useImperativeHandle(ref, () => ({
          openCreateDrawer: () => setDrawerOpen(true),
     }), []);

     const activeKind = kindTabs[tabIndex];

     // Available product types for the current kind tab
     const availableTypes = useMemo(() => {
          const kindFiltered = products.filter((p) => {
               const kindVal = typeof p.kind === 'string' ? p.kind : p.kind;
               const kindStr = typeof p.kind === 'string' ? p.kind : undefined;
               return kindVal === activeKind || kindStr === ProductKind[activeKind];
          });
          const types = new Set<string>();
          for (const p of kindFiltered) {
               if (p.type != null) {
                    const key = typeof p.type === 'string' ? p.type : ProductType[p.type];
                    if (key) types.add(key);
               }
          }
          return [...types].sort((a, b) => {
               const la = enumLabel.productType(a as unknown as ProductType);
               const lb = enumLabel.productType(b as unknown as ProductType);
               return la.localeCompare(lb);
          });
     }, [products, activeKind, enumLabel]);

     // Available package sizes for the current kind tab
     const availableSizes = useMemo(() => {
          const kindFiltered = products.filter((p) => {
               const kindVal = typeof p.kind === 'string' ? p.kind : p.kind;
               const kindStr = typeof p.kind === 'string' ? p.kind : undefined;
               return kindVal === activeKind || kindStr === ProductKind[activeKind];
          });
          const sizes = new Set<number>();
          for (const p of kindFiltered) {
               if (p.packageSize != null) sizes.add(p.packageSize);
          }
          return [...sizes].sort((a, b) => a - b);
     }, [products, activeKind]);

     const handleSort = (key: SortKey) => {
          if (sortBy === key) {
               setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
          } else {
               setSortBy(key);
               setSortDir('asc');
          }
          setPage(0);
     };

     // Filter by kind tab and search
     const filtered = useMemo(() => {
          let result = products.filter((p) => {
               const kindVal = typeof p.kind === 'string' ? p.kind : p.kind;
               const kindStr = typeof p.kind === 'string' ? p.kind : undefined;
               return kindVal === activeKind || kindStr === ProductKind[activeKind];
          });

          if (search.trim()) {
               const q = search.trim().toLowerCase();
               result = result.filter((p) => (p.name ?? '').toLowerCase().includes(q));
          }

          if (typeFilter) {
               result = result.filter((p) => {
                    if (p.type == null) return false;
                    const key = typeof p.type === 'string' ? p.type : ProductType[p.type];
                    return key === typeFilter;
               });
          }

          if (sizeFilter) {
               const size = Number(sizeFilter);
               result = result.filter((p) => p.packageSize === size);
          }

          return result;
     }, [products, activeKind, search, typeFilter, sizeFilter]);

     // Sort
     const sorted = useMemo(() => {
          const arr = [...filtered];
          const dir = sortDir === 'asc' ? 1 : -1;

          arr.sort((a, b) => {
               let va: string | number | undefined;
               let vb: string | number | undefined;

               switch (sortBy) {
                    case 'name':
                         return dir * (a.name ?? '').localeCompare(b.name ?? '');
                    case 'type':
                         va = a.type != null ? enumLabel.productType(a.type) : '';
                         vb = b.type != null ? enumLabel.productType(b.type) : '';
                         return dir * (va as string).localeCompare(vb as string);
                    case 'platoDegree':
                         va = a.platoDegree ?? -Infinity;
                         vb = b.platoDegree ?? -Infinity;
                         break;
                    case 'packageSize':
                         va = a.packageSize ?? -Infinity;
                         vb = b.packageSize ?? -Infinity;
                         break;
                    case 'weight':
                         va = a.weight ?? -Infinity;
                         vb = b.weight ?? -Infinity;
                         break;
                    case 'alcoholPercentage':
                         va = a.alcoholPercentage ?? -Infinity;
                         vb = b.alcoholPercentage ?? -Infinity;
                         break;
                    case 'priceWithVat':
                         va = a.priceWithVat ?? -Infinity;
                         vb = b.priceWithVat ?? -Infinity;
                         break;
                    case 'priceForUnitWithVat':
                         va = a.priceForUnitWithVat ?? -Infinity;
                         vb = b.priceForUnitWithVat ?? -Infinity;
                         break;
                    case 'priceForUnitWithoutVat':
                         va = a.priceForUnitWithoutVat ?? -Infinity;
                         vb = b.priceForUnitWithoutVat ?? -Infinity;
                         break;
                    default:
                         break;
               }

               return dir * ((va as number) - (vb as number));
          });

          return arr;
     }, [filtered, sortBy, sortDir, enumLabel]);

     // Paginate
     const paginated = useMemo(
          () => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
          [sorted, page, rowsPerPage],
     );

     const handleTabChange = (_e: unknown, newValue: number) => {
          setTabIndex(newValue);
          setTypeFilter('');
          setSizeFilter('');
          setPage(0);
     };

     const handleDelete = () => {
          if (!deleteTarget?.id) return;
          deleteMutation.mutate(deleteTarget.id, {
               onSuccess: () => setDeleteTarget(null),
          });
     };

     // Sortable header helper
     const SortableCell = ({
          id,
          label,
          align,
          sticky,
     }: {
          id: SortKey;
          label: string;
          align?: 'left' | 'right';
          sticky?: 'left' | 'right';
     }) => (
          <TableCell
               align={align}
               sortDirection={sortBy === id ? sortDir : false}
               sx={{
                    whiteSpace: 'nowrap',
                    ...(sticky && {
                         position: 'sticky',
                         [sticky]: 0,
                         zIndex: 3,
                         bgcolor: 'background.neutral',
                    }),
               }}
          >
               <TableSortLabel
                    active={sortBy === id}
                    direction={sortBy === id ? sortDir : 'asc'}
                    onClick={() => handleSort(id)}
               >
                    {label}
               </TableSortLabel>
          </TableCell>
     );

     if (isLoading) return <LoadingSpinner />;

     return (
          <Box>
               {/* Kind tabs — full width */}
               <Tabs
                    value={tabIndex}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{
                         mb: 2,
                         '& .MuiTabs-flexContainer': {
                              justifyContent: 'space-between',
                         },
                         '& .MuiTab-root': {
                              flex: 1,
                         },
                         '& .MuiTabScrollButton-root.Mui-disabled': {
                              opacity: 0.3,
                         },
                    }}
               >
                    {kindTabs.map((kind) => (
                         <Tab key={kind} label={enumLabel.productKind(kind)} />
                    ))}
               </Tabs>

               {/* Filters + Add button */}
               <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center', '& > .MuiTextField-root': { width: { xs: '100%', sm: 250 } } }}>
                    <TextField
                         size="small"
                         placeholder={t('products.name')}
                         value={search}
                         onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                         slotProps={{
                              input: {
                                   startAdornment: (
                                        <InputAdornment position="start">
                                             <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                   ),
                              },
                         }}
                         sx={{ flexShrink: 0 }}
                    />
                    <TextField
                         select
                         size="small"
                         label={t('products.type')}
                         value={typeFilter}
                         onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
                         sx={{ flexShrink: 0 }}
                    >
                         <MenuItem value="">{t('common.all')}</MenuItem>
                         {availableTypes.map((typeKey) => (
                              <MenuItem key={typeKey} value={typeKey}>
                                   {enumLabel.productType(typeKey as unknown as ProductType)}
                              </MenuItem>
                         ))}
                    </TextField>
                    <TextField
                         select
                         size="small"
                         label={t('products.packageSize')}
                         value={sizeFilter}
                         onChange={(e) => { setSizeFilter(e.target.value); setPage(0); }}
                         sx={{ flexShrink: 0 }}
                    >
                         <MenuItem value="">{t('common.all')}</MenuItem>
                         {availableSizes.map((size) => (
                              <MenuItem key={size} value={String(size)}>
                                   {size} L
                              </MenuItem>
                         ))}
                    </TextField>
               </Box>

               {/* Table */}
               {sorted.length === 0 ? (
                    <EmptyState />
               ) : (
                    <>
                         <TableContainer sx={{ overflowX: 'auto' }}>
                              <Table size="medium">
                                   <TableHead>
                                        <TableRow>
                                             <SortableCell id="name" label={t('products.name')} sticky="left" />
                                             <SortableCell id="type" label={t('products.type')} />
                                             <SortableCell id="platoDegree" label={t('products.platoDegreeShort')} align="right" />
                                             <SortableCell id="packageSize" label={t('products.packageSize')} align="right" />
                                             <SortableCell id="weight" label={t('products.weight')} align="right" />
                                             <SortableCell id="alcoholPercentage" label={t('products.alcoholPercentage')} align="right" />
                                             <SortableCell id="priceWithVat" label={t('products.priceWithVat')} align="right" />
                                             <SortableCell id="priceForUnitWithVat" label={t('products.priceForUnitWithVat')} align="right" />
                                             <SortableCell id="priceForUnitWithoutVat" label={t('products.priceForUnitWithoutVat')} align="right" />
                                             <TableCell
                                                  sx={{
                                                       position: 'sticky',
                                                       right: 0,
                                                       zIndex: 3,
                                                       bgcolor: 'background.neutral',
                                                       width: 48,
                                                  }}
                                             />
                                        </TableRow>
                                   </TableHead>
                                   <TableBody>
                                        {paginated.map((product) => (
                                             <TableRow key={product.id} hover sx={{ cursor: 'pointer' }} onClick={() => setEditTarget(product)}>
                                                  <TableCell
                                                       sx={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            bgcolor: 'background.paper',
                                                            whiteSpace: 'nowrap',
                                                       }}
                                                  >
                                                       {product.name}
                                                  </TableCell>
                                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.type != null ? (
                                                            <Chip label={enumLabel.productType(product.type)} size="small" />
                                                       ) : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.platoDegree != null ? `${product.platoDegree}°` : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.packageSize != null ? `${product.packageSize} L` : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.weight != null ? `${product.weight} Kg` : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.alcoholPercentage != null ? `${product.alcoholPercentage}%` : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {formatPrice(product.priceWithVat)}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {formatPrice(product.priceForUnitWithVat)}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {formatPrice(product.priceForUnitWithoutVat)}
                                                  </TableCell>
                                                  <TableCell
                                                       sx={{
                                                            position: 'sticky',
                                                            right: 0,
                                                            zIndex: 1,
                                                            bgcolor: 'background.paper',
                                                       }}
                                                  >
                                                       <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(product); }}
                                                       >
                                                            <DeleteIcon fontSize="small" />
                                                       </IconButton>
                                                  </TableCell>
                                             </TableRow>
                                        ))}
                                   </TableBody>
                              </Table>
                         </TableContainer>

                         <TablePagination
                              component="div"
                              count={sorted.length}
                              page={page}
                              onPageChange={(_e, newPage) => setPage(newPage)}
                              rowsPerPage={rowsPerPage}
                              onRowsPerPageChange={(e) => {
                                   setRowsPerPage(parseInt(e.target.value, 10));
                                   setPage(0);
                              }}
                              rowsPerPageOptions={[5, 10, 25]}
                         />
                    </>
               )}

               {/* Delete confirmation */}
               <ConfirmDialog
                    open={Boolean(deleteTarget)}
                    title={t('confirm.deleteTitle')}
                    message={t('products.deleteConfirm', { name: deleteTarget?.name ?? '' })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleteMutation.isPending}
               />

               {/* Create product drawer */}
               <CreateProductDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    breweryId={breweryId}
               />

               {/* Update product drawer */}
               <UpdateProductDrawer
                    open={Boolean(editTarget)}
                    onClose={() => setEditTarget(null)}
                    product={editTarget}
               />
          </Box>
     );
});

export default BreweryProductsTable;
