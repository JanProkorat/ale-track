import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

type ShipmentDeliveryDatePickerProps = {
     selectedDeliveryDate: Date | null | undefined;
     onDatePicked: (date: Date | null | undefined) => void;
     disabled?: boolean;
     shouldValidate?: boolean;
};

export function ShipmentDeliveryDatePicker({
     selectedDeliveryDate,
     onDatePicked,
     disabled,
     shouldValidate,
}: Readonly<ShipmentDeliveryDatePickerProps>) {
     const { t } = useTranslation();

     const [deliveryDatePickerOpen, setDeliveryDatePickerOpen] = useState<boolean>(false);

     return (
          <DatePicker
               disabled={disabled}
               label={t('outgoingShipments.deliveryDate')}
               value={selectedDeliveryDate ? dayjs(selectedDeliveryDate) : null}
               onChange={(value) => onDatePicked(value ? value.toDate() : null)}
               open={deliveryDatePickerOpen}
               onOpen={() => setDeliveryDatePickerOpen(true)}
               onClose={() => setDeliveryDatePickerOpen(false)}
               slots={{
                    textField: (props) => (
                         <TextField
                              {...props}
                              onFocus={() => setDeliveryDatePickerOpen(true)}
                              error={shouldValidate && !selectedDeliveryDate}
                              InputProps={{
                                   ...props.InputProps,
                                   endAdornment: (
                                        <>
                                             {selectedDeliveryDate && (
                                                  <button
                                                       type="button"
                                                       onClick={() => onDatePicked(null)}
                                                       style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            marginRight: 4,
                                                       }}
                                                  >
                                                       ✕
                                                  </button>
                                             )}
                                             {props.InputProps?.endAdornment}
                                        </>
                                   ),
                              }}
                         />
                    ),
               }}
               enableAccessibleFieldDOMStructure={false}
               sx={{ mt: 1, minWidth: '30%' }}
               minDate={dayjs().startOf('day')}
          />
     );
}
