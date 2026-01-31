import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { InputLabel, FormControl, OutlinedInput } from '@mui/material';

type WeightInfoBoxProps = {
  currentWeight: number | undefined;
  maxWeight: number | undefined;
};

export function WeightInfoBox({currentWeight, maxWeight}: Readonly<WeightInfoBoxProps>) {
  const { t } = useTranslation();

  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (currentWeight !== undefined && maxWeight !== undefined) {
      setValue(`${currentWeight} / ${maxWeight}`);
    } else if (currentWeight !== undefined && maxWeight === undefined) {
      setValue(`${currentWeight} / __`);
    } else if (currentWeight === undefined && maxWeight !== undefined) {
      setValue(`0 / ${maxWeight}`);
    } else {
      setValue('');
    }
  }, [currentWeight, maxWeight]);
  
  return (
    <FormControl disabled error={currentWeight !== undefined && maxWeight !== undefined && currentWeight > maxWeight} fullWidth sx={{ mt: 1 }}>
      <InputLabel htmlFor="shipment-weight">{t('outgoingShipments.weight') + ' (Kg)'}</InputLabel>
      <OutlinedInput
        id="shipment-weight"
        value={value}
        label={t('outgoingShipments.weight') + ' (Kg)'}
      />
    </FormControl>
  );
}