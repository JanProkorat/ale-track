import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

import { OutgoingShipmentState } from '../../../api/Client';

type ShipmentStateSelectProps = {
  selectedState: OutgoingShipmentState;
  onSelect: (value: OutgoingShipmentState) => void;
};

export function ShipmentStateSelect({ selectedState, onSelect }: Readonly<ShipmentStateSelectProps>) {
  const { t } = useTranslation();

  return (
    <FormControl fullWidth sx={{ mt: 1 }}>
      <InputLabel id="shipment-state-select-label">{t('productDeliveries.state')}</InputLabel>
      <Select
        labelId="shipment-state-select-id"
        value={selectedState ?? ''}
        renderValue={() =>
          selectedState !== undefined && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                key={selectedState}
                label={t('outgoingShipmentState.' + selectedState)}
                size="small"
              />
            </Box>
          )
        }
      >
        {Object.values(OutgoingShipmentState)
          .filter((value) => isNaN(Number(value)))
          .map((state) => (
            <MenuItem
              key={state}
              value={state}
              onClick={() => {
                onSelect(state as OutgoingShipmentState);
              }}
            >
              <Checkbox checked={selectedState === state} />
              <ListItemText primary={t('outgoingShipmentState.' + state)} />
            </MenuItem>
          ))}
      </Select>
    </FormControl>
  );
}