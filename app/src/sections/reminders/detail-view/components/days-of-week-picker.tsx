import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import FormControlLabel from '@mui/material/FormControlLabel';
import { Checkbox, FormGroup, FormLabel, FormControl } from '@mui/material';

import { DayOfWeek } from '../../../../api/Client';
import { mapEnumValue } from '../../../../utils/format-enum-value';

type DayOfWeekPickerProps = {
     selectedDays: DayOfWeek[];
     onDaysOfWeekPicked: (days: DayOfWeek[]) => void;
     errors: Record<string, string>;
};

export function DaysOfWeekPicker({ selectedDays, onDaysOfWeekPicked, errors }: Readonly<DayOfWeekPickerProps>) {
     const { t } = useTranslation();

     const orderedDays: DayOfWeek[] = [
          DayOfWeek.Monday,
          DayOfWeek.Friday,
          DayOfWeek.Tuesday,
          DayOfWeek.Saturday,
          DayOfWeek.Wednesday,
          DayOfWeek.Sunday,
          DayOfWeek.Thursday,
     ];

     const [days, setDays] = useState<DayOfWeek[]>([]);

     useEffect(() => {
          setDays(selectedDays.map((day) => mapEnumValue<DayOfWeek>(DayOfWeek, day)!));
     }, [selectedDays]);

     return (
          <FormControl
               required
               fullWidth
               error={!!errors.daysOfWeek}
               component="fieldset"
               sx={{
                    border: '1px solid',
                    borderColor: (theme) => (errors.daysOfWeek ? theme.palette.error.main : theme.palette.grey[300]),
                    borderRadius: 1,
                    p: 1,
                    pl: 2,
               }}
          >
               <FormLabel component="legend">{t('reminders.daysToDisplay')}</FormLabel>
               <FormGroup
                    sx={{
                         display: 'grid',
                         gridTemplateColumns: 'repeat(2, 1fr)',
                    }}
               >
                    {orderedDays.map((dayOfWeek) => (
                         <FormControlLabel
                              key={dayOfWeek}
                              control={
                                   <Checkbox
                                        checked={days.includes(dayOfWeek)}
                                        onChange={(event) => {
                                             const checked = event.target.checked;
                                             const updated = checked
                                                  ? [...days, dayOfWeek]
                                                  : days.filter((d) => d !== dayOfWeek);
                                             onDaysOfWeekPicked(updated);
                                        }}
                                   />
                              }
                              label={t('dayOfWeek.' + DayOfWeek[dayOfWeek])}
                              sx={{
                                   color: errors.daysOfWeek ? 'error.main' : 'text.primary',
                              }}
                         />
                    ))}
               </FormGroup>
          </FormControl>
     );
}
