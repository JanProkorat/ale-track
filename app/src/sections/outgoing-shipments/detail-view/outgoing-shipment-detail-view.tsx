import type { DriverDto, VehicleDto, OutgoingShipmentOrderDto } from 'src/api/Client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import { mapEnumValue } from 'src/utils/format-enum-value';

import {
     OutgoingShipmentState,
     ClientOrderShipmentDto,
     UpdateOutgoingShipmentDto,
     OutgoingShipmentStopAddressKind,
} from 'src/api/Client';

import { OrdersSelect } from '../components/orders-select';
import { WeightInfoBox } from '../components/weight-info-box';
import { ShipmentNameInput } from '../components/shipment-name-input';
import { ShipmentStateSelect } from '../components/shipment-state-select';
import { ShipmentRoutePlanner } from '../components/shipment-route-planner';
import { ShipmentDriversSelect } from '../components/shipment-drivers-select';
import { ShipmentVehicleSelect } from '../components/shipment-vehicle-select';
import { ShipmentDeliveryDatePicker } from '../components/shipment-delivery-date-picker';

type OutgoingShipmentDetailViewProps = {
     drivers: DriverDto[];
     vehicles: VehicleDto[];
     orders: OutgoingShipmentOrderDto[];
     shipment: UpdateOutgoingShipmentDto;
     errors: Record<string, string>;
     changesMade: boolean;
     onChange: (shipment: UpdateOutgoingShipmentDto) => void;
};

export function OutgoingShipmentDetailView({
     drivers,
     vehicles,
     orders,
     shipment,
     errors,
     changesMade,
     onChange,
}: Readonly<OutgoingShipmentDetailViewProps>) {
     const [maxWeight, setMaxWeight] = useState<number | undefined>(undefined);
     const [currentWeight, setCurrentWeight] = useState<number | undefined>(undefined);
     const [disabled, setDisabled] = useState<boolean>(false);

     useEffect(() => {
          if (mapEnumValue(OutgoingShipmentState, shipment.state) === OutgoingShipmentState.Delivered && !changesMade) {
               setDisabled(true);
          } else {
               setDisabled(false);
          }
     }, [shipment.state, changesMade]);

     // Initialize weight values when shipment data is loaded
     useEffect(() => {
          // Set max weight from selected vehicle
          if (shipment.vehicleId) {
               const selectedVehicle = vehicles.find((v) => v.id === shipment.vehicleId);
               setMaxWeight(selectedVehicle?.maxWeight);
          } else {
               setMaxWeight(undefined);
          }

          // Calculate current weight from selected orders
          if (shipment.clientOrderShipments && shipment.clientOrderShipments.length > 0) {
               const totalWeight = shipment.clientOrderShipments.reduce((sum, orderShipment) => {
                    const order = orders.find((o) => o.id === orderShipment.clientOrderId);
                    const orderWeight =
                         order?.items?.reduce(
                              (itemSum, item) => itemSum + (item.weight || 0) * (item.quantity || 0),
                              0
                         ) || 0;
                    return sum + orderWeight;
               }, 0);
               setCurrentWeight(totalWeight);
          } else {
               setCurrentWeight(undefined);
          }
     }, [shipment.vehicleId, shipment.clientOrderShipments, vehicles, orders]);

     const handleDriversSelect = (driverIds: string[]) => {
          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    driverIds,
               })
          );
     };

     const handleStateChange = (newState: OutgoingShipmentState) => {
          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    state: newState,
               })
          );
     };

     const handleDeliveryDateSelect = (date: Date | null | undefined) => {
          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    deliveryDate: date ?? undefined,
               })
          );
     };

     const handleNameChange = (name: string) => {
          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    name,
               })
          );
     };

     const handleVehicleSelect = (vehicleId: string | undefined, weight: number | undefined) => {
          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    vehicleId,
               })
          );
          setMaxWeight(weight);
     };

     const handleOrdersSelect = (selectedOrders: [string, number][]) => {
          // Calculate total weight from all selected orders
          const totalWeight = selectedOrders.reduce((sum, [, weight]) => sum + weight, 0);
          setCurrentWeight(totalWeight);

          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    clientOrderShipments: selectedOrders.map(
                         ([orderId], index) =>
                              new ClientOrderShipmentDto({
                                   order: index + 1,
                                   clientOrderId: orderId,
                                   selectedAddressKind: OutgoingShipmentStopAddressKind.Official,
                              })
                    ),
               })
          );
     };

     const handleStopsReordered = (updatedStops: ClientOrderShipmentDto[]) => {
          onChange(
               new UpdateOutgoingShipmentDto({
                    ...shipment,
                    clientOrderShipments: updatedStops,
               })
          );
     };

     return (
          <Box
               sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                    mt: 1,
               }}
          >
               <Box
                    sx={{
                         display: 'flex',
                         flexDirection: 'column',
                         gap: 1,
                         flex: 1,
                         minHeight: 0,
                    }}
               >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                         <ShipmentStateSelect selectedState={shipment.state} onSelect={handleStateChange} />
                         <ShipmentDeliveryDatePicker
                              selectedDeliveryDate={shipment.deliveryDate}
                              shouldValidate={errors['deliveryDate'] !== undefined}
                              onDatePicked={handleDeliveryDateSelect}
                              disabled={disabled}
                         />
                         <ShipmentDriversSelect
                              drivers={drivers}
                              selectedDriverIds={shipment.driverIds ?? []}
                              shouldValidate={errors['drivers'] !== undefined}
                              onSelect={handleDriversSelect}
                              disabled={disabled}
                         />
                         <ShipmentVehicleSelect
                              vehicles={vehicles}
                              selectedVehicleId={shipment.vehicleId}
                              shouldValidate={errors['vehicle'] !== undefined}
                              onSelect={handleVehicleSelect}
                              disabled={disabled}
                         />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                         <Box sx={{ width: '70%', mt: 1 }}>
                              <ShipmentNameInput
                                   shipmentName={shipment.name}
                                   shouldValidate={errors['name'] !== undefined}
                                   onNameChange={handleNameChange}
                                   disabled={disabled}
                              />
                         </Box>
                         <OrdersSelect
                              orders={orders}
                              selectedOrders={shipment.clientOrderShipments}
                              shouldValidate={errors['orders'] !== undefined}
                              onSelect={handleOrdersSelect}
                              disabled={disabled}
                         />
                         <Box sx={{ width: '40%' }}>
                              <WeightInfoBox currentWeight={currentWeight} maxWeight={maxWeight} />
                         </Box>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                         <ShipmentRoutePlanner
                              type="update"
                              orders={orders}
                              stops={shipment.clientOrderShipments}
                              onStopsReordered={handleStopsReordered}
                         />
                    </Box>
               </Box>
          </Box>
     );
}
