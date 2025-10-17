import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Box, Chip, Select, InputLabel, FormControl, ListSubheader} from "@mui/material";

import type {ProductListItemDto} from "../../../api/Client";

type OrderProductsSelectProps = {
    products: ProductListItemDto[];
    selectedProducts: {productId: string, quantity: number}[]
    shouldValidate: boolean,
    onProductsChanged: (products: {productId: string, quantity: number}[]) => void,
    disabled?: boolean
}

export function OrderProductsSelect({products, shouldValidate, selectedProducts, onProductsChanged, disabled}: Readonly<OrderProductsSelectProps>) {
    const {t} = useTranslation();

    const [productsTouched, setProductsTouched] = useState<boolean>(false);

    const groupedProducts = products.reduce((acc, product) => {
        const breweryId = product.breweryId || 'Unknown';
        const breweryName = product.breweryName || 'Unknown Brewery';
        const kind = product.kind || 'Other';
        const packageSize = product.packageSize || 0;

        if (!acc[breweryId]) {
            acc[breweryId] = {
                name: breweryName,
                kinds: {}
            };
        }
        if (!acc[breweryId].kinds[kind]) {
            acc[breweryId].kinds[kind] = {};
        }
        if (!acc[breweryId].kinds[kind][packageSize]) {
            acc[breweryId].kinds[kind][packageSize] = [];
        }
        acc[breweryId].kinds[kind][packageSize].push(product);
        return acc;
    }, {} as Record<string, { name: string, kinds: Record<string, Record<number, ProductListItemDto[]>> }>);

    // Seřadit brewery podle názvu
    const sortedBreweries = Object.keys(groupedProducts).sort((a, b) =>
        groupedProducts[a].name.localeCompare(groupedProducts[b].name)
    );

    return (
        <FormControl fullWidth error={(productsTouched || shouldValidate) && (selectedProducts.length === 0)}>
            <InputLabel id="order-products-select-label">{t('products.title')}</InputLabel>
            <Select
                disabled={disabled}
                id="order-products-select"
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
                renderValue={(selected) => {
                    const maxVisibleChips = 4;
                    const visibleSelected = selected.slice(0, maxVisibleChips);
                    const remainingCount = selected.length - maxVisibleChips;

                    return (
                        <Box
                            sx={{
                                margin: 0,
                                display: 'flex',
                                flexWrap: 'nowrap',
                                gap: 0.5,
                                overflow: 'hidden',
                                alignItems: 'center',
                                minWidth: 0,
                            }}
                        >
                            {visibleSelected.map((value) => {
                                const product = products.find(d => d.id === (value ?? ""));
                                return (
                                    <Chip
                                        key={value}
                                        label={product?.name ?? ""}
                                        size="small"
                                        sx={{
                                            flexShrink: 0,
                                            maxWidth: '150px',
                                            '& .MuiChip-label': {
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }
                                        }}
                                    />
                                );
                            })}
                            {remainingCount > 0 && (
                                <Chip
                                    label={`+${remainingCount}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        flexShrink: 0,
                                        minWidth: 'auto',
                                    }}
                                />
                            )}
                        </Box>
                    );
                }}
            >
                {sortedBreweries.map((breweryId) => {
                    const brewery = groupedProducts[breweryId];
                    const sortedKinds = Object.keys(brewery.kinds).sort((a, b) => {
                        const kindA = parseInt(a);
                        const kindB = parseInt(b);
                        return kindA - kindB;
                    });

                    return [
                        <ListSubheader
                            key={`brewery-${breweryId}`}
                            sx={{
                                fontWeight: 'bold',
                                backgroundColor: 'background.paper',
                                fontSize: '1.1rem',
                                top: 0,
                                zIndex: 4,
                                color: 'primary.main',
                            }}
                        >
                            {brewery.name}
                        </ListSubheader>,
                        ...sortedKinds.flatMap((kind) => {
                            const packageSizes = Object.keys(brewery.kinds[kind]).sort((a, b) => parseFloat(a) - parseFloat(b));

                            return [
                                <ListSubheader
                                    key={`kind-${breweryId}-${kind}`}
                                    sx={{
                                        pl: 3,
                                        fontWeight: 'bold',
                                        backgroundColor: 'background.paper',
                                        fontSize: '0.95rem',
                                        top: '48px',
                                        zIndex: 3
                                    }}
                                >
                                    {t('productKind.' + kind)}
                                </ListSubheader>,
                                ...packageSizes.flatMap((packageSize) => {
                                    const size = parseFloat(packageSize);
                                    return [
                                        <ListSubheader
                                            key={`size-${breweryId}-${kind}-${packageSize}`}
                                            sx={{
                                                pl: 5,
                                                fontWeight: 'medium',
                                                backgroundColor: 'background.paper',
                                                fontSize: '0.875rem',
                                                top: '96px',
                                                zIndex: 2
                                            }}
                                        >
                                            {packageSize}L
                                        </ListSubheader>,
                                        ...brewery.kinds[kind][size].map((item) => (
                                            <MenuItem key={item.id} value={item.id} sx={{ pl: 7 }}>
                                                <Checkbox checked={selectedProducts.map(product => product.productId).includes(item.id!)}/>
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '2fr 1fr',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <ListItemText primary={item.name}/>
                                                    <Box sx={{display: 'flex', gap: 0.5, flexWrap: 'wrap'}}>
                                                        <Chip
                                                            key={"type" + item.id!}
                                                            label={t('productType.' + item.type)}
                                                            size="small"
                                                            sx={{maxWidth: '100%'}}
                                                        />
                                                    </Box>
                                                </Box>
                                            </MenuItem>
                                        ))
                                    ];
                                })
                            ];
                        })
                    ];
                })}
            </Select>
        </FormControl>
    )
}