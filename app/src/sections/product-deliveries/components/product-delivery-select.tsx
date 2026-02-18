import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

import { formatDate } from '../../../locales/formatDate';

import type { ProductDeliveryListItemDto } from '../../../api/Client';

type ProductDeliverySelectProps = {
     deliveries: ProductDeliveryListItemDto[];
     selectedDeliveryId: string | undefined;
     onSelect: (deliveryId: string) => void;
};

export function ProductDeliverySelect({
     deliveries,
     selectedDeliveryId,
     onSelect,
}: Readonly<ProductDeliverySelectProps>) {
     const { t } = useTranslation();

     return (
          <FormControl fullWidth sx={{ mt: 1 }}>
               <InputLabel id="delivery-select-label">{t('productDeliveries.title')}</InputLabel>
               <Select
                    labelId="delivery-select-label"
                    value={selectedDeliveryId ?? ''}
                    renderValue={() => {
                         if (selectedDeliveryId !== undefined) {
                              const selected = deliveries.find((d) => d.id === selectedDeliveryId);
                              if (!selected) return null;
                              return (
                                   <Chip
                                        label={`${formatDate(selected.deliveryDate!)} - ${(selected.stopNames ?? []).join(', ')}`}
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
                    {deliveries.map((delivery) => (
                         <MenuItem
                              key={delivery.id}
                              value={delivery.id}
                              onClick={() => onSelect(delivery.id!)}
                              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
                         >
                              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
                                   <Checkbox checked={selectedDeliveryId === delivery.id} />
                                   <ListItemText
                                        primary={`${formatDate(delivery.deliveryDate!)} - ${(delivery.stopNames ?? []).join(', ')}`}
                                        sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                   />
                              </Box>
                              <Chip
                                   label={t('deliveryState.' + delivery.state)}
                                   size="small"
                                   sx={{ flexShrink: 0, ml: 1 }}
                              />
                         </MenuItem>
                    ))}
               </Select>
          </FormControl>
     );
}
