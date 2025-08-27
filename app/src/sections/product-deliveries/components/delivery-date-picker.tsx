import dayjs from "dayjs";
import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import TextField from "@mui/material/TextField";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";

type DeliveryDatePickerProps = {
    selectedDeliveryDate: Date | undefined;
    onDatePicked: (date: Date) => void;
    disabled?: boolean;
}

export function DeliveryDatePicker({selectedDeliveryDate, onDatePicked, disabled}: Readonly<DeliveryDatePickerProps>) {
    const {t} = useTranslation();

    const [deliveryDatePickerOpen, setDeliveryDatePickerOpen] = useState<boolean>(false);

    return (
        <DatePicker
            disabled={disabled}
            label={t('productDeliveries.deliveryDate')}
            value={dayjs(selectedDeliveryDate)}
            onChange={value => onDatePicked(value!.toDate())}
            open={deliveryDatePickerOpen}
            onOpen={() => setDeliveryDatePickerOpen(true)}
            onClose={() => setDeliveryDatePickerOpen(false)}
            slots={{
                textField: (props) => <TextField{...props} onFocus={() => setDeliveryDatePickerOpen(true)}/>
            }}
            enableAccessibleFieldDOMStructure={false}
            sx={{ mt: 1, minWidth: '30%' }}
            minDate={dayjs().startOf('day')}
        />
    )
}