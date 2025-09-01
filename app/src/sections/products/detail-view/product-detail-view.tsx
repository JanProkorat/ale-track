import {useState, useEffect} from "react";
import {useTranslation} from "react-i18next";

import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import {Box, InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {ProductTypeSelect} from "./components/product-type-select";
import {ProductKindSelect} from "./components/product-kind-select";
import {DrawerLayout} from "../../../layouts/components/drawer-layout";
import {
    ProductDto,
    CreateProductDto,
    UpdateProductDto,
    CreateProductsDto
} from "../../../api/Client";

import type {
    ProductType} from "../../../api/Client";

type ProductDetailViewProps = {
    id: string | null,
    breweryId: string,
    onClose: (shouldReloadData: boolean) => void,
};

export function ProductDetailView(
    {
        id,
        breweryId,
        onClose,
    }: Readonly<ProductDetailViewProps>) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [product, setProduct] = useState<ProductDto>(new ProductDto());
    const [productTypes, setProductTypes] = useState<ProductType[]>([]);
    const [productKinds, setProductKinds] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        void fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const clientApi = new AuthorizedClient();

            if (id !== null && id !== undefined) {
                const data = await clientApi.getProductDetailEndpoint(id);
                if (data) {
                    setProduct(data);
                }
            }

            const types = await clientApi.getProductTypeListEndpoint();
            setProductTypes(types);

            const kinds = await clientApi.getProductKindListEndpoint();
            setProductKinds(kinds);

        } catch (error) {
            showSnackbar(t('products.fetchDetailError'), 'error')
            console.error('Error fetching product:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const saveProduct = async (): Promise<void> => {
        const {name, priceWithVat} = product;

        const newErrors: Record<string, string> = {};
        if (!name) newErrors.name = t('common.required');
        if (!priceWithVat) newErrors.priceWithVat = t('common.required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return;
        }

        setErrors({});

        try {
            const clientApi = new AuthorizedClient();

            if (id === null) {
                const createDto = new CreateProductDto({
                    name: product.name!,
                    priceWithVat: product.priceWithVat!,
                    description: product.description!,
                    kind: product.kind!,
                    alcoholPercentage: product.alcoholPercentage!,
                    packageSize: product.packageSize!,
                    platoDegree: product.platoDegree!,
                    type: product.type!,
                    priceForUnitWithoutVat: product.priceForUnitWithoutVat!,
                    priceForUnitWithVat: product.priceForUnitWithVat!,
                });

                await clientApi.createProductsEndpoint(breweryId, new CreateProductsDto({products: [createDto]}));
            } else {
                const updateDto = new UpdateProductDto({
                    name: product.name!,
                    priceWithVat: product.priceWithVat!,
                    description: product.description!,
                    kind: product.kind!,
                    alcoholPercentage: product.alcoholPercentage!,
                    packageSize: product.packageSize!,
                    platoDegree: product.platoDegree!,
                    type: product.type!,
                    priceForUnitWithoutVat: product.priceForUnitWithoutVat!,
                    priceForUnitWithVat: product.priceForUnitWithVat!,

                });

                await clientApi.updateProductEndpoint(id, updateDto.toJSON());
            }

            showSnackbar(t('products.saveSuccess'), 'success');
            onClose(true);
        } catch (error) {
            console.error('Error saving vehicle:', error);
            showSnackbar(t('products.saveError'), 'error');
            return;
        }
    }

    return (
        <DrawerLayout
            title={t('products.detailTitle')}
            isLoading={isLoading}
            onClose={() => onClose(false)}
            onSaveAndClose={saveProduct}
        >

            {/* product name */}
            <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                <InputLabel htmlFor="name">{t('products.name')}</InputLabel>
                <OutlinedInput
                    id="name"
                    value={product.name ?? ''}
                    onChange={event => setProduct(prev => new ProductDto({
                        ...prev,
                        name: event.target.value
                    }))}
                    label={t('products.name')}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>

            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <ProductTypeSelect
                    types={productTypes}
                    selectedType={product.type}
                    shouldValidate={false}
                    onSelect={type => setProduct(prev => new ProductDto({
                        ...prev,
                        type: type === product.type ? undefined : type
                    }))}
                />

                <ProductKindSelect
                    kinds={productKinds}
                    selectedKind={product.kind}
                    shouldValidate={false}
                    onSelect={kind => setProduct(prev => new ProductDto({
                        ...prev,
                        kind: kind === product.kind ? undefined : kind
                    }))}
                />
            </Box>

            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <FormControl variant="outlined">
                    <InputLabel htmlFor="weight">{t('products.platoDegree')}</InputLabel>
                    <OutlinedInput
                        type="number"
                        id="platoDegree"
                        label={t('products.platoDegree')}
                        endAdornment={<InputAdornment position="end">%</InputAdornment>}
                        value={product.platoDegree ?? undefined}
                        onChange={event => setProduct(prev => new ProductDto({
                            ...prev,
                            platoDegree: parseFloat(event.target.value)
                        }))}
                    />
                </FormControl>

                <FormControl variant="outlined">
                    <InputLabel htmlFor="weight">{t('products.packageSize')}</InputLabel>
                    <OutlinedInput
                        type="number"
                        id="packageSize"
                        label={t('products.packageSize')}
                        endAdornment={<InputAdornment position="end">L</InputAdornment>}
                        value={product.packageSize ?? undefined}
                        onChange={event => setProduct(prev => new ProductDto({
                            ...prev,
                            packageSize: parseFloat(event.target.value)
                        }))}
                    />
                </FormControl>

                <FormControl variant="outlined">
                    <InputLabel htmlFor="weight">{t('products.alcoholPercentage')}</InputLabel>
                    <OutlinedInput
                        type="number"
                        id="alcoholPercentage"
                        label={t('products.alcoholPercentage')}
                        endAdornment={<InputAdornment position="end">%</InputAdornment>}
                        value={product.alcoholPercentage ?? undefined}
                        onChange={event => setProduct(prev => new ProductDto({
                            ...prev,
                            alcoholPercentage: parseFloat(event.target.value)
                        }))}
                    />
                </FormControl>
            </Box>


            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <FormControl variant="outlined">
                    <InputLabel htmlFor="weight">{t('products.priceVat')}</InputLabel>
                    <OutlinedInput
                        type="number"
                        id="priceVat"
                        label={t('products.priceVat')}
                        endAdornment={<InputAdornment position="end">Kč</InputAdornment>}
                        value={product.priceWithVat ?? undefined}
                        onChange={event => setProduct(prev => new ProductDto({
                            ...prev,
                            priceWithVat: parseFloat(event.target.value)
                        }))}
                    />
                </FormControl>

                <FormControl variant="outlined">
                    <InputLabel htmlFor="weight">{t('products.priceUnitVat')}</InputLabel>
                    <OutlinedInput
                        type="number"
                        id="priceUnitVat"
                        label={t('products.priceUnitVat')}
                        endAdornment={<InputAdornment position="end">Kč</InputAdornment>}
                        value={product.priceForUnitWithVat ?? undefined}
                        onChange={event => setProduct(prev => new ProductDto({
                            ...prev,
                            priceForUnitWithVat: parseFloat(event.target.value)
                        }))}
                    />
                </FormControl>

                <FormControl variant="outlined">
                    <InputLabel htmlFor="weight">{t('products.priceUnitNoVat')}</InputLabel>
                    <OutlinedInput
                        type="number"
                        id="priceUnitNoVat"
                        label={t('products.priceUnitNoVat')}
                        endAdornment={<InputAdornment position="end">Kč</InputAdornment>}
                        value={product.priceForUnitWithoutVat ?? undefined}
                        onChange={event => setProduct(prev => new ProductDto({
                            ...prev,
                            packageSize: parseFloat(event.target.value)
                        }))}
                    />
                </FormControl>
            </Box>

            <FormControl fullWidth>
                <TextField
                    id="description"
                    label={t('products.description')}
                    multiline
                    minRows={4}
                    maxRows={10}
                    value={product.description ?? ''}
                    onChange={(e) =>
                        setProduct(prev => new ProductDto({ ...prev, description: e.target.value }))
                    }
                />
            </FormControl>
        </DrawerLayout>
    );
}