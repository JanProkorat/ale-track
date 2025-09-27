import dayjs from "dayjs";
import React, {useState} from "react";

import TextField from "@mui/material/TextField";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";

type ReminderDatePickerProps = {
    selectedDate: Date | undefined,
    onDatePicked: (date: Date) => void,
    label: string,
    sx?: { minWidth: string }
}

export function ReminderDatePicker({selectedDate, onDatePicked, label, sx}: Readonly<ReminderDatePickerProps>) {

    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

    return (
        <DatePicker
            label={label}
            value={dayjs(selectedDate)}
            onChange={value => onDatePicked(value!.toDate())}
            open={isDatePickerOpen}
            onOpen={() => setIsDatePickerOpen(true)}
            onClose={() => setIsDatePickerOpen(false)}
            slots={{
                textField: (props) => <TextField{...props} onFocus={() => setIsDatePickerOpen(true)}/>
            }}
            enableAccessibleFieldDOMStructure={false}
            minDate={dayjs().startOf('day')}
            sx={sx}
        />
    )
}