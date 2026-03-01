import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

import { ReminderRecurrenceType } from 'src/api/Client';

type ReminderRecurrenceTypeSelectProps = {
     selectedType: ReminderRecurrenceType;
     errors: Record<string, string>;
     onSelect: (type: ReminderRecurrenceType) => void;
     disabled?: boolean;
};

export function ReminderRecurrenceTypeSelect({
     selectedType,
     errors,
     onSelect,
     disabled,
}: Readonly<ReminderRecurrenceTypeSelectProps>) {
     const { t } = useTranslation();

     return (
          <FormControl fullWidth sx={{ mt: 1 }} error={!!errors.recurrenceType}>
               <InputLabel id="reminder-recurrence-type-select-label">
                    {t('reminders.reminderRecurrenceType')}
               </InputLabel>
               <Select
                    disabled={disabled}
                    labelId="reminder-recurrence-type-select-label"
                    value={selectedType ?? ''}
                    renderValue={() =>
                         selectedType !== undefined && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                   <Chip
                                        key={selectedType}
                                        label={t('reminderRecurrenceType.' + ReminderRecurrenceType[selectedType])}
                                        size="small"
                                   />
                              </Box>
                         )
                    }
               >
                    {Object.keys(ReminderRecurrenceType)
                         .filter((key) => isNaN(Number(key)))
                         .map((typeKey) => {
                              const enumValue = ReminderRecurrenceType[typeKey as keyof typeof ReminderRecurrenceType];
                              return (
                                   <MenuItem key={typeKey} value={enumValue} onClick={() => onSelect(enumValue)}>
                                        <Checkbox checked={selectedType === enumValue} />
                                        <ListItemText primary={t('reminderRecurrenceType.' + typeKey)} />
                                   </MenuItem>
                              );
                         })}
               </Select>
          </FormControl>
     );
}
