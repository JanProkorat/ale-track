# Inventory Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an inventory page with brewery tabs, items table, and drawers for creating/editing/deleting inventory items.

**Architecture:** Single page (`InventoryPage`) fetches `InventorySectionDto[]` (sections = breweries). Brewery tabs filter which section's items display in the table. A shared `InventoryItemDrawer` handles both create (global add, user picks product) and edit (product preselected) flows. Delete uses `ConfirmDialog`.

**Tech Stack:** React, MUI, react-hook-form, @tanstack/react-query, Zod, react-i18next

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/useInventory.ts` | Query + mutations for inventory endpoints |
| Create | `src/pages/inventory/InventoryPage.tsx` | Main page: brewery tabs + items table + drawers |
| Create | `src/pages/inventory/components/InventoryItemDrawer.tsx` | Shared drawer for create & edit flows |
| Modify | `src/App.tsx:130` | Replace placeholder route with real page |

---

### Task 1: Create `useInventory` hook

**Files:**
- Create: `src/hooks/useInventory.ts`

- [ ] **Step 1: Create the hook file**

Follow the `useDrivers.ts` pattern exactly. Query keys, list query, detail query, create/update/delete mutations.

```ts
import type { CreateInventoryItemDto, UpdateInventoryItemDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const INVENTORY_KEY = 'inventory';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useInventoryItems() {
     return useQuery({
          queryKey: [INVENTORY_KEY],
          queryFn: ({ signal }) => apiClient.getInventoryItemsListEndpoint({}, signal),
     });
}

export function useInventoryItem(id: string) {
     return useQuery({
          queryKey: [INVENTORY_KEY, id],
          queryFn: ({ signal }) => apiClient.getInventoryItemDetailEndpoint(id, signal),
          enabled: !!id,
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateInventoryItem() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateInventoryItemDto) => apiClient.createInventoryItemEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] });
               notifyCreate('inventory');
          },
          onError: () => {
               notifyCreateError('inventory');
          },
     });
}

export function useUpdateInventoryItem() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemDto }) =>
               apiClient.updateInventoryItemEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] });
               notifyUpdate('inventory');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteInventoryItem() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteInventoryItemEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] });
               notifyDelete('inventory');
          },
          onError: () => {
               notifyDeleteError('inventory');
          },
     });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn build:check 2>&1 | tail -5`
Expected: no errors related to useInventory

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useInventory.ts
git commit -m "feat(inventory): add useInventory hook with CRUD operations"
```

---

### Task 2: Create `InventoryItemDrawer` component

**Files:**
- Create: `src/pages/inventory/components/InventoryItemDrawer.tsx`

- [ ] **Step 1: Create the drawer component**

Dual-mode drawer (create vs edit). Props:
- `open: boolean`
- `onClose: () => void`
- `mode: 'create' | 'edit'`
- `editItem?: { id: string; productId?: string; name?: string; quantity: number; note?: string }` — preloaded for edit mode
- `onSuccess: () => void`

Create mode: Autocomplete for product selection (loads products via `useProducts`), quantity field, note field.
Edit mode: Product display (read-only), quantity field, note field.

Both call `CreateInventoryItemDto` / `UpdateInventoryItemDto` respectively.

```tsx
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';

import { useProducts } from 'src/hooks/useProducts';
import { useCreateInventoryItem, useUpdateInventoryItem } from 'src/hooks/useInventory';

import { CreateInventoryItemDto, UpdateInventoryItemDto } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryFormValues {
     productId: string;
     productLabel: string;
     quantity: number | '';
     note: string;
}

interface EditItemData {
     id: string;
     productId?: string;
     name?: string;
     quantity: number;
     note?: string;
}

interface InventoryItemDrawerProps {
     open: boolean;
     onClose: () => void;
     mode: 'create' | 'edit';
     editItem?: EditItemData;
     onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const defaultValues: InventoryFormValues = {
     productId: '',
     productLabel: '',
     quantity: '',
     note: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryItemDrawer({ open, onClose, mode, editItem, onSuccess }: InventoryItemDrawerProps) {
     const { t } = useTranslation();
     const { data: products = [] } = useProducts();
     const createMutation = useCreateInventoryItem();
     const updateMutation = useUpdateInventoryItem();

     const {
          control,
          handleSubmit,
          reset,
          formState: { errors },
     } = useForm<InventoryFormValues>({ defaultValues });

     // Reset form when drawer opens
     useEffect(() => {
          if (!open) return;
          if (mode === 'edit' && editItem) {
               reset({
                    productId: editItem.productId ?? '',
                    productLabel: editItem.name ?? '',
                    quantity: editItem.quantity,
                    note: editItem.note ?? '',
               });
          } else {
               reset(defaultValues);
          }
     }, [open, mode, editItem, reset]);

     const onSubmit = (data: InventoryFormValues) => {
          if (mode === 'create') {
               const dto = new CreateInventoryItemDto();
               dto.productId = data.productId || undefined;
               dto.quantity = Number(data.quantity);
               dto.note = data.note || undefined;
               createMutation.mutate(dto, {
                    onSuccess: () => {
                         onSuccess();
                         onClose();
                    },
               });
          } else if (editItem) {
               const dto = new UpdateInventoryItemDto();
               dto.productId = data.productId || undefined;
               dto.quantity = Number(data.quantity);
               dto.note = data.note || undefined;
               updateMutation.mutate(
                    { id: editItem.id, data: dto },
                    {
                         onSuccess: () => {
                              onSuccess();
                              onClose();
                         },
                    },
               );
          }
     };

     const isPending = createMutation.isPending || updateMutation.isPending;

     const selectedProduct = products.find((p) => p.id === control._formValues.productId) ?? null;

     return (
          <Drawer
               anchor="right"
               open={open}
               onClose={onClose}
               slotProps={{
                    paper: { sx: { width: { xs: '100%', sm: 400 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {mode === 'create' ? t('inventory.addItem') : t('inventory.editItem')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         {/* Product selector — only in create mode */}
                         {mode === 'create' ? (
                              <Controller
                                   name="productId"
                                   control={control}
                                   rules={{ required: true }}
                                   render={({ field }) => (
                                        <Autocomplete
                                             options={products}
                                             getOptionLabel={(opt) => opt.name ?? ''}
                                             value={products.find((p) => p.id === field.value) ?? null}
                                             onChange={(_e, newValue) => field.onChange(newValue?.id ?? '')}
                                             isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                             renderInput={(params) => (
                                                  <TextField
                                                       {...params}
                                                       label={t('products.title')}
                                                       size="small"
                                                       required
                                                       error={!!errors.productId}
                                                  />
                                             )}
                                        />
                                   )}
                              />
                         ) : (
                              <TextField
                                   label={t('products.title')}
                                   value={editItem?.name ?? ''}
                                   size="small"
                                   disabled
                              />
                         )}

                         {/* Quantity */}
                         <Controller
                              name="quantity"
                              control={control}
                              rules={{ required: true, min: 1 }}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                                        label={t('inventory.quantity')}
                                        type="number"
                                        size="small"
                                        required
                                        error={!!errors.quantity}
                                   />
                              )}
                         />

                         {/* Note */}
                         <Controller
                              name="note"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('inventory.note')}
                                        size="small"
                                        multiline
                                        rows={3}
                                   />
                              )}
                         />
                    </Stack>

                    <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                         <Button variant="outlined" onClick={onClose}>
                              {t('common.cancel')}
                         </Button>
                         <LoadingButton type="submit" variant="contained" loading={isPending}>
                              {t('common.save')}
                         </LoadingButton>
                    </Stack>
               </Box>
          </Drawer>
     );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn build:check 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/pages/inventory/components/InventoryItemDrawer.tsx
git commit -m "feat(inventory): add InventoryItemDrawer for create/edit flows"
```

---

### Task 3: Create `InventoryPage`

**Files:**
- Create: `src/pages/inventory/InventoryPage.tsx`

- [ ] **Step 1: Create the main page component**

Structure:
1. `SectionCard` with title + global add button in `action` slot
2. Brewery tabs (scrollable, same pattern as `BreweryProductsTable`)
3. Table with columns: Name, Kind, Type, Package Size, Quantity, Price w/ VAT, Actions (edit + delete)
4. Empty state when no items
5. `ConfirmDialog` for delete
6. `InventoryItemDrawer` for create/edit

The inventory API returns `InventorySectionDto[]` where each section = a brewery. Use tabs to switch between sections.

```tsx
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TableContainer from '@mui/material/TableContainer';

import { useInventoryItems, useDeleteInventoryItem } from 'src/hooks/useInventory';

import { useEnumLabel } from 'src/utils/enumTranslations';
import { useCurrency } from 'src/providers/CurrencyProvider';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import InventoryItemDrawer from './components/InventoryItemDrawer';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryPage() {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { formatPrice } = useCurrency();
     const { data: sections = [], isLoading } = useInventoryItems();
     const deleteMutation = useDeleteInventoryItem();

     const [tabIndex, setTabIndex] = useState(0);

     // Drawer state
     const [drawerOpen, setDrawerOpen] = useState(false);
     const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
     const [editItem, setEditItem] = useState<{
          id: string;
          productId?: string;
          name?: string;
          quantity: number;
          note?: string;
     } | undefined>(undefined);

     // Delete state
     const [deleteId, setDeleteId] = useState<string | null>(null);

     const currentSection = sections[tabIndex] ?? null;
     const items = useMemo(() => currentSection?.items ?? [], [currentSection]);

     const handleAdd = () => {
          setDrawerMode('create');
          setEditItem(undefined);
          setDrawerOpen(true);
     };

     const handleEdit = (item: typeof items[number]) => {
          setDrawerMode('edit');
          setEditItem({
               id: item.id!,
               productId: item.productId ?? undefined,
               name: item.name ?? undefined,
               quantity: item.quantity ?? 0,
          });
          setDrawerOpen(true);
     };

     const handleDeleteConfirm = () => {
          if (!deleteId) return;
          deleteMutation.mutate(deleteId, {
               onSuccess: () => setDeleteId(null),
          });
     };

     return (
          <SectionCard
               title={t('inventory.title')}
               action={
                    <Button
                         variant="contained"
                         size="small"
                         startIcon={<AddIcon />}
                         onClick={handleAdd}
                    >
                         {t('inventory.addItem')}
                    </Button>
               }
          >
               {isLoading ? (
                    <LoadingSpinner />
               ) : sections.length === 0 ? (
                    <EmptyState />
               ) : (
                    <>
                         {/* Brewery tabs */}
                         <Tabs
                              value={tabIndex}
                              onChange={(_e, v: number) => setTabIndex(v)}
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
                              {sections.map((section) => (
                                   <Tab key={section.id} label={section.name} />
                              ))}
                         </Tabs>

                         {/* Items table */}
                         {items.length === 0 ? (
                              <EmptyState />
                         ) : (
                              <TableContainer sx={{ overflowX: 'auto' }}>
                                   <Table size="small">
                                        <TableHead>
                                             <TableRow>
                                                  <TableCell>{t('products.name')}</TableCell>
                                                  <TableCell>{t('products.kind')}</TableCell>
                                                  <TableCell>{t('products.type')}</TableCell>
                                                  <TableCell>{t('products.packageSize')}</TableCell>
                                                  <TableCell align="right">{t('inventory.quantity')}</TableCell>
                                                  <TableCell align="right">{t('products.priceWithVat')}</TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} />
                                             </TableRow>
                                        </TableHead>
                                        <TableBody>
                                             {items.map((item) => (
                                                  <TableRow key={item.id}>
                                                       <TableCell>{item.name}</TableCell>
                                                       <TableCell>
                                                            {item.kind != null ? enumLabel.productKind(item.kind) : '—'}
                                                       </TableCell>
                                                       <TableCell>
                                                            {item.type != null ? enumLabel.productType(item.type) : '—'}
                                                       </TableCell>
                                                       <TableCell>
                                                            {item.packageSize != null ? `${item.packageSize} L` : '—'}
                                                       </TableCell>
                                                       <TableCell align="right">{item.quantity}</TableCell>
                                                       <TableCell align="right">
                                                            {item.priceWithVat != null ? formatPrice(item.priceWithVat) : '—'}
                                                       </TableCell>
                                                       <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                            <IconButton
                                                                 size="small"
                                                                 onClick={() => handleEdit(item)}
                                                            >
                                                                 <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                 size="small"
                                                                 color="error"
                                                                 onClick={() => setDeleteId(item.id!)}
                                                            >
                                                                 <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                       </TableCell>
                                                  </TableRow>
                                             ))}
                                        </TableBody>
                                   </Table>
                              </TableContainer>
                         )}
                    </>
               )}

               {/* Drawers & dialogs */}
               <InventoryItemDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    mode={drawerMode}
                    editItem={editItem}
                    onSuccess={() => {}}
               />

               <ConfirmDialog
                    open={!!deleteId}
                    title={t('common.deleteConfirm')}
                    message={t('common.deleteConfirmMessage')}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteId(null)}
                    loading={deleteMutation.isPending}
               />
          </SectionCard>
     );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn build:check 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/pages/inventory/InventoryPage.tsx
git commit -m "feat(inventory): add InventoryPage with brewery tabs and items table"
```

---

### Task 4: Wire the route in `App.tsx`

**Files:**
- Modify: `src/App.tsx:130`

- [ ] **Step 1: Add lazy import and replace the placeholder route**

Add to the lazy imports section at the top of App.tsx:
```ts
const InventoryPage = lazy(() => import('src/pages/inventory/InventoryPage'));
```

Replace line 130:
```tsx
// Before:
<Route path="/inventory" element={<div>Inventory — coming soon</div>} />

// After:
<Route path="/inventory" element={<InventoryPage />} />
```

- [ ] **Step 2: Verify the app compiles and route works**

Run: `yarn build:check 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(inventory): wire inventory route to InventoryPage"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Run full build check**

Run: `yarn build:check`
Expected: clean build

- [ ] **Step 2: Run all tests**

Run: `yarn test:run`
Expected: all existing tests pass

- [ ] **Step 3: Final commit if any fixups needed**
