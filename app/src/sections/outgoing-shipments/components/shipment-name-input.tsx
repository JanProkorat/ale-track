import { useTranslation } from 'react-i18next';

import { InputLabel, FormControl, OutlinedInput } from '@mui/material';

type ShipmentNameInputProps = {
     shipmentName: string;
     shouldValidate: boolean;
     onNameChange: (newName: string) => void;
     disabled?: boolean;
};

export function ShipmentNameInput({
     shipmentName,
     shouldValidate,
     onNameChange,
     disabled,
}: Readonly<ShipmentNameInputProps>) {
     const { t } = useTranslation();

     return (
          <FormControl disabled={disabled} fullWidth error={shouldValidate && shipmentName === ''}>
               <InputLabel htmlFor="shipment-name">{t('outgoingShipments.name')}</InputLabel>
               <OutlinedInput
                    id="shipment-name"
                    value={shipmentName}
                    onChange={(e) => onNameChange(e.target.value)}
                    label={t('outgoingShipments.name')}
               />
          </FormControl>
     );
}
