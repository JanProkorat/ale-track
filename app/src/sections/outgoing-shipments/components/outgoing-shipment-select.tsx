import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, Typography, FormControl } from '@mui/material';

import { formatDate } from '../../../locales/formatDate';

import type { OutgoingShipmentListItemDto } from '../../../api/Client';

type OutgoingShipmentSelectProps = {
  shipments: OutgoingShipmentListItemDto[];
  selectedShipmentId: string | undefined;
  onSelect: (shipmentId: string) => void
}

export function OutgoingShipmentSelect({shipments, selectedShipmentId, onSelect}: Readonly<OutgoingShipmentSelectProps>){
  const {t} = useTranslation();

  return (
    <FormControl fullWidth sx={{ mt: 1 }}>
      <InputLabel id="shipment-select-label">{t('outgoingShipments.title')}</InputLabel>
      <Select
        labelId="shipment-select-label"
        value={selectedShipmentId ?? ''}
        renderValue={() => {
          if (selectedShipmentId !== undefined) {
            const selected = shipments.find((d) => d.id === selectedShipmentId);
            if (!selected) return null;
            return (
              <Chip
                label={`${selected.name} ${selected.deliveryDate ? '- ' + formatDate(selected.deliveryDate!) : ''}`}
                size="small"
                sx={{
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              />
            );
          }
          return null;
        }}
      >
        {shipments.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {t('outgoingShipments.noShipmentsToDisplay')}
            </Typography>
          </MenuItem>
        ) : (
          shipments.map((shipment) => (
            <MenuItem
              key={shipment.id}
              value={shipment.id}
              onClick={() => onSelect(shipment.id!)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
                <Checkbox checked={selectedShipmentId === shipment.id} />
                <ListItemText
                  primary={`${shipment.name} ${shipment.deliveryDate ? ' - ' + formatDate(shipment.deliveryDate!) : ''}`}
                  sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                />
              </Box>
              <Chip
                label={t('outgoingShipmentState.' + shipment.state)}
                size="small"
                sx={{ flexShrink: 0, ml: 1 }}
              />
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
}