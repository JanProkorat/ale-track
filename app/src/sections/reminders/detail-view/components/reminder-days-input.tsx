import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';

import TextField from '@mui/material/TextField';

type ReminderDaysInputProps = {
     selectedValue: number;
     onSelectedValueChange: (value: number) => void;
     errors: Record<string, string>;
};

export function ReminderDaysInput({ selectedValue, onSelectedValueChange, errors }: Readonly<ReminderDaysInputProps>) {
     const { t } = useTranslation();
     const [internalValue, setInternalValue] = useState<string>('');

     useEffect(() => {
          setInternalValue(String(selectedValue));
     }, [selectedValue]);

     return (
          <TextField
               fullWidth
               error={!!errors.numberOfDaysToRemindBefore || internalValue === ''}
               sx={{ mt: 1 }}
               variant="outlined"
               type="number"
               label={t('reminders.numberOfDaysToRemindBefore')}
               value={internalValue}
               onChange={(event) => {
                    const val = event.target.value;
                    setInternalValue(val);

                    if (val !== '') {
                         onSelectedValueChange(Number(val));
                    }
               }}
          />
     );
}
