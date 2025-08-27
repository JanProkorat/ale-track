import React from "react";
import { useTranslation } from 'react-i18next';

import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";

import {Iconify} from 'src/components/iconify';

import {TableToolbar} from "../../components/table/table-toolbar";

type BreweriesTableToolbarProps = {
    numSelected: number;
    filterName: string;
    onFilterName: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function BreweriesTableToolbar(
    {
        numSelected,
        filterName,
        onFilterName,
    }: Readonly<BreweriesTableToolbarProps>) {
    const { t } = useTranslation();
    const filters = [
        <OutlinedInput
            key="brewery"
            fullWidth
            value={filterName}
            onChange={onFilterName}
            placeholder={t('breweries.name') + `...`}
            startAdornment={
                <InputAdornment position="start">
                    <Iconify width={20} icon="eva:search-fill" sx={{color: 'text.disabled'}}/>
                </InputAdornment>
            }
        />
    ];

    return <TableToolbar numSelected={numSelected} filters={filters}/>;
}
