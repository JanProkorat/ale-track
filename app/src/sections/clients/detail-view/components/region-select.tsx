import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

import { Region } from '../../../../api/Client';
import { mapEnumValue } from '../../../../utils/format-enum-value';

type RegionSelectProps = {
     selectedRegion: Region | string | undefined;
     errors: Record<string, string>;
     onSelect: (region: Region) => void;
     disabled?: boolean;
     maxWidth?: number;
};

export function RegionSelect({ selectedRegion, errors, onSelect, disabled, maxWidth }: Readonly<RegionSelectProps>) {
     const { t } = useTranslation();

     const enumValue = mapEnumValue<Region>(Region, selectedRegion);

     return (
          <FormControl
               fullWidth
               sx={{ maxWidth: maxWidth != undefined ? `${maxWidth}%` : '15%', mt: 1 }}
               error={!!errors.region}
          >
               <InputLabel id="region-select-label">{t('clients.region')}</InputLabel>
               <Select
                    disabled={disabled}
                    labelId="region-select-label"
                    value={enumValue ?? ''}
                    renderValue={() =>
                         enumValue !== undefined && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                   <Chip key={enumValue} label={t('region.' + Region[enumValue])} size="small" />
                              </Box>
                         )
                    }
               >
                    {Object.keys(Region)
                         .filter((key) => isNaN(Number(key)))
                         .map((regionKey) => {
                              const itemEnumValue = Region[regionKey as keyof typeof Region];
                              return (
                                   <MenuItem
                                        key={regionKey}
                                        value={itemEnumValue}
                                        onClick={() => {
                                             onSelect(itemEnumValue);
                                        }}
                                   >
                                        <Checkbox checked={enumValue === itemEnumValue} />
                                        <ListItemText primary={t('region.' + regionKey)} />
                                   </MenuItem>
                              );
                         })}
               </Select>
          </FormControl>
     );
}
