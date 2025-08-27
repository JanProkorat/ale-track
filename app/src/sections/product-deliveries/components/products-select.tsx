import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Box, Chip, Select, InputLabel, FormControl} from "@mui/material";

import type {BreweryProductListItemDto} from "../../../api/Client";

type ProductsSelectProps = {
    products: BreweryProductListItemDto[],
    selectedProducts: {productId: string, quantity: number}[]
    shouldValidate: boolean,
    onProductsChanged: (products: {productId: string, quantity: number}[]) => void,
    disabled?: boolean
}

export function ProductsSelect({products, shouldValidate, selectedProducts, onProductsChanged, disabled}: Readonly<ProductsSelectProps>) {
    const {t} = useTranslation();

    const [productsTouched, setProductsTouched] = useState<boolean>(false);


    return (
        <FormControl fullWidth sx={{mt: 1}} error={(productsTouched || shouldValidate) && (selectedProducts.length === 0)}>
            <InputLabel id="products-select-label">{t('products.title')}</InputLabel>
            <Select
                disabled={disabled}
                id="products-select"
                multiple
                value={selectedProducts.map(p => p.productId)}
                onChange={(e) => {
                    setProductsTouched(true);
                    const selectedIds = e.target.value as string[];
                    const updatedProducts = selectedIds.map(id => {
                        const existing = selectedProducts.find(product => product.productId === id);
                        return existing ?? {productId: id, quantity: 1}
                    });
                    onProductsChanged(updatedProducts);
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
                            const product = products.find(d => d.id === (value ?? ""));
                            return (
                                <Chip
                                    key={value}
                                    label={product?.name ?? ""}
                                    size="small"
                                    sx={{maxWidth: '100%'}}
                                />
                            );
                        })}
                    </Box>
                )}
            >
                {products.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                        <Checkbox checked={selectedProducts.map(product => product.productId).includes(item.id!)}/>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 2fr',
                                alignItems: 'center',
                                width: '100%',
                                gap: 1,
                            }}
                        >
                            <ListItemText primary={item.name}/>
                            <ListItemText primary={item.packageSize + "L"}/>
                            <Box sx={{display: 'flex', gap: 0.5, flexWrap: 'wrap'}}>
                                <Chip
                                    key={"kind" + item.id!}
                                    label={t('productKind.' + item.kind)}
                                    size="small"
                                    sx={{maxWidth: '100%'}}
                                />
                                <Chip
                                    key={"type" + item.id!}
                                    label={t('productType.' + item.type)}
                                    size="small"
                                    sx={{maxWidth: '100%'}}
                                />
                            </Box>
                        </Box>

                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}