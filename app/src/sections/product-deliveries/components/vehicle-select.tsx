import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import {type VehicleDto} from "../../../api/Client";

type VehicleSelectProps = {
    selectedVehicleId: string | undefined,
    vehicles: VehicleDto[],
    shouldValidate: boolean,
    onSelect: (vehicleId: string) => void,
    disabled?: boolean
}

export function VehicleSelect({selectedVehicleId, vehicles, shouldValidate, onSelect, disabled}: Readonly<VehicleSelectProps>) {
    const {t} = useTranslation();
    const [vehiclesTouched, setVehiclesTouched] = useState<boolean>(false);

    return (
        <FormControl fullWidth sx={{ mt: 1 }} error={(vehiclesTouched || shouldValidate) && !selectedVehicleId}>
            <InputLabel id="velicle-select-label">{t('productDeliveries.selectedVehicle')}</InputLabel>
            <Select
                disabled={disabled}
                labelId="velicle-select-id"
                value={selectedVehicleId ?? ''}
                renderValue={() => selectedVehicleId !== undefined &&
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip key={selectedVehicleId} label={vehicles.find(vehicle => vehicle.id === selectedVehicleId)?.name ?? ""} size="small"/>
                    </Box>}
            >
                {vehicles.map((vehicle) => (
                    <MenuItem
                        key={vehicle.id}
                        value={vehicle.id}
                        onClick={() => {
                            setVehiclesTouched(true);
                            onSelect(vehicle.id!)
                        }}>
                        <Checkbox checked={selectedVehicleId === vehicle.id} />
                        <ListItemText primary={vehicle.name} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}