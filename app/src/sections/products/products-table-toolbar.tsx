import React from "react";
import {useTranslation} from "react-i18next";

import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";

import {Iconify} from "../../components/iconify";
import {TableToolbar} from "../../components/table/table-toolbar";

type ProductsTableToolbarProps = {
    numSelected: number;
    filterName: string;
    onFilterName: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ProductsTableToolbar(
    {
        numSelected,
        filterName,
        onFilterName,
    }: Readonly<ProductsTableToolbarProps>) {
    const { t } = useTranslation();
    const filters = [
        <OutlinedInput
            key="product"
            fullWidth
            value={filterName}
            onChange={onFilterName}
            placeholder={t('products.name')}
            startAdornment={
                <InputAdornment position="start">
                    <Iconify width={20} icon="eva:search-fill" sx={{color: 'text.disabled'}}/>
                </InputAdornment>
            }
        />
    ];

    return <TableToolbar numSelected={numSelected} filters={filters}/>;
}
