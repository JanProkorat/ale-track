import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import type {ProductDeliveryState} from "../../../api/Client";

type DeliveryStateSelectProps = {
    selectedState: ProductDeliveryState | undefined,
    states: ProductDeliveryState[],
    shouldValidate: boolean,
    onSelect: (state: ProductDeliveryState) => void,
    disabled?: boolean
}

export function DeliveryStateSelect({selectedState, states, shouldValidate, onSelect, disabled}: Readonly<DeliveryStateSelectProps>) {
    const {t} = useTranslation();
    const [vehiclesTouched, setVehiclesTouched] = useState<boolean>(false);

    return (
        <FormControl fullWidth sx={{ mt: 1 }} error={(vehiclesTouched || shouldValidate) && !selectedState}>
            <InputLabel id="state-select-label">{t('productDeliveries.state')}</InputLabel>
            <Select
                disabled={disabled}
                labelId="state-select-id"
                value={selectedState ?? ''}
                renderValue={() => selectedState !== undefined &&
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip key={selectedState} label={t('deliveryState.' + selectedState)} size="small"/>
                    </Box>}
            >
                {states.map((state) => (
                    <MenuItem
                        key={state}
                        value={state}
                        onClick={() => {
                            setVehiclesTouched(true);
                            onSelect(state)
                        }}>
                        <Checkbox checked={selectedState === state} />
                        <ListItemText primary={t('deliveryState.' + state)} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}