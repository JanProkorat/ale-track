import type { OutgoingShipmentOrderDto, OutgoingShipmentDetailDto, OutgoingShipmentProductDto } from 'src/generated/api-client';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRef, useMemo, useState, useEffect, forwardRef, useCallback, useImperativeHandle } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';
import { useProducts } from 'src/hooks/useProducts';
import { useOutgoingShipmentOrders } from 'src/hooks/useOutgoingShipments';

import SectionCard from 'src/components/common/SectionCard';

import RouteMapSection from './RouteMapSection';
import OrderMultiSelect from './OrderMultiSelect';
import WeightProgressBar from './WeightProgressBar';
import ShipmentLoadingTable from './ShipmentLoadingTable';
import AddExtraProductsDrawer from './AddExtraProductsDrawer';
import { defaultValues, shipmentStateOptions, outgoingShipmentSchema } from '../outgoingShipmentFormSchema';

import type { ExtraProductEntry } from './AddExtraProductsDrawer';
import type { OutgoingShipmentFormValues } from '../outgoingShipmentFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShipmentInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     name: string;
     state: string;
}

export interface ShipmentSubmitExtra {
     confirmedProductIds: Set<string>;
     extraPiecesMap: Record<string, string>;
     inventoryPiecesMap: Record<string, string>;
     extraItemIdMap: Record<string, string>;
     clientExtraLinkMap: Record<string, string>;
     firstInvoiceMap: Record<string, string>;
     secondInvoiceMap: Record<string, string>;
     availableOrders: OutgoingShipmentOrderDto[];
     extraProducts: ExtraProductEntry[];
}

interface ShipmentInlineFormProps {
     shipment: OutgoingShipmentDetailDto;
     onSubmit: (data: OutgoingShipmentFormValues, extra: ShipmentSubmitExtra) => void;
     onFormStateChange: (state: FormHeaderState) => void;
}

// ---------------------------------------------------------------------------
// Map DTO to form values
// ---------------------------------------------------------------------------

function formatDate(date: Date | undefined | null): string {
     if (!date) return '';
     const d = new Date(date);
     return d.toISOString().split('T')[0];
}

function mapShipmentToFormValues(shipment: OutgoingShipmentDetailDto): OutgoingShipmentFormValues {
     return {
          name: shipment.name ?? '',
          deliveryDate: formatDate(shipment.deliveryDate),
          state: (shipment.state as unknown as string) ?? 'Created',
          vehicleId: shipment.vehicleId ?? '',
          driverIds: shipment.driverIds ?? [],
          clientOrderShipments: (shipment.stops ?? []).map((stop, i) => ({
               clientOrderId: stop.orderId ?? '',
               order: stop.order ?? (i + 1),
               selectedAddressKind: (stop.selectedAddressKind as unknown as string) ?? 'Official',
          })),
     };
}

// ---------------------------------------------------------------------------
// ShipmentInlineForm
// ---------------------------------------------------------------------------

const ShipmentInlineForm = forwardRef<ShipmentInlineFormHandle, ShipmentInlineFormProps>(
     function ShipmentInlineForm({ shipment, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const initialValuesRef = useRef<OutgoingShipmentFormValues>(defaultValues);
          const onSubmitRef = useRef(onSubmit);
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);
          const [confirmedProductIds, setConfirmedProductIds] = useState<Set<string>>(() => new Set());
          const [extraPiecesMap, setExtraPiecesMap] = useState<Record<string, string>>({});
          const [inventoryPiecesMap, setInventoryPiecesMap] = useState<Record<string, string>>({});
          const [extraItemIdMap, setExtraItemIdMap] = useState<Record<string, string>>({});
          const [clientExtraLinkMap, setClientExtraLinkMap] = useState<Record<string, string>>({});
          const [firstInvoiceMap, setFirstInvoiceMap] = useState<Record<string, string>>({});
          const [secondInvoiceMap, setSecondInvoiceMap] = useState<Record<string, string>>({});
          const [extraProducts, setExtraProducts] = useState<ExtraProductEntry[]>([]);
          const [extraDrawerOpen, setExtraDrawerOpen] = useState(false);

          const { data: drivers = [] } = useDrivers();
          const { data: vehicles = [] } = useVehicles();
          const { data: products = [] } = useProducts();
          const { data: availableOrders = [] } = useOutgoingShipmentOrders(shipment.id);

          // Initialize confirmed product IDs from available orders when data loads
          const availableOrdersRef = useRef(availableOrders);
          useEffect(() => {
               if (availableOrders.length === 0) return;
               if (availableOrders === availableOrdersRef.current) return;
               availableOrdersRef.current = availableOrders;
               const confirmed = new Set<string>();
               for (const order of availableOrders) {
                    for (const item of order.items ?? []) {
                         if (item.isShipmentLoadingConfirmed && item.productId) {
                              confirmed.add(item.productId);
                         }
                    }
               }
               setConfirmedProductIds((prev) => {
                    // Keep any custom (non-order) confirmed IDs from extra items
                    for (const id of prev) {
                         if (id.startsWith('custom:')) confirmed.add(id);
                    }
                    // Also include confirmed extra items with real productIds
                    for (const item of shipment.inventoryExtraItems ?? []) {
                         if (item.isShipmentLoadingConfirmed && item.productId) {
                              confirmed.add(item.productId);
                         }
                    }
                    for (const item of shipment.clientExtraItems ?? []) {
                         if (item.isShipmentLoadingConfirmed && item.inventoryItemId) {
                              confirmed.add(item.inventoryItemId);
                         }
                    }
                    return confirmed;
               });
          }, [availableOrders, shipment.inventoryExtraItems, shipment.clientExtraItems, shipment.customExtraItems]);

          // Initialize invoice maps from available orders when data loads
          const invoiceInitRef = useRef(false);
          useEffect(() => {
               if (availableOrders.length === 0) return;
               if (invoiceInitRef.current) return;
               invoiceInitRef.current = true;

               // Sum invoice quantities across all order items for the same product
               const firstSums = new Map<string, number>();
               const secondSums = new Map<string, number>();
               for (const order of availableOrders) {
                    for (const item of order.items ?? []) {
                         if (!item.productId) continue;
                         if (item.firstInvoiceQuantity != null) {
                              firstSums.set(item.productId, (firstSums.get(item.productId) ?? 0) + item.firstInvoiceQuantity);
                         }
                         if (item.secondInvoiceQuantity != null) {
                              secondSums.set(item.productId, (secondSums.get(item.productId) ?? 0) + item.secondInvoiceQuantity);
                         }
                    }
               }

               setFirstInvoiceMap((prev) => {
                    const next = { ...prev };
                    for (const [pid, sum] of firstSums) {
                         if (!(pid in next)) next[pid] = String(sum);
                    }
                    return next;
               });
               setSecondInvoiceMap((prev) => {
                    const next = { ...prev };
                    for (const [pid, sum] of secondSums) {
                         if (!(pid in next)) next[pid] = String(sum);
                    }
                    return next;
               });
          }, [availableOrders]);

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               setValue,
               formState: { errors },
          } = useForm<OutgoingShipmentFormValues>({
               resolver: zodResolver(outgoingShipmentSchema),
               defaultValues,
          });

          const watchedName = watch('name');
          const watchedState = watch('state');
          const watchedDriverIds = watch('driverIds');
          const watchedStops = watch('clientOrderShipments');

          const markDirty = () => setDirty(true);

          useImperativeHandle(
               ref,
               () => ({
                    submit: async () => {
                         const isValid = await trigger();
                         if (isValid) {
                              onSubmitRef.current(getValues(), { confirmedProductIds, extraPiecesMap, inventoryPiecesMap, extraItemIdMap, clientExtraLinkMap, firstInvoiceMap, secondInvoiceMap, availableOrders, extraProducts });
                              setDirty(false);
                         }
                    },
                    resetForm: () => {
                         reset(initialValuesRef.current);
                         setDirty(false);
                    },
               }),
               [trigger, getValues, reset, confirmedProductIds, extraPiecesMap, inventoryPiecesMap, extraItemIdMap, clientExtraLinkMap, firstInvoiceMap, secondInvoiceMap, availableOrders, extraProducts],
          );

          // Notify parent of form state changes
          useEffect(() => {
               onFormStateChange({
                    isDirty: dirty,
                    name: watchedName,
                    state: watchedState,
               });
          }, [dirty, watchedName, watchedState, onFormStateChange]);

          // Reset form when shipment data changes
          useEffect(() => {
               if (!shipment) return;
               const values = mapShipmentToFormValues(shipment);
               initialValuesRef.current = values;
               reset(values);
               setDirty(false);
               invoiceInitRef.current = false;

               // Initialize extra pieces and extra products from shipment detail
               const pieces: Record<string, string> = {};
               const idMap: Record<string, string> = {};
               const clientLinks: Record<string, string> = {};
               const firstInv: Record<string, string> = {};
               const secondInv: Record<string, string> = {};
               const extras: ExtraProductEntry[] = [];
               const extraConfirmed: string[] = [];

               const processExtraItem = (key: string, item: OutgoingShipmentProductDto, isCustom: boolean, inventoryItemId?: string) => {
                    if (!item.quantity || item.quantity <= 0) return;
                    pieces[key] = String(item.quantity);
                    if (item.id) idMap[key] = item.id;
                    if (item.firstInvoiceQuantity != null) firstInv[key] = String(item.firstInvoiceQuantity);
                    if (item.secondInvoiceQuantity != null) secondInv[key] = String(item.secondInvoiceQuantity);
                    extras.push({
                         productId: key,
                         name: item.name ?? '',
                         kind: item.kind,
                         packageSize: item.packageSize ?? undefined,
                         quantity: item.quantity,
                         isCustom,
                         inventoryItemId,
                    });
                    if (item.isShipmentLoadingConfirmed) {
                         extraConfirmed.push(key);
                    }
               };

               for (const item of shipment.inventoryExtraItems ?? []) {
                    if (item.productId) processExtraItem(item.productId, item, false);
               }
               for (const item of shipment.clientExtraItems ?? []) {
                    if (!item.inventoryItemId) continue;
                    const key = item.productId ?? item.inventoryItemId;
                    const qty = item.quantity ?? 0;
                    if (qty > 0) pieces[key] = String(qty);
                    if (item.id) idMap[key] = item.id;
                    if (item.firstInvoiceQuantity != null) firstInv[key] = String(item.firstInvoiceQuantity);
                    if (item.secondInvoiceQuantity != null) secondInv[key] = String(item.secondInvoiceQuantity);
                    extras.push({
                         productId: key,
                         name: item.name ?? '',
                         kind: item.kind,
                         packageSize: item.packageSize ?? undefined,
                         quantity: qty,
                         isCustom: false,
                         inventoryItemId: item.inventoryItemId,
                    });
                    if (item.isShipmentLoadingConfirmed) extraConfirmed.push(key);
                    clientLinks[key] = item.inventoryItemId;
               }
               for (const item of shipment.customExtraItems ?? []) {
                    const key = `custom:${crypto.randomUUID()}`;
                    processExtraItem(key, item, true);
               }

               setExtraPiecesMap(pieces);
               setInventoryPiecesMap({});
               setExtraItemIdMap(idMap);
               setClientExtraLinkMap(clientLinks);
               setFirstInvoiceMap(firstInv);
               setSecondInvoiceMap(secondInv);
               setExtraProducts(extras);
               if (extraConfirmed.length > 0) {
                    setConfirmedProductIds((prev) => {
                         const next = new Set(prev);
                         for (const id of extraConfirmed) next.add(id);
                         return next;
                    });
               }
          }, [shipment, reset]);

          const selectedVehicle = vehicles.find((v) => v.id === watch('vehicleId')) ?? null;
          const selectedDrivers = drivers.filter((d) => (watchedDriverIds ?? []).includes(d.id ?? ''));

          const handleStopsChange = (stops: typeof watchedStops) => {
               setValue('clientOrderShipments', stops);
               markDirty();
          };

          const handleConfirmedChange = useCallback((ids: Set<string>) => {
               setConfirmedProductIds(ids);
               markDirty();
          }, []);

          const handleExtraPiecesChange = useCallback((pieces: Record<string, string>) => {
               setExtraPiecesMap(pieces);
               markDirty();
          }, []);

          const handleFirstInvoiceChange = useCallback((map: Record<string, string>) => {
               setFirstInvoiceMap(map);
               markDirty();
          }, []);

          const handleSecondInvoiceChange = useCallback((map: Record<string, string>) => {
               setSecondInvoiceMap(map);
               markDirty();
          }, []);

          const handleAddExtraProducts = useCallback((entries: ExtraProductEntry[]) => {
               // Collect product IDs already present in the loading table (from stops)
               const stopProductIds = new Set<string>();
               for (const stop of shipment.stops ?? []) {
                    for (const p of stop.products ?? []) {
                         if (p.id) stopProductIds.add(p.id);
                    }
               }

               // Separate inventory entries from non-inventory entries
               const inventoryEntries = entries.filter((e) => e.inventoryItemId);
               const nonInventoryEntries = entries.filter((e) => !e.inventoryItemId);

               // Non-inventory entries go to extraPiecesMap (garage)
               if (nonInventoryEntries.length > 0) {
                    setExtraPiecesMap((prev) => {
                         const next = { ...prev };
                         for (const entry of nonInventoryEntries) {
                              const existing = Number(next[entry.productId]) || 0;
                              next[entry.productId] = String(existing + entry.quantity);
                         }
                         return next;
                    });
               }

               // Inventory entries go to inventoryPiecesMap (added to totalQuantity)
               if (inventoryEntries.length > 0) {
                    setInventoryPiecesMap((prev) => {
                         const next = { ...prev };
                         for (const entry of inventoryEntries) {
                              const existing = Number(next[entry.productId]) || 0;
                              next[entry.productId] = String(existing + entry.quantity);
                         }
                         return next;
                    });

                    setClientExtraLinkMap((prev) => {
                         const next = { ...prev };
                         for (const entry of inventoryEntries) {
                              next[entry.productId] = entry.inventoryItemId!;
                         }
                         return next;
                    });
               }

               // Only add to extraProducts if the product isn't already in stops or extraProducts
               setExtraProducts((prev) => {
                    const existingExtraIds = new Set(prev.map((ep) => ep.productId));
                    const newExtras = entries.filter(
                         (e) => !stopProductIds.has(e.productId) && !existingExtraIds.has(e.productId),
                    );
                    return [...prev, ...newExtras];
               });

               setExtraDrawerOpen(false);
               markDirty();
          }, [shipment.stops]);

          const handleRemoveInventoryItem = useCallback((productId: string) => {
               setExtraPiecesMap((prev) => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
               });
               setInventoryPiecesMap((prev) => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
               });
               setClientExtraLinkMap((prev) => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
               });
               setExtraItemIdMap((prev) => {
                    const next = { ...prev };
                    delete next[productId];
                    return next;
               });
               setExtraProducts((prev) => prev.filter((ep) => ep.productId !== productId));
               markDirty();
          }, []);

          const handleInventoryQuantityChange = useCallback((productId: string, value: string) => {
               const qty = Math.max(0, Math.round(Number(value) || 0));
               const strQty = String(qty);
               // Update whichever map holds this item
               if (clientExtraLinkMap[productId]) {
                    setExtraPiecesMap((prev) => ({ ...prev, [productId]: strQty }));
               } else {
                    setInventoryPiecesMap((prev) => ({ ...prev, [productId]: strQty }));
               }
               markDirty();
          }, [clientExtraLinkMap]);

          const selectedOrderIds = useMemo(
               () => new Set((watchedStops ?? []).map((s) => s.clientOrderId)),
               [watchedStops],
          );
          const selectedOrders = useMemo(
               () => availableOrders.filter((o) => selectedOrderIds.has(o.id ?? '')),
               [availableOrders, selectedOrderIds],
          );

          // Build product lookup maps (productId → weight, productId → breweryDisplayOrder)
          const weightMap = useMemo(() => {
               const map = new Map<string, number>();
               for (const p of products) {
                    if (p.id && p.weight != null) {
                         map.set(p.id, p.weight);
                    }
               }
               for (const order of availableOrders) {
                    for (const item of order.items ?? []) {
                         if (item.productId && item.weight != null && !map.has(item.productId)) {
                              map.set(item.productId, item.weight);
                         }
                    }
               }
               return map;
          }, [products, availableOrders]);

          const displayOrderMap = useMemo(() => {
               const map = new Map<string, number>();
               for (const p of products) {
                    if (p.id && p.breweryDisplayOrder != null) {
                         map.set(p.id, p.breweryDisplayOrder);
                    }
               }
               for (const order of availableOrders) {
                    for (const item of order.items ?? []) {
                         if (item.productId && item.breweryDisplayOrder != null && !map.has(item.productId)) {
                              map.set(item.productId, item.breweryDisplayOrder);
                         }
                    }
               }
               return map;
          }, [products, availableOrders]);

          const productDisplayOrderMap = useMemo(() => {
               const map = new Map<string, number>();
               for (const p of products) {
                    if (p.id && p.displayOrder != null) {
                         map.set(p.id, p.displayOrder);
                    }
               }
               for (const order of availableOrders) {
                    for (const item of order.items ?? []) {
                         if (item.productId && item.displayOrder != null && !map.has(item.productId)) {
                              map.set(item.productId, item.displayOrder);
                         }
                    }
               }
               return map;
          }, [products, availableOrders]);

          // Compute total weight from stops + extra pieces (no memo — must update on every keystroke)
          let totalWeight = 0;
          {
               const selectedFormOrderIds = new Set((watchedStops ?? []).map((s) => s.clientOrderId));
               const existingOrderIds = new Set((shipment.stops ?? []).map((s) => s.orderId));

               for (const stop of shipment.stops ?? []) {
                    if (stop.orderId && !selectedFormOrderIds.has(stop.orderId)) continue;
                    for (const product of stop.products ?? []) {
                         const w = weightMap.get(product.id ?? '') ?? 0;
                         totalWeight += w * (product.quantity ?? 0);
                    }
               }

               for (const formStop of watchedStops ?? []) {
                    if (existingOrderIds.has(formStop.clientOrderId)) continue;
                    const order = availableOrders.find((o) => o.id === formStop.clientOrderId);
                    if (!order) continue;
                    for (const item of order.items ?? []) {
                         totalWeight += (item.weight ?? 0) * (item.quantity ?? 0);
                    }
               }

               for (const [productId, qty] of Object.entries(extraPiecesMap)) {
                    const q = Number(qty) || 0;
                    if (q <= 0) continue;
                    const w = weightMap.get(productId) ?? 0;
                    totalWeight += w * q;
               }

               for (const [productId, qty] of Object.entries(inventoryPiecesMap)) {
                    const q = Number(qty) || 0;
                    if (q <= 0) continue;
                    const w = weightMap.get(productId) ?? 0;
                    totalWeight += w * q;
               }
          }

          const toggleOrder = useCallback(
               (orderId: string) => {
                    const current = watchedStops ?? [];
                    if (selectedOrderIds.has(orderId)) {
                         const updated = current
                              .filter((s) => s.clientOrderId !== orderId)
                              .map((s, i) => ({ ...s, order: i + 1 }));
                         setValue('clientOrderShipments', updated);
                    } else {
                         setValue('clientOrderShipments', [
                              ...current,
                              { clientOrderId: orderId, order: current.length + 1, selectedAddressKind: 'Official' },
                         ]);
                    }
                    markDirty();
               },
               [watchedStops, selectedOrderIds, setValue],
          );

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('outgoingShipments.editShipment')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="name"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('outgoingShipments.name')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.name}
                                                  helperText={errors.name?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="state"
                                        control={control}
                                        render={({ field }) => (
                                             <Autocomplete
                                                  options={shipmentStateOptions}
                                                  getOptionLabel={(opt) => t(opt.labelKey)}
                                                  value={shipmentStateOptions.find((o) => o.value === field.value) ?? null}
                                                  onChange={(_e, newValue) => {
                                                       field.onChange(newValue?.value ?? '');
                                                       markDirty();
                                                  }}
                                                  isOptionEqualToValue={(opt, val) => opt.value === val.value}
                                                  size="small"
                                                  fullWidth
                                                  renderInput={(params) => (
                                                       <TextField
                                                            {...params}
                                                            label={t('outgoingShipments.state')}
                                                            size="small"
                                                            fullWidth
                                                       />
                                                  )}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="deliveryDate"
                                        control={control}
                                        render={({ field, fieldState: { error } }) => (
                                             <DatePicker
                                                  label={t('outgoingShipments.deliveryDate')}
                                                  value={field.value ? dayjs(field.value) : null}
                                                  onChange={(val) => {
                                                       field.onChange(val ? val.format('YYYY-MM-DD') : '');
                                                       markDirty();
                                                  }}
                                                  slotProps={{
                                                       textField: {
                                                            fullWidth: true,
                                                            size: 'small',
                                                            error: !!error,
                                                            helperText: error?.message,
                                                       },
                                                  }}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Autocomplete
                                        options={vehicles}
                                        getOptionLabel={(opt) => opt.name ?? ''}
                                        value={selectedVehicle}
                                        onChange={(_e, newValue) => {
                                             setValue('vehicleId', newValue?.id ?? '');
                                             markDirty();
                                        }}
                                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                        renderInput={(params) => (
                                             <TextField
                                                  {...params}
                                                  label={t('outgoingShipments.vehicle')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                   <Autocomplete
                                        multiple
                                        disableCloseOnSelect
                                        options={drivers}
                                        getOptionLabel={(opt) =>
                                             `${opt.firstName ?? ''} ${opt.lastName ?? ''}`.trim()
                                        }
                                        value={selectedDrivers}
                                        onChange={(_e, newValue) => {
                                             setValue(
                                                  'driverIds',
                                                  newValue.map((d) => d.id ?? '').filter(Boolean),
                                             );
                                             markDirty();
                                        }}
                                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                        renderInput={(params) => (
                                             <TextField
                                                  {...params}
                                                  label={t('outgoingShipments.drivers')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                   <OrderMultiSelect
                                        availableOrders={availableOrders}
                                        selectedOrders={selectedOrders}
                                        onToggle={toggleOrder}
                                   />
                              </Grid>
                         </Grid>
                    </SectionCard>

                    {/* Route Map */}
                    <SectionCard title={t('outgoingShipments.routeMap')}>
                         <RouteMapSection
                              stops={shipment.stops}
                              formStops={watchedStops ?? []}
                              onStopsChange={handleStopsChange}
                         />
                    </SectionCard>

                    {/* Nakládka */}
                    <SectionCard
                         title={t('outgoingShipments.loading')}
                         action={
                              <Button
                                   variant="contained"
                                   size="small"
                                   color="inherit"
                                   startIcon={<AddOutlined />}
                                   onClick={() => setExtraDrawerOpen(true)}
                              >
                                   {t('outgoingShipments.addExtraProducts')}
                              </Button>
                         }
                    >
                         {selectedVehicle?.maxWeight != null && selectedVehicle.maxWeight > 0 && (
                              <WeightProgressBar
                                   currentWeight={totalWeight}
                                   maxWeight={selectedVehicle.maxWeight}
                              />
                         )}
                         <ShipmentLoadingTable
                              stops={shipment.stops}
                              formStops={watchedStops ?? []}
                              availableOrders={availableOrders}
                              confirmedProductIds={confirmedProductIds}
                              onConfirmedChange={handleConfirmedChange}
                              extraPiecesMap={extraPiecesMap}
                              onExtraPiecesMapChange={handleExtraPiecesChange}
                              firstInvoiceMap={firstInvoiceMap}
                              onFirstInvoiceMapChange={handleFirstInvoiceChange}
                              secondInvoiceMap={secondInvoiceMap}
                              onSecondInvoiceMapChange={handleSecondInvoiceChange}
                              extraProducts={extraProducts}
                              inventoryPiecesMap={inventoryPiecesMap}
                              clientExtraLinkMap={clientExtraLinkMap}
                              onRemoveInventoryItem={handleRemoveInventoryItem}
                              onInventoryQuantityChange={handleInventoryQuantityChange}
                              weightMap={weightMap}
                              displayOrderMap={displayOrderMap}
                              productDisplayOrderMap={productDisplayOrderMap}
                         />
                    </SectionCard>

                    <AddExtraProductsDrawer
                         open={extraDrawerOpen}
                         onClose={() => setExtraDrawerOpen(false)}
                         onAdd={handleAddExtraProducts}
                    />
               </Stack>
          );
     },
);

export default ShipmentInlineForm;
