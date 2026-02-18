import type { DriverDto, VehicleDto, OutgoingShipmentOrderDto} from 'src/api/Client';

import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';

import { ClientOrderShipmentDto, CreateOutgoingShipmentDto, OutgoingShipmentStopAddressKind } from 'src/api/Client';

import { useApiCall } from '../../../hooks/use-api-call';
import { OrdersSelect } from '../components/orders-select';
import { WeightInfoBox } from '../components/weight-info-box';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { ShipmentNameInput } from '../components/shipment-name-input';
import { useAuthorizedClient } from '../../../api/use-authorized-client';
import { DrawerLayout } from '../../../layouts/components/drawer-layout';
import { ShipmentRoutePlanner } from '../components/shipment-route-planner';
import { ShipmentDriversSelect } from '../components/shipment-drivers-select';
import { ShipmentVehicleSelect } from '../components/shipment-vehicle-select';
import { ShipmentDeliveryDatePicker } from '../components/shipment-delivery-date-picker';

type CreateOutgoingShipmentProps = {
  drivers: DriverDto[];
  vehicles: VehicleDto[];
  width: number;
  onClose: () => void;
  onSave: (newShipmentId: string) => void;
};

export function CreateOutgoingShipmentView({
  drivers,
  vehicles,
  width,
  onClose,
  onSave,
}: Readonly<CreateOutgoingShipmentProps>) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { executeApiCall, executeApiCallWithDefault } = useApiCall();
  const client = useAuthorizedClient();

  const [orders, setOrders] = useState<OutgoingShipmentOrderDto[]>([]);
  const [shouldValidate, setShouldValidate] = useState<boolean>(false);
  const [maxWeight, setMaxWeight] = useState<number | undefined>(undefined);
  const [currentWeight, setCurrentWeight] = useState<number | undefined>(undefined);

  const [shipment, setShipment] = useState<CreateOutgoingShipmentDto>(
    new CreateOutgoingShipmentDto({
      deliveryDate: undefined,
      vehicleId: undefined,
      driverIds: [],
      clientOrderShipments: [],
      name: '',
    })
  );

  const fetchOrders = useCallback(async () => {
    const fetchedOrders = await executeApiCallWithDefault(
      () => client.fetOrdersForOutgoingShipments(null, {}),
      []
    );
    setOrders(fetchedOrders);
  }, [client, executeApiCallWithDefault]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleSave = async () => {
    if (
      shipment.name === ""
    ) {
      setShouldValidate(true);
      showSnackbar(t('common.validationError'), 'error');
      return;
    }
    setShouldValidate(false);

    const cleanedDelivery = new CreateOutgoingShipmentDto({
      ...shipment,
    });

    const newShipmentId = await executeApiCall(() =>
      client.createOutgoingShipmentEndpoint(cleanedDelivery)
    );

    if (newShipmentId) {
      onSave(newShipmentId);
    }
  };

  const handleDriversSelect = (driverIds: string[]) => {
    setShipment(
      (prev) =>
        new CreateOutgoingShipmentDto({
          ...prev,
          driverIds,
        })
    );
  };

  const handleDeliveryDateSelect = (date: Date | null | undefined) => {
    setShipment(
      (prev) =>
        new CreateOutgoingShipmentDto({
          ...prev,
          deliveryDate: date ?? undefined,
        })
    );
  };

  const handleNameChange = (name: string) => {
    setShipment(
      (prev) =>
        new CreateOutgoingShipmentDto({
          ...prev,
          name,
        })
    );
  };

  const handleVehicleSelect = (vehicleId: string | undefined, weight: number | undefined) => {
    setShipment(
      (prev) =>
        new CreateOutgoingShipmentDto({
          ...prev,
          vehicleId,
        })
    );
    setMaxWeight(weight);
  };

  const handleOrdersSelect = (selectedOrders: [string, number][]) => {
    // Calculate total weight from all selected orders
    const totalWeight = selectedOrders.reduce((sum, [, weight]) => sum + weight, 0);
    setCurrentWeight(totalWeight);

    setShipment(
      (prev) =>
        new CreateOutgoingShipmentDto({
          ...prev,
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
    setShipment(
      (prev) =>
        new CreateOutgoingShipmentDto({
          ...prev,
          clientOrderShipments: updatedStops,
        })
    );
  };

  return (
    <DrawerLayout
      title={t('outgoingShipments.new')}
      isLoading={false}
      onClose={onClose}
      onSaveAndClose={handleSave}
      width={width}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          height: '100%',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShipmentDeliveryDatePicker
            selectedDeliveryDate={shipment.deliveryDate}
            shouldValidate={shouldValidate}
            onDatePicked={handleDeliveryDateSelect}
          />
          <ShipmentDriversSelect
            drivers={drivers}
            selectedDriverIds={shipment.driverIds ?? []}
            shouldValidate={shouldValidate}
            onSelect={handleDriversSelect}
          />
          <ShipmentVehicleSelect
            vehicles={vehicles}
            selectedVehicleId={shipment.vehicleId}
            shouldValidate={shouldValidate}
            onSelect={handleVehicleSelect}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: '40%', mt: 1 }}>
            <ShipmentNameInput
              shipmentName={shipment.name}
              shouldValidate={shouldValidate}
              onNameChange={handleNameChange}
            />
          </Box>
          <OrdersSelect
            orders={orders}
            selectedOrders={shipment.clientOrderShipments}
            shouldValidate={shouldValidate}
            onSelect={handleOrdersSelect}
          />
          <Box sx={{ width: '20%' }}>
            <WeightInfoBox currentWeight={currentWeight} maxWeight={maxWeight} />
          </Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ShipmentRoutePlanner
            type="create"
            orders={orders}
            stops={shipment.clientOrderShipments}
            onStopsReordered={handleStopsReordered}
          />
        </Box>
      </Box>
    </DrawerLayout>
  );
}
