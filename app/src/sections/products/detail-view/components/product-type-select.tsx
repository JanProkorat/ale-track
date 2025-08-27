import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import type {ProductType} from "../../../../api/Client";

type ProductTypeSelectProps = {
    selectedType: ProductType | undefined;
    types: ProductType[];
    shouldValidate: boolean;
    onSelect: (type: ProductType) => void;
}

export function ProductTypeSelect({selectedType, types, onSelect, shouldValidate}: Readonly<ProductTypeSelectProps>) {
    const {t} = useTranslation();
    const [typesTouched, setTypesTouched] = useState<boolean>(false);

    return (
        <FormControl fullWidth sx={{ mt: 1 }} error={(typesTouched || shouldValidate) && !selectedType}>
            <InputLabel id="type-select-label">{t('products.type')}</InputLabel>
            <Select
                labelId="type-select-id"
                value={selectedType ?? ''}
                renderValue={() => selectedType !== undefined &&
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip key={selectedType} label={t('productType.' + selectedType)} size="small"/>
                    </Box>}
            >
                {types.map((type) => (
                    <MenuItem
                        key={type}
                        value={type}
                        onClick={() => {
                            setTypesTouched(true);
                            onSelect(type)
                        }}>
                        <Checkbox checked={selectedType === type} />
                        <ListItemText primary={t('productType.' + type)} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}