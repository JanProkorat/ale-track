import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import AddIcon from '@mui/icons-material/Add';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import TableContainer from '@mui/material/TableContainer';
import InfoOutlined from '@mui/icons-material/InfoOutlined';

import { useInventoryItems, useDeleteInventoryItem } from 'src/hooks/useInventory';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCurrency } from 'src/providers/CurrencyProvider';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

import InventoryItemDrawer from './components/InventoryItemDrawer';

import type { EditItemData } from './components/InventoryItemDrawer';

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
     const [editItem, setEditItem] = useState<EditItemData | undefined>(undefined);

     // Delete state
     const [deleteId, setDeleteId] = useState<string | null>(null);

     const currentSection = sections[tabIndex] ?? null;
     const items = useMemo(() => currentSection?.items ?? [], [currentSection]);

     const handleAdd = () => {
          setDrawerMode('create');
          setEditItem(undefined);
          setDrawerOpen(true);
     };

     const handleEdit = (item: (typeof items)[number]) => {
          setDrawerMode('edit');
          setEditItem({
               id: item.id!,
               productId: item.productId ?? undefined,
               name: item.name ?? undefined,
               quantity: item.quantity ?? 0,
               note: item.note ?? undefined,
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
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('inventory.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={handleAdd}
                    >
                         {t('inventory.addItem')}
                    </Button>
               </Box>

               {isLoading ? (
                    <LoadingSpinner />
               ) : sections.length === 0 ? (
                    <Card sx={{ p: 3 }}>
                         <EmptyState />
                    </Card>
               ) : (
                    <>
                         {/* Brewery tabs */}
                         <Card sx={{ mb: 2 }}>
                              <Tabs
                                   value={tabIndex}
                                   onChange={(_e, v: number) => setTabIndex(v)}
                                   variant="scrollable"
                                   scrollButtons="auto"
                                   allowScrollButtonsMobile
                                   textColor="primary"
                                   indicatorColor="primary"
                                   sx={{
                                        m: 2,
                                        minHeight: 42,
                                        '& .MuiTabs-flexContainer': {
                                             justifyContent: 'space-between',
                                        },
                                        '& .MuiTabScrollButton-root.Mui-disabled': {
                                             opacity: 0.3,
                                        },
                                        '& .MuiTab-root': {
                                             minHeight: 42,
                                             flex: 1,
                                             textTransform: 'none',
                                             fontWeight: 600,
                                             fontSize: '0.9rem',
                                             letterSpacing: '0.01em',
                                        },
                                   }}
                              >
                                   {sections.map((section) => (
                                        <Tab key={section.id} label={section.name} />
                                   ))}
                              </Tabs>
                         </Card>

                         {/* Items table */}
                         <SectionCard title={t('inventory.items')}>
                         {items.length === 0 ? (
                              <EmptyState />
                         ) : (
                              <TableContainer sx={{ overflowX: 'auto' }}>
                                   <Table size="medium">
                                        <TableHead>
                                             <TableRow>
                                                  <TableCell sx={{ width: 40, position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.neutral' }} />
                                                  <TableCell sx={{ position: 'sticky', left: 40, zIndex: 3, bgcolor: 'background.neutral' }}>{t('products.name')}</TableCell>
                                                  <TableCell>{t('products.kind')}</TableCell>
                                                  <TableCell>{t('products.type')}</TableCell>
                                                  <TableCell>{t('products.packageSize')}</TableCell>
                                                  <TableCell align="right">{t('inventory.quantity')}</TableCell>
                                                  <TableCell align="right">{t('products.priceWithVat')}</TableCell>
                                                  <TableCell align="right" />
                                             </TableRow>
                                        </TableHead>
                                        <TableBody>
                                             {items.map((item) => (
                                                  <TableRow key={item.id}>
                                                       <TableCell sx={{ width: 40, position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper' }}>
                                                            <Tooltip title={item.note ?? ''} arrow>
                                                                 <span>
                                                                      <InfoOutlined
                                                                           sx={{
                                                                                fontSize: 18,
                                                                                color: item.note ? 'primary.main' : 'action.disabled',
                                                                                cursor: item.note ? 'pointer' : 'default',
                                                                                verticalAlign: 'middle',
                                                                           }}
                                                                      />
                                                                 </span>
                                                            </Tooltip>
                                                       </TableCell>
                                                       <TableCell sx={{ position: 'sticky', left: 40, zIndex: 2, bgcolor: 'background.paper' }}>{item.name}</TableCell>
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
                         </SectionCard>
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
          </Box>
     );
}
