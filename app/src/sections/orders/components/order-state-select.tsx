import React from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import {OrderState} from "../../../api/Client";

type OrderStateSelectProps = {
    selectedState: OrderState | null,
    nullable?: boolean,
    disabled?: boolean,
    onSelect: (state: OrderState | null) => void,
}

export function OrderStateSelect({selectedState, nullable, disabled, onSelect}: Readonly<OrderStateSelectProps>) {
    const {t} = useTranslation();

    return (
        <FormControl fullWidth>
            <InputLabel id="state-select-label">{t('orders.state')}</InputLabel>
            <Select
                disabled={disabled}
                labelId="orders-state-select-id"
                value={selectedState ?? ''}
                renderValue={() => selectedState !== undefined &&
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip key={selectedState} label={t('orderState.' + selectedState)} size="small"/>
                    </Box>}
            >
                {Object.keys(OrderState).filter(key => isNaN(Number(key))).map((state) => {
                    const enumState = state as unknown as OrderState;

                    return (
                        <MenuItem
                            key={state}
                            value={enumState}
                            onClick={() => onSelect(nullable ? (enumState == selectedState ? null : enumState) : enumState)}>
                            <Checkbox checked={selectedState === enumState} />
                            <ListItemText primary={t('orderState.' + state)} />
                        </MenuItem>
                    )
                })}
            </Select>
        </FormControl>
    )
}