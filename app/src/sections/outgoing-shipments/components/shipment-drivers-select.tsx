import { useTranslation } from 'react-i18next';

import { MultiSelect } from 'src/components/forms/multi-select';

import type { DriverDto } from '../../../api/Client';

type ShipmentDriversSelectProps = {
  drivers: DriverDto[],
  selectedDriverIds: string[],
  shouldValidate: boolean,
  onSelect: (driverIds: string[]) => void,
  disabled?: boolean
}

export function ShipmentDriversSelect({drivers, selectedDriverIds, shouldValidate, onSelect, disabled}: Readonly<ShipmentDriversSelectProps>) {
  const {t} = useTranslation();

  return (
    <MultiSelect
      label={t('outgoingShipments.drivers')}
      labelId="shipment-driver-select-label"
      items={drivers}
      selectedIds={selectedDriverIds}
      getId={(d) => d.id!}
      getLabel={(d) => `${d.firstName} ${d.lastName}`}
      onSelect={onSelect}
      shouldValidate={shouldValidate}
      disabled={disabled}
    />
  );
}
