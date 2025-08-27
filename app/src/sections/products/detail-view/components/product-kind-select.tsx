import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import type {ProductKind} from "../../../../api/Client";

type ProductKindSelectProps = {
    selectedKind: ProductKind | undefined;
    kinds: ProductKind[];
    shouldValidate: boolean;
    onSelect: (kind: ProductKind) => void;
}

export function ProductKindSelect({selectedKind, kinds, onSelect, shouldValidate}: Readonly<ProductKindSelectProps>) {
    const {t} = useTranslation();
    const [kindsTouched, setKindsTouched] = useState<boolean>(false);

    return (
        <FormControl fullWidth sx={{ mt: 1 }} error={(kindsTouched || shouldValidate) && !selectedKind}>
            <InputLabel id="kind-select-label">{t('products.kind')}</InputLabel>
            <Select
                labelId="kind-select-id"
                value={selectedKind ?? ''}
                renderValue={() => selectedKind !== undefined &&
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip key={selectedKind} label={t('productKind.' + selectedKind)} size="small"/>
                    </Box>}
            >
                {kinds.map((kind) => (
                    <MenuItem
                        key={kind}
                        value={kind}
                        onClick={() => {
                            setKindsTouched(true);
                            onSelect(kind)
                        }}>
                        <Checkbox checked={selectedKind === kind} />
                        <ListItemText primary={t('productKind.' + kind)} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}