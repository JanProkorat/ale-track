import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

import { ReminderType } from '../../../../api/Client';
import { mapEnumValue } from '../../../../utils/format-enum-value';

type ReminderTypeSelectProps = {
     selectedType: ReminderType | string | undefined;
     errors: Record<string, string>;
     onSelect: (type: ReminderType) => void;
     disabled?: boolean;
};

export function ReminderTypeSelect({ selectedType, errors, onSelect, disabled }: Readonly<ReminderTypeSelectProps>) {
     const { t } = useTranslation();

     const enumValue = mapEnumValue<ReminderType>(ReminderType, selectedType);

     return (
          <FormControl fullWidth sx={{ maxWidth: '30%' }} error={!!errors.type}>
               <InputLabel id="reminder-type-basic-select-label">{t('reminders.type')}</InputLabel>
               <Select
                    disabled={disabled}
                    labelId="reminder-type-basic-select-label"
                    value={enumValue ?? ''}
                    renderValue={() =>
                         enumValue !== undefined && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                   <Chip
                                        key={enumValue}
                                        label={t('reminderType.' + ReminderType[enumValue])}
                                        size="small"
                                   />
                              </Box>
                         )
                    }
               >
                    {Object.keys(ReminderType)
                         .filter((key) => isNaN(Number(key)))
                         .map((typeKey) => {
                              const itemEnumValue = ReminderType[typeKey as keyof typeof ReminderType];
                              return (
                                   <MenuItem
                                        key={typeKey}
                                        value={itemEnumValue}
                                        onClick={() => {
                                             onSelect(itemEnumValue);
                                        }}
                                   >
                                        <Checkbox checked={enumValue === itemEnumValue} />
                                        <ListItemText primary={t('reminderType.' + typeKey)} />
                                   </MenuItem>
                              );
                         })}
               </Select>
          </FormControl>
     );
}
