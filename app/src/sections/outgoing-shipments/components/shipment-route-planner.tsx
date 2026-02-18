import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSensor, DndContext, useSensors, closestCenter, PointerSensor } from '@dnd-kit/core';

import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import { Card, Dialog, Typography, IconButton, DialogContent } from '@mui/material';

import RouteMapView from './route-map-view';
import { SortableRouteStop } from './sortable-route-stop';
import { mapEnumValue } from '../../../utils/format-enum-value';
import {
     OutgoingShipmentStopAddressKind,
     ClientOrderShipmentDto as ClientOrderShipmentDtoClass,
} from '../../../api/Client';

import type { AddressDto, ClientOrderShipmentDto, OutgoingShipmentOrderDto } from '../../../api/Client';

type ShipmentRoutePlannerProps = {
     type: 'create' | 'update';
     stops: ClientOrderShipmentDto[];
     orders: OutgoingShipmentOrderDto[];
     onStopsReordered: (updatedStops: ClientOrderShipmentDto[]) => void;
};

export type RouteStop = {
     orderId: string;
     clientName: string;
     officialAddress: AddressDto;
     contactAddress: AddressDto | undefined;
     selectedAddress: AddressDto;
     selectedAddressType: OutgoingShipmentStopAddressKind;
};

export function ShipmentRoutePlanner({ type, stops, orders, onStopsReordered }: ShipmentRoutePlannerProps) {
     const { t } = useTranslation();

     const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
     const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});
     const [selectedAddresses, setSelectedAddresses] = useState<Record<string, OutgoingShipmentStopAddressKind>>({});
     const [mapFullScreenOpen, setMapFullScreenOpen] = useState<boolean>(false);

     const sensors = useSensors(
          useSensor(PointerSensor, {
               activationConstraint: {
                    distance: 5,
               },
          })
     );

     const toggleStop = (stopId: string) => {
          setExpandedStops((prev) => ({
               ...prev,
               [stopId]: !prev[stopId],
          }));
     };

     const handleAddressSelect = (stopId: string, addressType: OutgoingShipmentStopAddressKind) => {
          setSelectedAddresses((prev) => ({
               ...prev,
               [stopId]: addressType,
          }));

          setRouteStops((prev) =>
               prev.map((stop) => {
                    if (stop.orderId === stopId) {
                         const newAddress =
                              addressType ===
                              mapEnumValue(OutgoingShipmentStopAddressKind, OutgoingShipmentStopAddressKind.Official)
                                   ? stop.officialAddress
                                   : stop.contactAddress;
                         return {
                              ...stop,
                              selectedAddress: newAddress!,
                              selectedAddressType: addressType,
                         };
                    }
                    return stop;
               })
          );
     };

     useEffect(() => {
          const mappedStops = stops.map((stop) => {
               const relatedOrder = orders.find((order) => order.id === stop.clientOrderId);
               // Ensure selectedAddressKind is treated as a number for proper enum comparison
               const addressKind = Number(stop.selectedAddressKind) as OutgoingShipmentStopAddressKind;
               return {
                    orderId: stop.clientOrderId,
                    clientName: relatedOrder?.clientName,
                    officialAddress: relatedOrder?.clientOfficialAddress,
                    contactAddress: relatedOrder?.clientContactAddress,
                    selectedAddress: relatedOrder?.clientOfficialAddress,
                    selectedAddressType: addressKind,
               } as RouteStop;
          });
          setRouteStops(mappedStops);

          // Initialize selected addresses to official by default
          const initialSelected: Record<string, OutgoingShipmentStopAddressKind> = {};
          mappedStops.forEach((stop) => {
               initialSelected[stop.orderId] = stop.selectedAddressType;
          });
          setSelectedAddresses(initialSelected);
     }, [stops, orders]);

     const formatAddressMultiline = (address: AddressDto) => {
          if (!address) return { street: '', cityLine: '' };

          const street = [address.streetName ?? '', address.streetNumber ?? ''].filter(Boolean).join(' ');
          const cityLine = [address.zip ?? '', address.city ?? ''].filter(Boolean).join(' ');
          return { street, cityLine };
     };

     const handleDragEnd = ({ active, over }: any) => {
          if (active.id !== over?.id) {
               const oldIndex = stops.findIndex((s) => s.clientOrderId === active.id);
               const newIndex = stops.findIndex((s) => s.clientOrderId === over?.id);

               const reorderedStops = arrayMove(stops, oldIndex, newIndex);

               // Update the order property for each stop
               const updatedStops = reorderedStops.map(
                    (stop, index) =>
                         new ClientOrderShipmentDtoClass({
                              clientOrderId: stop.clientOrderId,
                              order: index + 1,
                              selectedAddressKind: stop.selectedAddressKind,
                         })
               );

               onStopsReordered(updatedStops);
          }
     };

     return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
               <Box
                    sx={{
                         borderBottom: '1px solid #eee',
                         mt: 1,
                    }}
               >
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                         {t('outgoingShipments.route')}
                    </Typography>
               </Box>
               <Box sx={{ mt: 2, display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
                    <Box
                         sx={{
                              width: '30%',
                              overflowY: 'auto',
                              border: '1px solid #e0e0e0',
                              borderRadius: 1,
                              p: 1,
                         }}
                    >
                         <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                              <SortableContext
                                   items={routeStops.map((s) => s.orderId)}
                                   strategy={verticalListSortingStrategy}
                              >
                                   {routeStops.map((stop) => (
                                        <SortableRouteStop
                                             key={stop.orderId}
                                             id={stop.orderId}
                                             clientName={stop.clientName ?? ''}
                                             clientOfficialAddress={stop.officialAddress}
                                             clientContactAddress={stop.contactAddress}
                                             isExpanded={expandedStops[stop.orderId] || false}
                                             selectedAddressType={
                                                  selectedAddresses[stop.orderId] ||
                                                  OutgoingShipmentStopAddressKind.Official
                                             }
                                             onToggle={() => toggleStop(stop.orderId)}
                                             onAddressSelect={(addressType) =>
                                                  handleAddressSelect(stop.orderId, addressType)
                                             }
                                             formatAddressMultiline={formatAddressMultiline}
                                             t={t}
                                        />
                                   ))}
                              </SortableContext>
                         </DndContext>
                    </Box>
                    <Box
                         sx={{
                              flex: 1,
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#f5f5f5',
                              borderRadius: 2,
                              p: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                         }}
                    >
                         {routeStops.length > 0 ? (
                              <RouteMapView
                                   type={type}
                                   stops={routeStops}
                                   isFullscreen={false}
                                   onFullScreenToggle={setMapFullScreenOpen}
                              />
                         ) : (
                              <Card sx={{ p: 2 }}>
                                   <Typography variant="body1" color="textSecondary">
                                        {t('outgoingShipments.noStopsDefined')}
                                   </Typography>
                              </Card>
                         )}
                    </Box>
                    <Dialog open={mapFullScreenOpen} onClose={() => setMapFullScreenOpen(false)} fullScreen>
                         <IconButton
                              onClick={() => setMapFullScreenOpen(false)}
                              sx={{
                                   position: 'absolute',
                                   top: 8,
                                   right: 8,
                                   zIndex: 1300,
                              }}
                         >
                              <CloseIcon />
                         </IconButton>

                         <DialogContent sx={{ p: 0, height: '100vh' }}>
                              <RouteMapView
                                   type={type}
                                   stops={routeStops}
                                   isFullscreen
                                   onFullScreenToggle={setMapFullScreenOpen}
                              />
                         </DialogContent>
                    </Dialog>
               </Box>
          </Box>
     );
}
