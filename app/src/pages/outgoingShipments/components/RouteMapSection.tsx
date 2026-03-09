import type { OutgoingShipmentStopDto } from 'src/generated/api-client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import IconButton from '@mui/material/IconButton';
import DragHandle from '@mui/icons-material/DragIndicator';
import ExpandMore from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';

import RouteMap from 'src/components/common/RouteMap';
import { getCompanyAddress } from 'src/utils/companyAddress';

import type { RoutePoint } from 'src/components/common/RouteMap';
import type { DragEndEvent } from '@dnd-kit/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StopFormRow {
     clientOrderId: string;
     order: number;
     selectedAddressKind: string;
}

interface RouteMapSectionProps {
     stops?: OutgoingShipmentStopDto[];
     formStops: StopFormRow[];
     onStopsChange: (stops: StopFormRow[]) => void;
}

// ---------------------------------------------------------------------------
// Sortable stop item
// ---------------------------------------------------------------------------

interface AddressFields {
     streetName?: string;
     streetNumber?: string;
     city?: string;
     zip?: string;
}

function AddressLines({ addr }: { addr?: AddressFields }) {
     if (!addr) return <Typography variant="body2" color="text.secondary">—</Typography>;
     const line1 = [addr.streetName, addr.streetNumber].filter(Boolean).join(' ');
     const line2 = [addr.zip, addr.city].filter(Boolean).join(' ');
     return (
          <Box>
               {line1 && <Typography variant="body2">{line1}</Typography>}
               {line2 && <Typography variant="body2">{line2}</Typography>}
               {!line1 && !line2 && <Typography variant="body2" color="text.secondary">—</Typography>}
          </Box>
     );
}

function SortableStop({
     id,
     stop,
     detail,
     onAddressKindChange,
}: {
     id: string;
     stop: StopFormRow;
     detail?: OutgoingShipmentStopDto;
     onAddressKindChange: (value: string) => void;
}) {
     const { t } = useTranslation();
     const [open, setOpen] = useState(false);
     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

     const clientName = detail?.clientName ?? '';
     const hasContact = !!detail?.contactAddress;

     const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
     };

     return (
          <Box
               ref={setNodeRef}
               style={style}
               sx={{
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
               }}
          >
               {/* Header */}
               <Box
                    sx={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: 1,
                         px: 1.5,
                         py: 1,
                         cursor: 'pointer',
                    }}
                    onClick={() => setOpen((prev) => !prev)}
               >
                    <Box
                         sx={{ cursor: 'grab', touchAction: 'none', display: 'flex', color: 'text.secondary' }}
                         onClick={(e) => e.stopPropagation()}
                         {...attributes}
                         {...listeners}
                    >
                         <DragHandle fontSize="small" />
                    </Box>

                    <Typography variant="body1" sx={{ fontWeight: 500, flex: 1, minWidth: 0 }} noWrap>
                         {clientName || '—'}
                    </Typography>

                    <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                         <ExpandMore fontSize="small" />
                    </IconButton>
               </Box>

               {/* Collapsible content */}
               <Collapse in={open}>
                    <Box sx={{ px: 1.5, pb: 1.5 }}>
                         <RadioGroup
                              value={hasContact ? (stop.selectedAddressKind === 'Contact' ? 'Contact' : 'Official') : 'Official'}
                              onChange={(_e, value) => onAddressKindChange(value)}
                         >
                              {/* Official address */}
                              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, mb: 0.5 }}>
                                   {t('clients.officialAddress')}
                              </Typography>
                              <FormControlLabel
                                   value="Official"
                                   control={<Radio size="small" />}
                                   label={<AddressLines addr={detail?.officialAddress} />}
                                   sx={{ alignItems: 'flex-start', ml: 0, '& .MuiRadio-root': { mt: -0.25 } }}
                              />

                              {/* Contact address */}
                              {hasContact && (
                                   <>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }}>
                                             {t('clients.contactAddress')}
                                        </Typography>
                                        <FormControlLabel
                                             value="Contact"
                                             control={<Radio size="small" />}
                                             label={<AddressLines addr={detail?.contactAddress ?? undefined} />}
                                             sx={{ alignItems: 'flex-start', ml: 0, '& .MuiRadio-root': { mt: -0.25 } }}
                                        />
                                   </>
                              )}
                         </RadioGroup>
                    </Box>
               </Collapse>
          </Box>
     );
}

// ---------------------------------------------------------------------------
// Route points builder
// ---------------------------------------------------------------------------

function findStopDetail(stops: OutgoingShipmentStopDto[], formStop: StopFormRow) {
     // Try matching by orderId first
     if (formStop.clientOrderId) {
          const match = stops.find((s) => s.orderId === formStop.clientOrderId);
          if (match) return match;
     }
     // Fall back to matching by order position
     return stops.find((s) => s.order === formStop.order);
}

function getStopAddress(detail: OutgoingShipmentStopDto, addressKind: string) {
     // addressKind comes from the form as string 'Contact'/'Official'
     // detail.selectedAddressKind may be a numeric enum (0=Official, 1=Contact) or string
     const useContact =
          addressKind === 'Contact' ||
          String(detail.selectedAddressKind) === '1' && addressKind !== 'Official';

     if (useContact && detail.contactAddress) {
          return detail.contactAddress;
     }
     return detail.officialAddress;
}

function buildRoutePoints(
     stops: OutgoingShipmentStopDto[],
     formStops: StopFormRow[],
     t: (key: string) => string,
): RoutePoint[] {
     if (stops.length === 0) return [];

     let companyAddr: { latitude: number; longitude: number };
     try {
          companyAddr = getCompanyAddress();
     } catch {
          return [];
     }

     const depot: RoutePoint = {
          lat: companyAddr.latitude,
          lng: companyAddr.longitude,
          label: t('outgoingShipments.companyHQ'),
          isDepot: true,
     };

     // Build waypoints: use formStops for ordering if available, otherwise DTO order
     const orderedStops =
          formStops.length > 0
               ? [...formStops]
                      .sort((a, b) => a.order - b.order)
                      .map((fs) => ({
                           detail: findStopDetail(stops, fs),
                           addressKind: fs.selectedAddressKind,
                      }))
               : [...stops]
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((s) => ({
                           detail: s,
                           addressKind: String(s.selectedAddressKind ?? 'Official'),
                      }));

     const waypoints: RoutePoint[] = [];
     for (const { detail, addressKind } of orderedStops) {
          if (!detail) continue;

          const addr = getStopAddress(detail, addressKind);
          if (!addr?.latitude || !addr?.longitude) continue;

          waypoints.push({
               lat: addr.latitude,
               lng: addr.longitude,
               label: detail.clientName ?? undefined,
          });
     }

     if (waypoints.length === 0) return [];
     return [depot, ...waypoints, depot];
}

// ---------------------------------------------------------------------------
// RouteMapSection
// ---------------------------------------------------------------------------

export default function RouteMapSection({ stops, formStops, onStopsChange }: RouteMapSectionProps) {
     const { t } = useTranslation();

     const routePoints = useMemo(
          () => buildRoutePoints(stops ?? [], formStops, t),
          [stops, formStops, t],
     );

     const sortableIds = useMemo(
          () => formStops.map((s, i) => s.clientOrderId || `stop-${i}`),
          [formStops],
     );

     const sensors = useSensors(
          useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
          useSensor(KeyboardSensor),
     );

     const handleDragEnd = useCallback(
          (event: DragEndEvent) => {
               const { active, over } = event;
               if (!over || active.id === over.id) return;
               const oldIndex = sortableIds.indexOf(active.id as string);
               const newIndex = sortableIds.indexOf(over.id as string);
               if (oldIndex !== -1 && newIndex !== -1) {
                    const reordered = arrayMove(formStops, oldIndex, newIndex).map((s, i) => ({
                         ...s,
                         order: i + 1,
                    }));
                    onStopsChange(reordered);
               }
          },
          [formStops, onStopsChange, sortableIds],
     );

     const handleAddressKindChange = (index: number, value: string) => {
          const updated = formStops.map((s, i) =>
               i === index ? { ...s, selectedAddressKind: value } : s,
          );
          onStopsChange(updated);
     };

     return (
          <Grid container spacing={2}>
               {/* Stops list */}
               <Grid size={{ xs: 12, md: 4 }}>
                    <DndContext
                         sensors={sensors}
                         collisionDetection={closestCenter}
                         modifiers={[restrictToVerticalAxis]}
                         onDragEnd={handleDragEnd}
                    >
                         <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                              <Stack spacing={1}>
                                   {formStops.map((formStop, index) => {
                                        const detail = findStopDetail(stops ?? [], formStop);
                                        return (
                                             <SortableStop
                                                  key={sortableIds[index]}
                                                  id={sortableIds[index]}
                                                  stop={formStop}
                                                  detail={detail}
                                                  onAddressKindChange={(val) =>
                                                       handleAddressKindChange(index, val)
                                                  }
                                             />
                                        );
                                   })}
                              </Stack>
                         </SortableContext>
                    </DndContext>
               </Grid>

               {/* Map */}
               <Grid size={{ xs: 12, md: 8 }}>
                    {routePoints.length > 0 ? (
                         <RouteMap points={routePoints} height={Math.max(400, formStops.length * 72)} />
                    ) : (
                         <Typography variant="body2" color="text.secondary">
                              {t('outgoingShipments.noRouteData')}
                         </Typography>
                    )}
               </Grid>
          </Grid>
     );
}
