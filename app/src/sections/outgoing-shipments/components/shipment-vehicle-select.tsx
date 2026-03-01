import { useTranslation } from 'react-i18next';

import { MultiSelect } from 'src/components/forms/multi-select';

import type { VehicleDto } from '../../../api/Client';

type ShipmentVehicleSelectProps = {
     vehicles: VehicleDto[];
     selectedVehicleId: string | undefined;
     shouldValidate: boolean;
     onSelect: (vehicleId: string | undefined, maxWeight: number | undefined) => void;
     disabled?: boolean;
};

export function ShipmentVehicleSelect({
     vehicles,
     selectedVehicleId,
     shouldValidate,
     onSelect,
     disabled,
}: Readonly<ShipmentVehicleSelectProps>) {
     const { t } = useTranslation();

     const handleSelect = (ids: string[]) => {
          const id = ids[0];
          const vehicle = id ? vehicles.find((v) => v.id === id) : undefined;
          onSelect(vehicle?.id, vehicle?.maxWeight);
     };

     return (
          <MultiSelect
               label={t('outgoingShipments.vehicle')}
               labelId="shipment-vehicle-select-label"
               items={vehicles}
               selectedIds={selectedVehicleId ? [selectedVehicleId] : []}
               getId={(v) => v.id!}
               getLabel={(v) => v.name!}
               onSelect={handleSelect}
               shouldValidate={shouldValidate}
               disabled={disabled}
               multiple={false}
          />
     );
}
