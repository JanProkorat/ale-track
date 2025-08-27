import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import type { DriverDto} from "../../../api/Client";

type DriversSelectProps = {
    selectedDriverIds: string[] | undefined
    drivers: DriverDto[],
    shouldValidate: boolean,
    onSelect: (driverIds: string[]) => void,
    disabled?: boolean
}

export function DriversSelect({selectedDriverIds, drivers, shouldValidate, onSelect, disabled}: Readonly<DriversSelectProps>) {
    const {t} = useTranslation();

    const [driversTouched, setDriversTouched] = useState<boolean>(false);


    return (<FormControl fullWidth sx={{ mt: 1 }} error={(driversTouched || shouldValidate) && (!selectedDriverIds || selectedDriverIds.length === 0)}>
        <InputLabel id="driver-select-label">{t('productDeliveries.selectedDrivers')}</InputLabel>
        <Select
            multiple
            disabled={disabled}
            value={selectedDriverIds}
            onChange={(e) => {
                setDriversTouched(true);
                onSelect(e.target.value as string[]);
            }}
            renderValue={(selected) => (
                <Box
                    sx={{
                        margin: 0,
                        display: 'flex',
                        flexWrap: 'nowrap',
                        gap: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        alignItems: 'center',
                    }}
                >
                    {selected.map((value) => {
                        const driver = drivers.find(d => d.id === value);
                        return (
                            <Chip
                                key={value}
                                label={driver?.firstName + " " + driver?.lastName}
                                size="small"
                                sx={{ maxWidth: '100%' }}
                            />
                        );
                    })}
                </Box>
            )}
        >
            {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                    <Checkbox checked={selectedDriverIds!.includes(driver.id!)} />
                    <ListItemText primary={driver.firstName + " " + driver.lastName} />
                </MenuItem>
            ))}
        </Select>
    </FormControl>);
}