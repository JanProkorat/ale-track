import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Box, Chip, Select, InputLabel, FormControl} from "@mui/material";

import type {BreweryDto} from "../../../api/Client";

type BrewerySelectProps = {
    selectedBreweryId: string | undefined,
    breweries: BreweryDto[],
    shouldValidate: boolean,
    onBrewerySelected: (breweryId: string | undefined, breweryName: string) => void,
    disabled?: boolean
}

export function BrewerySelect(
    {
        selectedBreweryId,
        breweries,
        shouldValidate,
        onBrewerySelected,
        disabled,
    }: Readonly<BrewerySelectProps>) {
    const {t} = useTranslation();

    const [breweryTouched, setBreweryTouched] = useState<boolean>(false);

    return (
        <FormControl fullWidth sx={{mt: 1}} error={(breweryTouched || shouldValidate) && !selectedBreweryId}>
            <InputLabel id="brewery-select-label">{t('productDeliveries.brewery')}</InputLabel>
            <Select
                disabled={disabled}
                labelId="brewery-select-id"
                value={selectedBreweryId ?? ""}
                renderValue={() => selectedBreweryId !== undefined &&
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                        <Chip key={selectedBreweryId}
                              label={breweries.find(brewery => brewery.id === selectedBreweryId)?.name ?? ""}
                              size="small"/>
                    </Box>}
            >
                {breweries.map((brewery) => (
                    <MenuItem
                        key={brewery.id}
                        value={brewery.id}
                        onClick={() => {
                            setBreweryTouched(true);
                            onBrewerySelected(
                                brewery.id == selectedBreweryId ? undefined : brewery.id,
                                brewery.id == selectedBreweryId ? "" : brewery.name ?? "");
                        }}>
                        <Checkbox checked={brewery.id === selectedBreweryId}/>
                        <ListItemText primary={brewery.name}/>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}