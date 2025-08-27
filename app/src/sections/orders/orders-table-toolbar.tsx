import React from "react";
import dayjs from "dayjs";
import {useTranslation} from "react-i18next";

import TextField from "@mui/material/TextField";
import OutlinedInput from "@mui/material/OutlinedInput";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";
import InputAdornment from "@mui/material/InputAdornment";

import {Iconify} from "../../components/iconify";
import {OrderStateSelect} from "./components/order-state-select";
import {TableToolbar} from "../../components/table/table-toolbar";

import type {OrderState} from "../../api/Client";

type OrdersToolbarProps = {
    numSelected: number;
    filterDate: Date | null;
    filterClientName: string | null;
    filterState: OrderState | null;
    onFilterState: (newState: OrderState | null) => void;
    onFilterClientName: (newName: string | null) => void;
    onFilterDate: (newDate: Date | undefined) => void;
};

export function OrdersTableToolbar(
    {
        numSelected,
        filterClientName,
        filterDate,
        filterState,
        onFilterClientName,
        onFilterDate,
        onFilterState
    }: Readonly<OrdersToolbarProps>) {
    const { t } = useTranslation();
    const pickerRef = React.useRef<any>(null);
    const [open, setOpen] = React.useState(false);

    const filters = [
        <OutlinedInput
            key="client"
            fullWidth
            value={filterClientName}
            onChange={(event) => onFilterClientName(event.target.value)}
            placeholder={t('breweries.name') + `...`}
            startAdornment={
                <InputAdornment position="start">
                    <Iconify width={20} icon="eva:search-fill" sx={{color: 'text.disabled'}}/>
                </InputAdornment>
            }
        />,
        <OrderStateSelect selectedState={filterState} onSelect={onFilterState} nullable />,
        <DatePicker
            key="delivery-date"
            disablePast
            label={t('orders.deliveryDate')}
            ref={pickerRef}
            value={filterDate ? dayjs(filterDate) : null}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            onChange={(value) => {
                onFilterDate(value ? value.toDate() : undefined);
                setOpen(false);
            }}
            enableAccessibleFieldDOMStructure={false}
            slots={{
                textField: (props) => (
                    <TextField
                        {...props}
                        fullWidth
                        onFocus={() => setOpen(true)}
                        InputProps={{
                            ...props.InputProps,
                            endAdornment: (
                                <>
                                    {filterDate && (
                                        <button
                                            type="button"
                                            onClick={() => onFilterDate(undefined)}
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
        />
    ];

    return <TableToolbar numSelected={numSelected} filters={filters}/>;
}