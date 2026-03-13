import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import Autocomplete from '@mui/material/Autocomplete';

import { useBreweries } from 'src/hooks/useBreweries';
import { useProduct, useUpdateProduct, useCreateProducts } from 'src/hooks/useProducts';

import { useEnumLabel } from 'src/utils/enumTranslations';

import {
     ProductKind,
     ProductType,
     CreateProductDto,
     UpdateProductDto,
     CreateProductsDto,
} from 'src/generated/api-client';

import PageHeader from 'src/components/common/PageHeader';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const productSchema = z.object({
     name: z.string().min(1),
     description: z.string().optional(),
     kind: z.nativeEnum(ProductKind),
     type: z.nativeEnum(ProductType),
     alcoholPercentage: z.number().optional(),
     platoDegree: z.number().optional(),
     packageSize: z.number().optional(),
     priceWithVat: z.number().positive(),
     priceForUnitWithVat: z.number(),
     priceForUnitWithoutVat: z.number(),
     weight: z.number().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const defaultValues: ProductFormValues = {
     name: '',
     description: '',
     kind: ProductKind.Keg,
     type: ProductType.PaleDraftBeer,
     alcoholPercentage: undefined,
     platoDegree: undefined,
     packageSize: undefined,
     priceWithVat: 0,
     priceForUnitWithVat: 0,
     priceForUnitWithoutVat: 0,
     weight: undefined,
};

// ---------------------------------------------------------------------------
// Enum option helpers
// ---------------------------------------------------------------------------

const productKindEntries = Object.entries(ProductKind).filter(([key]) => isNaN(Number(key))) as [
     string,
     ProductKind,
][];

const productTypeEntries = Object.entries(ProductType).filter(([key]) => isNaN(Number(key))) as [
     string,
     ProductType,
][];

// ---------------------------------------------------------------------------
// Number field onChange helper
// ---------------------------------------------------------------------------

function toNumberOrUndefined(value: string): number | undefined {
     return value === '' ? undefined : Number(value);
}

// ---------------------------------------------------------------------------
// ProductFormPage
// ---------------------------------------------------------------------------

export default function ProductFormPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();
     const enumLabel = useEnumLabel();
     const isEdit = !!id;

     // Data hooks
     const { data: product, isLoading: productLoading } = useProduct(id ?? '');
     const { data: breweries = [] } = useBreweries();
     const createMutation = useCreateProducts();
     const updateMutation = useUpdateProduct();

     // Brewery selection (only for create mode)
     const [selectedBrewery, setSelectedBrewery] = useState<{
          id: string;
          label: string;
     } | null>(null);

     const {
          control,
          handleSubmit,
          reset,
          formState: { errors },
     } = useForm<ProductFormValues>({
          resolver: zodResolver(productSchema),
          defaultValues,
     });

     // Populate form in edit mode
     useEffect(() => {
          if (product && isEdit) {
               reset({
                    name: product.name ?? '',
                    description: product.description ?? '',
                    kind: product.kind ?? ProductKind.Keg,
                    type: product.type ?? ProductType.PaleDraftBeer,
                    alcoholPercentage: product.alcoholPercentage ?? undefined,
                    platoDegree: product.platoDegree ?? undefined,
                    packageSize: product.packageSize ?? undefined,
                    priceWithVat: product.priceWithVat ?? 0,
                    priceForUnitWithVat: product.priceForUnitWithVat ?? 0,
                    priceForUnitWithoutVat: product.priceForUnitWithoutVat ?? 0,
                    weight: product.weight ?? undefined,
               });
          }
     }, [product, isEdit, reset]);

     // Submit handler
     const onSubmit = (data: ProductFormValues) => {
          if (isEdit && id) {
               const dto = new UpdateProductDto();
               dto.name = data.name;
               dto.description = data.description;
               dto.kind = data.kind;
               dto.type = data.type;
               dto.alcoholPercentage = data.alcoholPercentage;
               dto.platoDegree = data.platoDegree;
               dto.packageSize = data.packageSize;
               dto.priceWithVat = data.priceWithVat;
               dto.priceForUnitWithVat = data.priceForUnitWithVat;
               dto.priceForUnitWithoutVat = data.priceForUnitWithoutVat;

               updateMutation.mutate(
                    { id, data: dto },
                    { onSuccess: () => navigate('/products') },
               );
          } else {
               if (!selectedBrewery) return;

               const productDto = new CreateProductDto();
               productDto.name = data.name;
               productDto.description = data.description;
               productDto.kind = data.kind;
               productDto.type = data.type;
               productDto.alcoholPercentage = data.alcoholPercentage;
               productDto.platoDegree = data.platoDegree;
               productDto.packageSize = data.packageSize;
               productDto.priceWithVat = data.priceWithVat;
               productDto.priceForUnitWithVat = data.priceForUnitWithVat;
               productDto.priceForUnitWithoutVat = data.priceForUnitWithoutVat;

               const productsDto = new CreateProductsDto();
               productsDto.products = [productDto];

               createMutation.mutate(
                    { breweryId: selectedBrewery.id, data: productsDto },
                    { onSuccess: () => navigate('/products') },
               );
          }
     };

     if (isEdit && productLoading) return <LoadingSpinner />;

     const isSaving = createMutation.isPending || updateMutation.isPending;

     // Brewery options for Autocomplete
     const breweryOptions = breweries.map((b) => ({
          id: b.id ?? '',
          label: b.name ?? '',
     }));

     return (
          <Box>
               <PageHeader title={isEdit ? t('products.editProduct') : t('products.addProduct')} />

               <Card>
                    <CardContent>
                         <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                              <Grid container spacing={3}>
                                   {/* Brewery selector — create mode only */}
                                   {!isEdit && (
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                             <Autocomplete
                                                  options={breweryOptions}
                                                  value={selectedBrewery}
                                                  onChange={(_e, newValue) =>
                                                       setSelectedBrewery(newValue)
                                                  }
                                                  isOptionEqualToValue={(opt, val) =>
                                                       opt.id === val.id
                                                  }
                                                  renderInput={(params) => (
                                                       <TextField
                                                            {...params}
                                                            label={t('products.brewery')}
                                                            required
                                                            error={
                                                                 !selectedBrewery &&
                                                                 createMutation.isError
                                                            }
                                                       />
                                                  )}
                                             />
                                        </Grid>
                                   )}

                                   {/* Name */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="name"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       label={t('products.name')}
                                                       fullWidth
                                                       required
                                                       error={!!errors.name}
                                                       helperText={errors.name?.message as string}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Description */}
                                   <Grid size={{ xs: 12 }}>
                                        <Controller
                                             name="description"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       label={t('products.description')}
                                                       fullWidth
                                                       multiline
                                                       rows={3}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Kind */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="kind"
                                             control={control}
                                             render={({ field }) => (
                                                  <Autocomplete
                                                       options={productKindEntries.map(([, value]) => value)}
                                                       getOptionLabel={(opt) => enumLabel.productKind(opt)}
                                                       value={field.value}
                                                       onChange={(_e, newValue) => { if (newValue != null) field.onChange(newValue); }}
                                                       disableClearable
                                                       fullWidth
                                                       renderInput={(params) => (
                                                            <TextField
                                                                 {...params}
                                                                 label={t('products.kind')}
                                                                 required
                                                                 error={!!errors.kind}
                                                                 helperText={errors.kind?.message as string}
                                                            />
                                                       )}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Type */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="type"
                                             control={control}
                                             render={({ field }) => (
                                                  <Autocomplete
                                                       options={productTypeEntries.map(([, value]) => value)}
                                                       getOptionLabel={(opt) => enumLabel.productType(opt)}
                                                       value={field.value}
                                                       onChange={(_e, newValue) => { if (newValue != null) field.onChange(newValue); }}
                                                       disableClearable
                                                       fullWidth
                                                       renderInput={(params) => (
                                                            <TextField
                                                                 {...params}
                                                                 label={t('products.type')}
                                                                 required
                                                                 error={!!errors.type}
                                                                 helperText={errors.type?.message as string}
                                                            />
                                                       )}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Alcohol percentage */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="alcoholPercentage"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       value={field.value ?? ''}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 toNumberOrUndefined(
                                                                      e.target.value,
                                                                 ),
                                                            )
                                                       }
                                                       label={t('products.alcoholPercentage')}
                                                       fullWidth
                                                       type="number"
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Plato degree */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="platoDegree"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       value={field.value ?? ''}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 toNumberOrUndefined(
                                                                      e.target.value,
                                                                 ),
                                                            )
                                                       }
                                                       label={t('products.platoDegree')}
                                                       fullWidth
                                                       type="number"
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Package size */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="packageSize"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       value={field.value ?? ''}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 toNumberOrUndefined(
                                                                      e.target.value,
                                                                 ),
                                                            )
                                                       }
                                                       label={t('products.packageSize')}
                                                       fullWidth
                                                       type="number"
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Price with VAT */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="priceWithVat"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 e.target.value === ''
                                                                      ? 0
                                                                      : Number(e.target.value),
                                                            )
                                                       }
                                                       label={t('products.priceWithVat')}
                                                       fullWidth
                                                       required
                                                       type="number"
                                                       error={!!errors.priceWithVat}
                                                       helperText={
                                                            errors.priceWithVat?.message as string
                                                       }
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Unit price with VAT */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="priceForUnitWithVat"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 e.target.value === ''
                                                                      ? 0
                                                                      : Number(e.target.value),
                                                            )
                                                       }
                                                       label={t('products.priceForUnitWithVat')}
                                                       fullWidth
                                                       required
                                                       type="number"
                                                       error={!!errors.priceForUnitWithVat}
                                                       helperText={
                                                            errors.priceForUnitWithVat
                                                                 ?.message as string
                                                       }
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Unit price without VAT */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="priceForUnitWithoutVat"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 e.target.value === ''
                                                                      ? 0
                                                                      : Number(e.target.value),
                                                            )
                                                       }
                                                       label={t('products.priceForUnitWithoutVat')}
                                                       fullWidth
                                                       required
                                                       type="number"
                                                       error={!!errors.priceForUnitWithoutVat}
                                                       helperText={
                                                            errors.priceForUnitWithoutVat
                                                                 ?.message as string
                                                       }
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Weight */}
                                   <Grid size={{ xs: 12, sm: 4 }}>
                                        <Controller
                                             name="weight"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       value={field.value ?? ''}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 toNumberOrUndefined(
                                                                      e.target.value,
                                                                 ),
                                                            )
                                                       }
                                                       label={t('products.weight')}
                                                       fullWidth
                                                       type="number"
                                                  />
                                             )}
                                        />
                                   </Grid>
                              </Grid>

                              {/* Actions */}
                              <Stack
                                   direction="row"
                                   spacing={2}
                                   sx={{ mt: 3, justifyContent: 'flex-end' }}
                              >
                                   <Button
                                        variant="outlined"
                                        onClick={() => navigate('/products')}
                                   >
                                        {t('common.cancel')}
                                   </Button>
                                   <LoadingButton
                                        type="submit"
                                        variant="contained"
                                        loading={isSaving}
                                   >
                                        {t('common.save')}
                                   </LoadingButton>
                              </Stack>
                         </Box>
                    </CardContent>
               </Card>
          </Box>
     );
}
