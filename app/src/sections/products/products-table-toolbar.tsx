import React from "react";
import {useTranslation} from "react-i18next";

import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";

import {ProductType} from "../../api/Client";
import {Iconify} from "../../components/iconify";
import {TableToolbar} from "../../components/table/table-toolbar";
import {ProductTypeSelect} from "./detail-view/components/product-type-select";

type ProductsTableToolbarProps = {
    numSelected: number;
    filterName: string;
    filterType: ProductType | undefined;
    onFilterType: (newType: ProductType | undefined) => void;
    onFilterName: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ProductsTableToolbar(
    {
        numSelected,
        filterName,
        onFilterName,
        filterType,
        onFilterType
    }: Readonly<ProductsTableToolbarProps>) {
    const { t } = useTranslation();
    const filters = [
        <OutlinedInput
            key="product"
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
