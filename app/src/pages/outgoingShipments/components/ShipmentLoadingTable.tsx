import type { ProductKind , OutgoingShipmentStopDto, OutgoingShipmentOrderDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useMemo, useState, Fragment } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import TableContainer from '@mui/material/TableContainer';

import { useEnumLabel } from 'src/utils/enumTranslations';

import type { ExtraProductEntry } from './AddExtraProductsDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientBreakdown {
     clientName: string;
     quantity: number;
}

interface AggregatedProduct {
     productId: string;
     name: string;
     kind?: ProductKind;
     packageSize?: number;
     totalQuantity: number;
     inventoryQuantity: number;
     clients: ClientBreakdown[];
     /** True if this row comes from extra products (not from order stops) */
     isExtra?: boolean;
     /** True if this row is an inventory item (quantity goes in Total Qty, not To garage) */
     isInventoryItem?: boolean;
     displayOrder?: number;
     breweryDisplayOrder?: number;
}

interface StopFormRow {
     clientOrderId: string;
     order: number;
     selectedAddressKind: string;
}

interface ShipmentLoadingTableProps {
     stops?: OutgoingShipmentStopDto[];
     formStops?: StopFormRow[];
     availableOrders?: OutgoingShipmentOrderDto[];
     confirmedProductIds?: Set<string>;
     onConfirmedChange?: (confirmedProductIds: Set<string>) => void;
     extraPiecesMap?: Record<string, string>;
     onExtraPiecesMapChange?: (extraPieces: Record<string, string>) => void;
     firstInvoiceMap?: Record<string, string>;
     onFirstInvoiceMapChange?: (map: Record<string, string>) => void;
     secondInvoiceMap?: Record<string, string>;
     onSecondInvoiceMapChange?: (map: Record<string, string>) => void;
     extraProducts?: ExtraProductEntry[];
     inventoryPiecesMap?: Record<string, string>;
     clientExtraLinkMap?: Record<string, string>;
     onRemoveInventoryItem?: (productId: string) => void;
     onInventoryQuantityChange?: (productId: string, value: string) => void;
     weightMap?: Map<string, number>;
     displayOrderMap?: Map<string, number>;
     productDisplayOrderMap?: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregateProducts(
     stops: OutgoingShipmentStopDto[],
     formStops?: StopFormRow[],
     availableOrders?: OutgoingShipmentOrderDto[],
     displayOrderMap?: Map<string, number>,
     productDisplayOrderMap?: Map<string, number>,
): AggregatedProduct[] {
     const map = new Map<string, AggregatedProduct>();

     // If formStops is provided, only include stops that are still selected
     const selectedOrderIds = formStops ? new Set(formStops.map((s) => s.clientOrderId)) : null;
     const existingOrderIds = new Set(stops.map((s) => s.orderId));

     for (const stop of stops) {
          // Skip DTO stops that were removed from the form
          if (selectedOrderIds && stop.orderId && !selectedOrderIds.has(stop.orderId)) continue;
          const clientName = stop.clientName ?? '—';
          for (const product of stop.products ?? []) {
               const pid = product.id ?? product.name ?? '';
               if (!pid) continue;

               let entry = map.get(pid);
               if (!entry) {
                    entry = {
                         productId: pid,
                         name: product.name ?? '—',
                         kind: product.kind,
                         packageSize: product.packageSize ?? undefined,
                         totalQuantity: 0,
                         inventoryQuantity: 0,
                         clients: [],
                         displayOrder: productDisplayOrderMap?.get(pid),
                         breweryDisplayOrder: displayOrderMap?.get(pid),
                    };
                    map.set(pid, entry);
               }
               const qty = product.quantity ?? 0;
               entry.totalQuantity += qty;
               entry.clients.push({ clientName, quantity: qty });
          }
     }

     // Newly added orders (in formStops but not in existing DTO stops)
     if (formStops && availableOrders) {
          for (const formStop of formStops) {
               if (existingOrderIds.has(formStop.clientOrderId)) continue;

               const order = availableOrders.find((o) => o.id === formStop.clientOrderId);
               if (!order) continue;

               const clientName = order.clientName ?? '—';
               for (const item of order.items ?? []) {
                    const pid = item.productId ?? item.productName ?? '';
                    if (!pid) continue;

                    let entry = map.get(pid);
                    if (!entry) {
                         entry = {
                              productId: pid,
                              name: item.productName ?? '—',
                              kind: item.kind,
                              packageSize: item.packageSize ?? undefined,
                              totalQuantity: 0,
                         inventoryQuantity: 0,
                              clients: [],
                              displayOrder: item.displayOrder ?? productDisplayOrderMap?.get(pid),
                              breweryDisplayOrder: item.breweryDisplayOrder ?? displayOrderMap?.get(pid),
                         };
                         map.set(pid, entry);
                    }
                    const qty = item.quantity ?? 0;
                    entry.totalQuantity += qty;
                    entry.clients.push({ clientName, quantity: qty });
               }
          }
     }

     return Array.from(map.values()).sort((a, b) => {
          const dispA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
          const dispB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
          if (dispA !== dispB) return dispA - dispB;
          const brewA = a.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
          const brewB = b.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
          if (brewA !== brewB) return brewA - brewB;
          return a.name.localeCompare(b.name);
     });
}

// ---------------------------------------------------------------------------
// Strikethrough style
// ---------------------------------------------------------------------------

const strikethroughSx = {
     textDecoration: 'line-through',
     color: 'text.disabled',
};

// ---------------------------------------------------------------------------
// Sub-row cell style
// ---------------------------------------------------------------------------

const subCellSx = { border: 0, py: 0.25, fontSize: '0.8125rem' } as const;
const subCellLastSx = { ...subCellSx, borderBottom: '1px solid', borderColor: 'divider' } as const;

// ---------------------------------------------------------------------------
// Helper: compute effective invoice values
// ---------------------------------------------------------------------------

function getEffectiveInvoice(totalSum: number, firstInvoice: string, secondInvoice: string) {
     const clampedSecond = Math.max(0, Math.min(totalSum, secondInvoice !== '' ? Number(secondInvoice) : 0));
     return { effectiveFirst: totalSum - clampedSecond, effectiveSecond: clampedSecond };
}

// ---------------------------------------------------------------------------
// Overview Row (full interactive row)
// ---------------------------------------------------------------------------

function ProductRow({
     product,
     checked,
     onToggle,
     confirmed,
     onToggleConfirmed,
     extraPieces,
     onExtraPiecesChange,
     firstInvoice,
     secondInvoice,
     onInvoiceChange,
     weight,
}: {
     product: AggregatedProduct;
     checked: boolean;
     onToggle: () => void;
     confirmed: boolean;
     onToggleConfirmed: () => void;
     extraPieces: string;
     onExtraPiecesChange: (value: string) => void;
     firstInvoice: string;
     secondInvoice: string;
     onInvoiceChange: (first: string, second: string) => void;
     weight: number | undefined;
}) {
     const { t } = useTranslation();
     const [open, setOpen] = useState(false);
     const enumLabel = useEnumLabel();

     const cellSx = confirmed ? strikethroughSx : undefined;
     // If this product's extraPieces comes from a client extra link (server inventory), it's already in totalQuantity
     const effectiveExtraPieces = product.isInventoryItem ? '' : extraPieces;
     const hasExtra = effectiveExtraPieces !== '' && Number(effectiveExtraPieces) > 0;
     const totalSum = product.totalQuantity + (Number(effectiveExtraPieces) || 0);

     const { effectiveFirst, effectiveSecond } = getEffectiveInvoice(totalSum, firstInvoice, secondInvoice);

     const handleFirstInvoiceChange = (value: string) => {
          if (value === '') { onInvoiceChange(String(totalSum), '0'); return; }
          const num = Math.max(0, Math.min(totalSum, Math.round(Number(value))));
          onInvoiceChange(String(num), String(totalSum - num));
     };

     const handleSecondInvoiceChange = (value: string) => {
          if (value === '') { onInvoiceChange(String(totalSum), '0'); return; }
          const num = Math.max(0, Math.min(totalSum, Math.round(Number(value))));
          onInvoiceChange(String(totalSum - num), String(num));
     };

     return (
          <>
               <TableRow
                    hover
                    sx={{
                         cursor: 'pointer',
                         opacity: confirmed ? 0.6 : 1,
                         '& > td': {
                              borderBottom: '1px solid',
                              borderColor: open ? 'transparent' : 'divider',
                         },
                    }}
               >
                    <TableCell sx={{ width: 40, px: 0.5 }} onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                              size="small"
                              checked={checked}
                              onChange={onToggle}
                         />
                    </TableCell>
                    <TableCell sx={{ width: 40, px: 0.5 }} onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                              size="small"
                              checked={confirmed}
                              onChange={onToggleConfirmed}
                         />
                    </TableCell>
                    <TableCell sx={{ width: 40, px: 0.5 }} onClick={() => setOpen(!open)}>
                         <IconButton size="small">
                              {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                         </IconButton>
                    </TableCell>
                    <TableCell onClick={() => setOpen(!open)} sx={cellSx}>{product.name}</TableCell>
                    <TableCell onClick={() => setOpen(!open)} sx={{ whiteSpace: 'nowrap', ...cellSx }}>
                         {product.kind != null ? enumLabel.productKind(product.kind) : '—'}
                    </TableCell>
                    <TableCell onClick={() => setOpen(!open)} align="right" sx={{ whiteSpace: 'nowrap', ...cellSx }}>
                         {product.packageSize != null ? `${product.packageSize} L` : '—'}
                    </TableCell>
                    <TableCell onClick={() => setOpen(!open)} align="right" sx={{ whiteSpace: 'nowrap', ...cellSx }}>
                         {weight != null ? `${(weight * (product.totalQuantity + (Number(extraPieces) || 0))).toFixed(1)} kg` : '—'}
                    </TableCell>
                    <TableCell onClick={() => setOpen(!open)} align="right" sx={{ fontWeight: 700, ...cellSx }}>
                         {totalSum}
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }} onClick={(e) => e.stopPropagation()}>
                         {product.isInventoryItem ? null : (
                              <TextField
                                   type="number"
                                   size="small"
                                   value={extraPieces}
                                   onChange={(e) => onExtraPiecesChange(e.target.value)}
                                   disabled={confirmed}
                                   slotProps={{
                                        input: { sx: { py: 0.25, px: 1, fontSize: '0.8125rem' } },
                                        htmlInput: { min: 0, style: { textAlign: 'right', MozAppearance: 'textfield' } },
                                   }}
                                   sx={{ width: 90 }}
                              />
                         )}
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }} onClick={(e) => e.stopPropagation()}>
                         <TextField
                              type="number"
                              size="small"
                              value={effectiveFirst}
                              onChange={(e) => handleFirstInvoiceChange(e.target.value)}
                              disabled={confirmed}
                              slotProps={{
                                   input: { sx: { py: 0.25, px: 1, fontSize: '0.8125rem' } },
                                   htmlInput: { min: 0, max: totalSum, style: { textAlign: 'right', MozAppearance: 'textfield' } },
                              }}
                              sx={{ width: 90 }}
                         />
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }} onClick={(e) => e.stopPropagation()}>
                         <TextField
                              type="number"
                              size="small"
                              value={effectiveSecond}
                              onChange={(e) => handleSecondInvoiceChange(e.target.value)}
                              disabled={confirmed}
                              slotProps={{
                                   input: { sx: { py: 0.25, px: 1, fontSize: '0.8125rem' } },
                                   htmlInput: { min: 0, max: totalSum, style: { textAlign: 'right', MozAppearance: 'textfield' } },
                              }}
                              sx={{ width: 90 }}
                         />
                    </TableCell>
               </TableRow>
               {open && product.clients.map((client, idx) => {
                    const hasInventory = product.inventoryQuantity > 0;
                    const isLast = idx === product.clients.length - 1 && !hasInventory && !hasExtra;
                    const sx = isLast ? subCellLastSx : subCellSx;
                    return (
                         <TableRow key={idx}>
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                              <TableCell colSpan={4} sx={{ ...sx, color: 'text.secondary' }}>
                                   {client.clientName}
                              </TableCell>
                              <TableCell align="right" sx={sx}>
                                   {client.quantity}
                              </TableCell>
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                         </TableRow>
                    );
               })}
               {open && product.inventoryQuantity > 0 && (
                    <TableRow>
                         {([0, 1, 2] as const).map((i) => (
                              <TableCell key={i} sx={hasExtra ? subCellSx : subCellLastSx} />
                         ))}
                         <TableCell colSpan={4} sx={{ ...(hasExtra ? subCellSx : subCellLastSx), fontStyle: 'italic', color: 'success.main' }}>
                              {t('outgoingShipments.fromInventory')}
                         </TableCell>
                         <TableCell align="right" sx={{ ...(hasExtra ? subCellSx : subCellLastSx), fontStyle: 'italic', color: 'success.main' }}>
                              {product.inventoryQuantity}
                         </TableCell>
                         <TableCell sx={hasExtra ? subCellSx : subCellLastSx} />
                         <TableCell sx={hasExtra ? subCellSx : subCellLastSx} />
                         <TableCell sx={hasExtra ? subCellSx : subCellLastSx} />
                    </TableRow>
               )}
               {open && hasExtra && (
                    <TableRow>
                         <TableCell sx={subCellLastSx} />
                         <TableCell sx={subCellLastSx} />
                         <TableCell sx={subCellLastSx} />
                         <TableCell colSpan={5} sx={{ ...subCellLastSx, fontStyle: 'italic', color: 'info.main' }}>
                              {t('outgoingShipments.extraToGarage')}
                         </TableCell>
                         <TableCell align="center" sx={{ ...subCellLastSx, fontStyle: 'italic', color: 'info.main' }}>
                              {extraPieces}
                         </TableCell>
                         <TableCell sx={subCellLastSx} />
                         <TableCell sx={subCellLastSx} />
                    </TableRow>
               )}
          </>
     );
}

// ---------------------------------------------------------------------------
// Invoice summary table (read-only, filtered)
// ---------------------------------------------------------------------------

function InvoiceSummaryTable({
     products,
     extraPieces,
     firstInvoiceMap,
     secondInvoiceMap,
     invoiceKey,
}: {
     products: AggregatedProduct[];
     extraPieces: Record<string, string>;
     firstInvoiceMap: Record<string, string>;
     secondInvoiceMap: Record<string, string>;
     invoiceKey: 'first' | 'second';
}) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const filtered = useMemo(() => {
          const rows: { product: AggregatedProduct; quantity: number }[] = [];
          for (const product of products) {
               const extra = Number(extraPieces[product.productId]) || 0;
               const totalSum = product.totalQuantity + extra;
               const { effectiveFirst, effectiveSecond } = getEffectiveInvoice(
                    totalSum,
                    firstInvoiceMap[product.productId] ?? '',
                    secondInvoiceMap[product.productId] ?? '',
               );
               const qty = invoiceKey === 'first' ? effectiveFirst : effectiveSecond;
               if (qty > 0) rows.push({ product, quantity: qty });
          }
          return rows;
     }, [products, extraPieces, firstInvoiceMap, secondInvoiceMap, invoiceKey]);

     if (filtered.length === 0) {
          return (
               <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('common.noData')}
               </Typography>
          );
     }

     return (
          <TableContainer sx={{ overflowX: 'auto' }}>
               <Table size="medium">
                    <TableHead>
                         <TableRow>
                              <TableCell>{t('productDeliveries.product')}</TableCell>
                              <TableCell>{t('products.kind')}</TableCell>
                              <TableCell align="right">{t('products.packageSize')}</TableCell>
                              <TableCell align="right">
                                   {invoiceKey === 'first'
                                        ? t('outgoingShipments.firstInvoicePcs')
                                        : t('outgoingShipments.secondInvoicePcs')}
                              </TableCell>
                         </TableRow>
                    </TableHead>
                    <TableBody>
                         {filtered.map(({ product, quantity }) => (
                              <TableRow key={product.productId} sx={{ '& > td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                                   <TableCell>{product.name}</TableCell>
                                   <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {product.kind != null ? enumLabel.productKind(product.kind) : '—'}
                                   </TableCell>
                                   <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {product.packageSize != null ? `${product.packageSize} L` : '—'}
                                   </TableCell>
                                   <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {quantity}
                                   </TableCell>
                              </TableRow>
                         ))}
                    </TableBody>
               </Table>
          </TableContainer>
     );
}

// ---------------------------------------------------------------------------
// Inventory summary table (read-only, client extra items)
// ---------------------------------------------------------------------------

function InventorySummaryTable({
     products,
     inventoryPiecesMap,
     clientExtraLinkMap,
     onQuantityChange,
     onRemove,
}: {
     products: AggregatedProduct[];
     inventoryPiecesMap: Record<string, string>;
     clientExtraLinkMap: Record<string, string>;
     onQuantityChange?: (productId: string, value: string) => void;
     onRemove?: (productId: string) => void;
}) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const filtered = useMemo(
          () => products.filter((p) => p.inventoryQuantity > 0 || !!clientExtraLinkMap[p.productId] || !!inventoryPiecesMap[p.productId]),
          [products, clientExtraLinkMap, inventoryPiecesMap],
     );

     if (filtered.length === 0) {
          return (
               <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('common.noData')}
               </Typography>
          );
     }

     return (
          <TableContainer sx={{ overflowX: 'auto' }}>
               <Table size="medium">
                    <TableHead>
                         <TableRow>
                              <TableCell>{t('productDeliveries.product')}</TableCell>
                              <TableCell>{t('products.kind')}</TableCell>
                              <TableCell align="right">{t('products.packageSize')}</TableCell>
                              <TableCell align="right" sx={{ width: 100 }}>{t('outgoingShipments.amount')}</TableCell>
                              {onRemove && <TableCell sx={{ width: 40 }} />}
                         </TableRow>
                    </TableHead>
                    <TableBody>
                         {filtered.map((product) => (
                              <TableRow key={product.productId} sx={{ '& > td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                                   <TableCell>{product.name}</TableCell>
                                   <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {product.kind != null ? enumLabel.productKind(product.kind) : '—'}
                                   </TableCell>
                                   <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {product.packageSize != null ? `${product.packageSize} L` : '—'}
                                   </TableCell>
                                   <TableCell align="right">
                                        <TextField
                                             type="number"
                                             size="small"
                                             value={product.inventoryQuantity}
                                             onChange={(e) => onQuantityChange?.(product.productId, e.target.value)}
                                             slotProps={{
                                                  input: { sx: { py: 0.25, px: 1, fontSize: '0.8125rem' } },
                                                  htmlInput: { min: 0, style: { textAlign: 'right', MozAppearance: 'textfield' } },
                                             }}
                                             sx={{ width: 90 }}
                                        />
                                   </TableCell>
                                   {onRemove && (
                                        <TableCell>
                                             <IconButton size="small" color="error" onClick={() => onRemove(product.productId)}>
                                                  <DeleteIcon fontSize="small" />
                                             </IconButton>
                                        </TableCell>
                                   )}
                              </TableRow>
                         ))}
                    </TableBody>
               </Table>
          </TableContainer>
     );
}

// ---------------------------------------------------------------------------
// ShipmentLoadingTable
// ---------------------------------------------------------------------------

export default function ShipmentLoadingTable({ stops, formStops, availableOrders, confirmedProductIds, onConfirmedChange, extraPiecesMap, onExtraPiecesMapChange, firstInvoiceMap, onFirstInvoiceMapChange, secondInvoiceMap, onSecondInvoiceMapChange, extraProducts = [], inventoryPiecesMap = {}, clientExtraLinkMap = {}, onRemoveInventoryItem, onInventoryQuantityChange, weightMap, displayOrderMap, productDisplayOrderMap }: ShipmentLoadingTableProps) {
     const { t } = useTranslation();
     const [tabIndex, setTabIndex] = useState(0);

     const products = useMemo(() => {
          const aggregated = aggregateProducts(stops ?? [], formStops, availableOrders, displayOrderMap, productDisplayOrderMap);
          const existingIds = new Set(aggregated.map((p) => p.productId));

          // Apply inventory quantities to existing products
          for (const product of aggregated) {
               // From drawer (inventoryPiecesMap) and from server-loaded client extras (extraPiecesMap + clientExtraLinkMap)
               const invQtyFromDrawer = Number(inventoryPiecesMap[product.productId]) || 0;
               const isClientExtra = !!clientExtraLinkMap[product.productId];
               const invQtyFromServer = isClientExtra ? (Number(extraPiecesMap?.[product.productId]) || 0) : 0;
               const invQty = invQtyFromDrawer + invQtyFromServer;
               if (invQty > 0) {
                    product.inventoryQuantity = invQty;
                    product.totalQuantity += invQty;
                    if (isClientExtra) product.isInventoryItem = true;
               }
          }

          // Append extra products that don't match any aggregated product
          const extras: AggregatedProduct[] = [];
          for (const ep of extraProducts) {
               if (existingIds.has(ep.productId)) continue;

               const isClientExtra = !!clientExtraLinkMap[ep.productId];
               const invQtyFromServer = isClientExtra ? (Number(extraPiecesMap?.[ep.productId]) || 0) : 0;
               const invQtyFromDrawer = Number(inventoryPiecesMap[ep.productId]) || 0;
               const invQty = invQtyFromServer + invQtyFromDrawer;

               extras.push({
                    productId: ep.productId,
                    name: ep.name,
                    kind: ep.kind,
                    packageSize: ep.packageSize,
                    totalQuantity: invQty,
                    inventoryQuantity: invQty,
                    clients: [],
                    isExtra: true,
                    isInventoryItem: !!ep.inventoryItemId || isClientExtra,
                    displayOrder: productDisplayOrderMap?.get(ep.productId),
                    breweryDisplayOrder: displayOrderMap?.get(ep.productId),
               });
          }

          // Sort extras: real products by displayOrder, custom (no productId) at the very end
          extras.sort((a, b) => {
               const aIsCustom = a.productId.startsWith('custom:');
               const bIsCustom = b.productId.startsWith('custom:');
               if (aIsCustom !== bIsCustom) return aIsCustom ? 1 : -1;
               const dispA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
               const dispB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
               if (dispA !== dispB) return dispA - dispB;
               const brewA = a.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
               const brewB = b.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
               if (brewA !== brewB) return brewA - brewB;
               return a.name.localeCompare(b.name);
          });

          return [...aggregated, ...extras];
     }, [stops, formStops, availableOrders, extraProducts, inventoryPiecesMap, extraPiecesMap, clientExtraLinkMap, displayOrderMap, productDisplayOrderMap]);

     // Left checkbox — local "checked" state
     const [checked, setChecked] = useState<Set<string>>(() => new Set());

     // Extra pieces — controlled from parent if provided
     const extraPieces = extraPiecesMap ?? {};
     const setExtraPieces = (updater: (prev: Record<string, string>) => Record<string, string>) => {
          onExtraPiecesMapChange?.(updater(extraPieces));
     };

     // Invoice maps — controlled from parent
     const firstInvoice = firstInvoiceMap ?? {};
     const secondInvoice = secondInvoiceMap ?? {};
     const setInvoice = (productId: string, first: string, second: string) => {
          onFirstInvoiceMapChange?.({ ...firstInvoice, [productId]: first });
          onSecondInvoiceMapChange?.({ ...secondInvoice, [productId]: second });
     };

     const allChecked = products.length > 0 && checked.size === products.length;
     const someChecked = checked.size > 0 && checked.size < products.length;

     const toggleOne = (id: string) => {
          setChecked((prev) => {
               const next = new Set(prev);
               if (next.has(id)) next.delete(id);
               else next.add(id);
               return next;
          });
     };

     const toggleAll = () => {
          if (allChecked) {
               setChecked(new Set());
          } else {
               setChecked(new Set(products.map((p) => p.productId)));
          }
     };

     // Right checkbox — controlled "confirmed" state (persisted to DB)
     const confirmed = confirmedProductIds ?? new Set<string>();
     const toggleConfirmed = (id: string) => {
          const next = new Set(confirmed);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          onConfirmedChange?.(next);
     };

     if (products.length === 0) {
          return (
               <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('common.noData')}
               </Typography>
          );
     }

     return (
          <Box>
               <Tabs
                    value={tabIndex}
                    onChange={(_e, v: number) => setTabIndex(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{
                         mb: 1,
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
                    <Tab label={t('outgoingShipments.overviewTab')} />
                    <Tab label={t('outgoingShipments.fromInventory')} />
                    <Tab label={t('outgoingShipments.firstInvoiceTab')} />
                    <Tab label={t('outgoingShipments.secondInvoiceTab')} />
               </Tabs>

               {tabIndex === 0 && (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                         <Table size="medium">
                              <TableHead>
                                   <TableRow>
                                        <TableCell sx={{ width: 40, px: 0.5 }}>
                                             <Checkbox
                                                  size="small"
                                                  checked={allChecked}
                                                  indeterminate={someChecked}
                                                  onChange={toggleAll}
                                             />
                                        </TableCell>
                                        <TableCell sx={{ width: 40, px: 0.5 }} />
                                        <TableCell sx={{ width: 40, px: 0.5 }} />
                                        <TableCell>{t('productDeliveries.product')}</TableCell>
                                        <TableCell>{t('products.kind')}</TableCell>
                                        <TableCell align="right">{t('products.packageSize')}</TableCell>
                                        <TableCell align="right">{t('products.weight')}</TableCell>
                                        <TableCell align="right">{t('outgoingShipments.totalQuantity')}</TableCell>
                                        <TableCell align="right">{t('outgoingShipments.extraPieces')}</TableCell>
                                        <TableCell align="right">{t('outgoingShipments.firstInvoicePcs')}</TableCell>
                                        <TableCell align="right">{t('outgoingShipments.secondInvoicePcs')}</TableCell>
                                   </TableRow>
                              </TableHead>
                              <TableBody>
                                   {products.map((product) => (
                                        <Fragment key={product.productId}>
                                             <ProductRow
                                                  product={product}
                                                  checked={checked.has(product.productId)}
                                                  onToggle={() => toggleOne(product.productId)}
                                                  confirmed={confirmed.has(product.productId)}
                                                  onToggleConfirmed={() => toggleConfirmed(product.productId)}
                                                  extraPieces={extraPieces[product.productId] ?? ''}
                                                  onExtraPiecesChange={(val) =>
                                                       setExtraPieces((prev) => ({ ...prev, [product.productId]: val }))
                                                  }
                                                  firstInvoice={firstInvoice[product.productId] ?? ''}
                                                  secondInvoice={secondInvoice[product.productId] ?? ''}
                                                  onInvoiceChange={(first, second) => setInvoice(product.productId, first, second)}
                                                  weight={weightMap?.get(product.productId)}
                                             />
                                        </Fragment>
                                   ))}
                              </TableBody>
                         </Table>
                    </TableContainer>
               )}

               {tabIndex === 1 && (
                    <InventorySummaryTable
                         products={products}
                         inventoryPiecesMap={inventoryPiecesMap}
                         clientExtraLinkMap={clientExtraLinkMap}
                         onQuantityChange={onInventoryQuantityChange}
                         onRemove={onRemoveInventoryItem}
                    />
               )}

               {tabIndex === 2 && (
                    <InvoiceSummaryTable
                         products={products}
                         extraPieces={extraPieces}
                         firstInvoiceMap={firstInvoice}
                         secondInvoiceMap={secondInvoice}
                         invoiceKey="first"
                    />
               )}

               {tabIndex === 3 && (
                    <InvoiceSummaryTable
                         products={products}
                         extraPieces={extraPieces}
                         firstInvoiceMap={firstInvoice}
                         secondInvoiceMap={secondInvoice}
                         invoiceKey="second"
                    />
               )}
          </Box>
     );
}
