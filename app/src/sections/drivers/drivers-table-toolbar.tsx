import React from "react";
import {useTranslation} from "react-i18next";

import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";

import {Iconify} from "../../components/iconify";
import {TableToolbar} from "../../components/table/table-toolbar";

type DriversTableToolbarProps = {
    numSelected: number;
    filterFirstName: string;
    filterLastName: string;
    onFilterFirstName: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onFilterLastName: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function DriversTableToolbar(
    {
        numSelected,
        filterFirstName,
        filterLastName,
        onFilterFirstName,
        onFilterLastName
    }: Readonly<DriversTableToolbarProps>) {
    const { t } = useTranslation();
    const filters = [
        <OutlinedInput
            key="firstName"
            fullWidth
            value={filterFirstName}
            onChange={onFilterFirstName}
            placeholder={t('drivers.firstName') + '...'}
            startAdornment={
                <InputAdornment position="start">
                    <Iconify width={20} icon="eva:search-fill" sx={{color: 'text.disabled'}}/>
                </InputAdornment>
            }
        />,
        <OutlinedInput
            key="lastName"
            fullWidth
            value={filterLastName}
            onChange={onFilterLastName}
            placeholder={t('drivers.lastName') + '...'}
            startAdornment={
                <InputAdornment position="start">
                    <Iconify width={20} icon="eva:search-fill" sx={{color: 'text.disabled'}}/>
                </InputAdornment>
            }
        />
    ];

    return <TableToolbar numSelected={numSelected} filters={filters}/>;
}
