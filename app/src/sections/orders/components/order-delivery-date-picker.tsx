import dayjs from "dayjs";
import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import TextField from "@mui/material/TextField";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";

type OrderDeliveryDatePickerProps = {
    selectedDeliveryDate: Date | undefined;
    onDatePicked: (date: Date | undefined) => void;
    disabled?: boolean;
}

export function OrderDeliveryDatePicker({selectedDeliveryDate, onDatePicked, disabled}: Readonly<OrderDeliveryDatePickerProps>) {
    const {t} = useTranslation();

    const [deliveryDatePickerOpen, setDeliveryDatePickerOpen] = useState<boolean>(false);

    return (
        <DatePicker
            disabled={disabled}
            label={t('orders.deliveryDate')}
            value={selectedDeliveryDate ? dayjs(selectedDeliveryDate) : null}
            onChange={(value) => onDatePicked(value ? value.toDate() : undefined)}
            open={deliveryDatePickerOpen}
            onOpen={() => setDeliveryDatePickerOpen(true)}
            onClose={() => setDeliveryDatePickerOpen(false)}
            slots={{
                textField: (props) => (
                    <TextField
                        {...props}
                        fullWidth
                        onFocus={() => setDeliveryDatePickerOpen(true)}
                        InputProps={{
                            ...props.InputProps,
                            endAdornment: (
                                <>
                                    {selectedDeliveryDate && (
                                        <button
                                            type="button"
                                            onClick={() => onDatePicked(undefined)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 0,
                                                marginRight: 4
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                    {props.InputProps?.endAdornment}
                                </>
                            )
                        }}
                    />
                )
            }}
            enableAccessibleFieldDOMStructure={false}
            minDate={dayjs().startOf('day')}

        />
    )
}