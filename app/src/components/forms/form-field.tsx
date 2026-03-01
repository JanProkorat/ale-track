import type { ReactNode } from 'react';
import type { SxProps } from '@mui/material';

import { InputLabel, FormControl, OutlinedInput, FormHelperText, InputAdornment } from '@mui/material';

type FormFieldProps = {
     id: string;
     label: string;
     value: string | number;
     onChange: (value: string) => void;
     error?: string;
     type?: 'text' | 'number';
     endAdornment?: ReactNode;
     sx?: SxProps;
     disabled?: boolean;
};

export function FormField({
     id,
     label,
     value,
     onChange,
     error,
     type = 'text',
     endAdornment,
     sx,
     disabled,
}: Readonly<FormFieldProps>) {
     return (
          <FormControl fullWidth error={!!error} sx={sx}>
               <InputLabel htmlFor={id}>{label}</InputLabel>
               <OutlinedInput
                    id={id}
                    type={type}
                    value={value}
                    label={label}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                    endAdornment={
                         endAdornment ? <InputAdornment position="end">{endAdornment}</InputAdornment> : undefined
                    }
               />
               {error && <FormHelperText>{error}</FormHelperText>}
          </FormControl>
     );
}
