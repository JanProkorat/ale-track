import type { ProductKind , OutgoingShipmentStopDto, OutgoingShipmentOrderDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useMemo, useState, Fragment } from 'react';

import Table from '@mui/material/Table';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
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
     clients: ClientBreakdown[];
     /** True if this row comes from extra products (not from order stops) */
     isExtra?: boolean;
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
     extraProducts?: ExtraProductEntry[];
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
// Row
// ---------------------------------------------------------------------------

function ProductRow({
     product,
     checked,
     onToggle,
     confirmed,
     onToggleConfirmed,
     extraPieces,
     onExtraPiecesChange,
     weight,
}: {
     product: AggregatedProduct;
     checked: boolean;
     onToggle: () => void;
     confirmed: boolean;
     onToggleConfirmed: () => void;
     extraPieces: string;
     onExtraPiecesChange: (value: string) => void;
     weight: number | undefined;
}) {
     const { t } = useTranslation();
     const [open, setOpen] = useState(false);
     const enumLabel = useEnumLabel();

     const cellSx = confirmed ? strikethroughSx : undefined;
     const hasExtra = extraPieces !== '' && Number(extraPieces) > 0;

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
                         {product.totalQuantity}
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }} onClick={(e) => e.stopPropagation()}>
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
                    </TableCell>
               </TableRow>
               {open && product.clients.map((client, idx) => {
                    const isLast = idx === product.clients.length - 1 && !hasExtra;
                    const sx = isLast ? subCellLastSx : subCellSx;
                    return (
                         <TableRow key={idx}>
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                              <TableCell colSpan={3} sx={{ ...sx, color: 'text.secondary' }}>
                                   {client.clientName}
                              </TableCell>
                              <TableCell align="right" sx={sx}>
                                   {client.quantity}
                              </TableCell>
                              <TableCell sx={sx} />
                              <TableCell sx={sx} />
                         </TableRow>
                    );
               })}
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
                    </TableRow>
               )}
          </>
     );
}

// ---------------------------------------------------------------------------
// ShipmentLoadingTable
// ---------------------------------------------------------------------------

export default function ShipmentLoadingTable({ stops, formStops, availableOrders, confirmedProductIds, onConfirmedChange, extraPiecesMap, onExtraPiecesMapChange, extraProducts = [], weightMap, displayOrderMap, productDisplayOrderMap }: ShipmentLoadingTableProps) {
     const { t } = useTranslation();
     const products = useMemo(() => {
          const aggregated = aggregateProducts(stops ?? [], formStops, availableOrders, displayOrderMap, productDisplayOrderMap);
          const existingIds = new Set(aggregated.map((p) => p.productId));

          // Append extra products that aren't already in the aggregated list
          const extras: AggregatedProduct[] = [];
          for (const ep of extraProducts) {
               if (!existingIds.has(ep.productId)) {
                    extras.push({
                         productId: ep.productId,
                         name: ep.name,
                         kind: ep.kind,
                         packageSize: ep.packageSize,
                         totalQuantity: 0,
                         clients: [],
                         isExtra: true,
                         displayOrder: productDisplayOrderMap?.get(ep.productId),
                         breweryDisplayOrder: displayOrderMap?.get(ep.productId),
                    });
               }
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
     }, [stops, formStops, availableOrders, extraProducts, displayOrderMap, productDisplayOrderMap]);

     // Left checkbox — local "checked" state
     const [checked, setChecked] = useState<Set<string>>(() => new Set());

     // Extra pieces — controlled from parent if provided
     const extraPieces = extraPiecesMap ?? {};
     const setExtraPieces = (updater: (prev: Record<string, string>) => Record<string, string>) => {
          onExtraPiecesMapChange?.(updater(extraPieces));
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
                                        weight={weightMap?.get(product.productId)}
                                   />
                              </Fragment>
                         ))}
                    </TableBody>
               </Table>
          </TableContainer>
     );
}
