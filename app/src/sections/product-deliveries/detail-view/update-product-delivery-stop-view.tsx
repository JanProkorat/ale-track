import {uuidv4} from "minimal-shared";
import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import {Collapse, IconButton, Typography} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import {Iconify} from "../../../components/iconify";
import {Scrollbar} from "../../../components/scrollbar";
import {BrewerySelect} from "../components/brewery-select";
import {ProductsSelect} from "../components/products-select";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import { UpdateProductDeliveryItemDto
} from "../../../api/Client";
import {DeliveryItemsTable} from "../components/delivery-items-table";

import type {
    BreweryDto,
    BreweryProductListItemDto,
    UpdateProductDeliveryStopDto
} from "../../../api/Client";

type UpdateProductDeliveryStopViewProps = {
    number: number,
    breweries: BreweryDto[],
    productDeliveryStop: UpdateProductDeliveryStopDto,
    onBrewerySelected: (breweryId: string | undefined) => void,
    onNoteChanged: (note: string) => void,
    onDeleteClicked: () => void,
    onProductsChanged: (products: UpdateProductDeliveryItemDto[]) => void,
    shouldValidate?: boolean,
    disabled?: boolean,
};

export function UpdateProductDeliveryStopView(
    {
        number,
        breweries,
        productDeliveryStop,
        onBrewerySelected,
        onNoteChanged,
        onDeleteClicked,
        onProductsChanged,
        shouldValidate,
        disabled
    }:Readonly<UpdateProductDeliveryStopViewProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    const [breweryName, setBreweryName] = useState<string | undefined>(undefined);
    const [products, setProducts] = useState<BreweryProductListItemDto[]>([]);

    useEffect(() => {
        if (productDeliveryStop.breweryId !== undefined && productDeliveryStop.breweryId !== "") {
            setBreweryName(breweries.find(brewery => brewery.id === productDeliveryStop.breweryId)?.name ?? "");
            void fetchProducts(productDeliveryStop.breweryId);
        }
    }, [productDeliveryStop.breweryId])

    const fetchProducts = async (breweryId: string) => {
        try {
            const client = new AuthorizedClient();
            await client.fetchBreweryProducts(breweryId, {}).then(setProducts);
        } catch (error) {
            showSnackbar('Error fetching products for delivery', 'error');
            console.error('Error fetching products for delivery:', error);
        }
    };

    return (
        <>
            <Box
                key={uuidv4()}
                onClick={() => setIsExpanded(prev => !prev)}
                sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'}}
            >
                <Typography variant="subtitle2" sx={{fontWeight: 'bold'}}>
                    {number}. {t('productDeliveries.stop')} {breweryName === undefined ? "" : "- " + breweryName}
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center'}}>
                    {isExpanded ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    <IconButton
                        disabled={disabled}
                        onClick={onDeleteClicked}
                        color="error"
                    >
                        <Iconify icon="solar:trash-bin-trash-bold"/>
                    </IconButton>
                </Box>
            </Box>
            <Collapse in={isExpanded} sx={{mb: 0.5}}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        pl: 2,
                        pr: 2
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <BrewerySelect
                            disabled={disabled}
                            selectedBreweryId={productDeliveryStop.breweryId}
                            breweries={breweries}
                            shouldValidate={shouldValidate ?? false}
                            onBrewerySelected={(breweryId, name) => {
                                setBreweryName(breweryId == productDeliveryStop.breweryId ? undefined : name);
                                onBrewerySelected(breweryId == productDeliveryStop.breweryId ? undefined : breweryId);
                            }}
                        />

                        <ProductsSelect
                            disabled={disabled}
                            key={productDeliveryStop.breweryId + '-' + (productDeliveryStop.products?.length ?? 0)}
                            products={products}
                            selectedProducts={(productDeliveryStop.products ?? []).map((product) => ({productId: product.productId!, quantity: product.quantity!}))}
                            shouldValidate={shouldValidate ?? false}
                            onProductsChanged={(selectedProducts) => onProductsChanged(
                                selectedProducts.map(p => new UpdateProductDeliveryItemDto(p))
                            )}
                        />
                    </Box>

                    <TextField
                        id="note-input"
                        label={t('productDeliveries.note')}
                        multiline
                        rows={3}
                        value={productDeliveryStop.note}
                        sx={{mt: 2}}
                        onChange={(event) => onNoteChanged(event.target.value)}
                        inputProps={{maxLength: 200}}
                        disabled={disabled}
                    />

                    <Scrollbar>
                        <DeliveryItemsTable
                            disabled={disabled}
                            deliveryProducts={productDeliveryStop.products ?? []}
                            products={products}
                            onProductsChanged={onProductsChanged} />
                    </Scrollbar>
                </Box>
            </Collapse>
        </>
    )
}