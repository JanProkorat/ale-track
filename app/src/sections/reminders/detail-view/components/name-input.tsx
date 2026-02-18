import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InputLabel, FormControl, OutlinedInput } from '@mui/material';

type NameInputProps = {
     name: string;
     setName: (name: string) => void;
     errors: Record<string, string>;
};

export function NameInput({ name, setName, errors }: Readonly<NameInputProps>) {
     const { t } = useTranslation();
     const [touched, setTouched] = useState<boolean>(false);

     return (
          <FormControl fullWidth error={(touched && name == '') || !!errors.name}>
               <InputLabel htmlFor="reminder-name">{t('reminders.name')}</InputLabel>
               <OutlinedInput
                    id="reminder-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => {
                         if (!touched) setTouched(true);
                    }}
                    label={t('reminders.name')}
               />
          </FormControl>
     );
}
