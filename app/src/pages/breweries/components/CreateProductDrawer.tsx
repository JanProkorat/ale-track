import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';

import { useCreateProducts } from 'src/hooks/useProducts';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCurrency } from 'src/providers/CurrencyProvider';
import {
     ProductKind,
     ProductType,
     CreateProductDto,
     CreateProductsDto,
} from 'src/generated/api-client';

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
});

type ProductFormValues = z.infer<typeof productSchema>;

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
};

// ---------------------------------------------------------------------------
// Enum entries
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
// Helper
// ---------------------------------------------------------------------------

function toNumberOrUndefined(value: string): number | undefined {
     return value === '' ? undefined : Number(value);
}

// ---------------------------------------------------------------------------

interface CreateProductDrawerProps {
     open: boolean;
     onClose: () => void;
     breweryId: string;
}

export default function CreateProductDrawer({ open, onClose, breweryId }: CreateProductDrawerProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { currency, toCzk } = useCurrency();
     const createMutation = useCreateProducts();

     const {
          control,
          handleSubmit,
          reset,
          formState: { errors },
     } = useForm<ProductFormValues>({
          resolver: zodResolver(productSchema),
          defaultValues,
     });

     const handleDrawerOpen = () => {
          reset(defaultValues);
     };

     const onSubmit = (data: ProductFormValues) => {
          const productDto = new CreateProductDto();
          productDto.name = data.name;
          productDto.description = data.description;
          productDto.kind = data.kind;
          productDto.type = data.type;
          productDto.alcoholPercentage = data.alcoholPercentage;
          productDto.platoDegree = data.platoDegree;
          productDto.packageSize = data.packageSize;
          productDto.priceWithVat = toCzk(data.priceWithVat);
          productDto.priceForUnitWithVat = toCzk(data.priceForUnitWithVat);
          productDto.priceForUnitWithoutVat = toCzk(data.priceForUnitWithoutVat);

          const productsDto = new CreateProductsDto();
          productsDto.products = [productDto];

          createMutation.mutate(
               { breweryId, data: productsDto },
               {
                    onSuccess: () => {
                         reset(defaultValues);
                         onClose();
                    },
               },
          );
     };

     return (
          <Drawer
               anchor="right"
               open={open}
               onClose={onClose}
               slotProps={{
                    transition: { onEnter: handleDrawerOpen },
                    paper: { sx: { width: { xs: '100%', sm: 600 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('products.addProduct')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Grid container spacing={2} sx={{ flex: 1, overflow: 'auto' }}>
                         {/* Name */}
                         <Grid size={{ xs: 12 }}>
                              <Controller
                                   name="name"
                                   control={control}
                                   render={({ field }) => (
                                        <TextField
                                             {...field}
                                             label={t('products.name')}
                                             fullWidth
                                             size="small"
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
                                             size="small"
                                             multiline
                                             rows={2}
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
                                        <FormControl fullWidth size="small" error={!!errors.kind}>
                                             <InputLabel required>{t('products.kind')}</InputLabel>
                                             <Select {...field} label={t('products.kind')}>
                                                  {productKindEntries.map(([, value]) => (
                                                       <MenuItem key={value} value={value}>
                                                            {enumLabel.productKind(value)}
                                                       </MenuItem>
                                                  ))}
                                             </Select>
                                             {errors.kind && (
                                                  <FormHelperText>{errors.kind.message as string}</FormHelperText>
                                             )}
                                        </FormControl>
                                   )}
                              />
                         </Grid>

                         {/* Type */}
                         <Grid size={{ xs: 12, sm: 6 }}>
                              <Controller
                                   name="type"
                                   control={control}
                                   render={({ field }) => (
                                        <FormControl fullWidth size="small" error={!!errors.type}>
                                             <InputLabel required>{t('products.type')}</InputLabel>
                                             <Select {...field} label={t('products.type')}>
                                                  {productTypeEntries.map(([, value]) => (
                                                       <MenuItem key={value} value={value}>
                                                            {enumLabel.productType(value)}
                                                       </MenuItem>
                                                  ))}
                                             </Select>
                                             {errors.type && (
                                                  <FormHelperText>{errors.type.message as string}</FormHelperText>
                                             )}
                                        </FormControl>
                                   )}
                              />
                         </Grid>

                         {/* Alcohol % */}
                         <Grid size={{ xs: 12, sm: 4 }}>
                              <Controller
                                   name="alcoholPercentage"
                                   control={control}
                                   render={({ field }) => (
                                        <TextField
                                             {...field}
                                             value={field.value ?? ''}
                                             onChange={(e) => field.onChange(toNumberOrUndefined(e.target.value))}
                                             label={t('products.alcoholPercentage')}
                                             fullWidth
                                             size="small"
                                             type="number"
                                        />
                                   )}
                              />
                         </Grid>

                         {/* Plato */}
                         <Grid size={{ xs: 12, sm: 4 }}>
                              <Controller
                                   name="platoDegree"
                                   control={control}
                                   render={({ field }) => (
                                        <TextField
                                             {...field}
                                             value={field.value ?? ''}
                                             onChange={(e) => field.onChange(toNumberOrUndefined(e.target.value))}
                                             label={t('products.platoDegree')}
                                             fullWidth
                                             size="small"
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
                                             onChange={(e) => field.onChange(toNumberOrUndefined(e.target.value))}
                                             label={t('products.packageSize')}
                                             fullWidth
                                             size="small"
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
                                             onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                             label={t('products.priceWithVat')}
                                             fullWidth
                                             size="small"
                                             required
                                             type="number"
                                             error={!!errors.priceWithVat}
                                             helperText={errors.priceWithVat?.message as string}
                                             slotProps={{ input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
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
                                             onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                             label={t('products.priceForUnitWithVat')}
                                             fullWidth
                                             size="small"
                                             required
                                             type="number"
                                             error={!!errors.priceForUnitWithVat}
                                             helperText={errors.priceForUnitWithVat?.message as string}
                                             slotProps={{ input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
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
                                             onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                             label={t('products.priceForUnitWithoutVat')}
                                             fullWidth
                                             size="small"
                                             required
                                             type="number"
                                             error={!!errors.priceForUnitWithoutVat}
                                             helperText={errors.priceForUnitWithoutVat?.message as string}
                                             slotProps={{ input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
                                        />
                                   )}
                              />
                         </Grid>

                    </Grid>

                    {/* Actions */}
                    <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                         <Button variant="outlined" onClick={onClose}>
                              {t('common.cancel')}
                         </Button>
                         <LoadingButton
                              type="submit"
                              variant="contained"
                              loading={createMutation.isPending}
                         >
                              {t('common.save')}
                         </LoadingButton>
                    </Stack>
               </Box>
          </Drawer>
     );
}
