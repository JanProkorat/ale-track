import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

import type { VehicleDto } from '../../../api/Client';

type ShipmentVehicleSelectProps = {
  vehicles: VehicleDto[],
  selectedVehicleId: string | undefined,
  shouldValidate: boolean,
  onSelect: (vehicleId: string | undefined, maxWeight: number | undefined) => void,
  disabled?: boolean
}

export function ShipmentVehicleSelect({vehicles, selectedVehicleId, shouldValidate, onSelect, disabled}: Readonly<ShipmentVehicleSelectProps>) {
  const { t } = useTranslation();

  return (
    <FormControl fullWidth sx={{ mt: 1 }} error={shouldValidate && !selectedVehicleId}>
      <InputLabel id="shipment-velicle-select-label">{t('outgoingShipments.vehicle')}</InputLabel>
      <Select
        disabled={disabled}
        labelId="shipment-velicle-select-id"
        value={selectedVehicleId ?? ''}
        renderValue={() => selectedVehicleId !== undefined &&
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Chip key={selectedVehicleId} label={vehicles.find(vehicle => vehicle.id === selectedVehicleId)?.name ?? ""} size="small"/>
          </Box>}
      >
        {vehicles.map((vehicle) => (
          <MenuItem
            key={vehicle.id}
            value={vehicle.id}
            onClick={() => {
              onSelect(
                vehicle.id === selectedVehicleId ? undefined : vehicle.id,
                vehicle.id === selectedVehicleId ? undefined : vehicle.maxWeight
              );
            }}>
            <Checkbox checked={selectedVehicleId === vehicle.id} />
            <ListItemText primary={vehicle.name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}