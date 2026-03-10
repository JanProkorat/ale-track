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
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useBrewery, useCreateBrewery, useUpdateBrewery } from 'src/hooks/useBreweries';

import { Country, AddressDto, CreateBreweryDto, UpdateBreweryDto } from 'src/generated/api-client';

import PageHeader from 'src/components/common/PageHeader';
import AddressForm from 'src/components/common/AddressForm';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const addressSchema = z.object({
     streetName: z.string().min(1),
     streetNumber: z.string().min(1),
     city: z.string().min(1),
     zip: z.string().min(1),
     country: z.nativeEnum(Country),
});

const brewerySchema = z.object({
     name: z.string().min(1),
     color: z.string().min(1),
     officialAddress: addressSchema,
     hasContactAddress: z.boolean(),
     contactAddress: addressSchema.optional(),
});

type BreweryFormValues = z.infer<typeof brewerySchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const defaultAddress = {
     streetName: '',
     streetNumber: '',
     city: '',
     zip: '',
     country: Country.Czechia,
};

const defaultValues: BreweryFormValues = {
     name: '',
     color: '#6366f1',
     officialAddress: defaultAddress,
     hasContactAddress: false,
     contactAddress: undefined,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAddressDto(address: z.infer<typeof addressSchema>): AddressDto {
     const dto = new AddressDto();
     dto.streetName = address.streetName;
     dto.streetNumber = address.streetNumber;
     dto.city = address.city;
     dto.zip = address.zip;
     dto.country = address.country;
     return dto;
}

// ---------------------------------------------------------------------------
// BreweryFormPage
// ---------------------------------------------------------------------------

export default function BreweryFormPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();
     const isEdit = !!id;

     const { data: brewery, isLoading } = useBrewery(id ?? '');
     const createMutation = useCreateBrewery();
     const updateMutation = useUpdateBrewery();

     const [hasContactAddress, setHasContactAddress] = useState(false);

     const {
          control,
          handleSubmit,
          reset,
          setValue,
          formState: { errors },
     } = useForm<BreweryFormValues>({
          resolver: zodResolver(brewerySchema),
          defaultValues,
     });

     // Populate form when brewery data is loaded in edit mode
     useEffect(() => {
          if (brewery && isEdit) {
               const hasContact = !!brewery.contactAddress;
               setHasContactAddress(hasContact);
               reset({
                    name: brewery.name ?? '',
                    color: brewery.color ?? '#6366f1',
                    officialAddress: brewery.officialAddress
                         ? {
                                streetName: brewery.officialAddress.streetName,
                                streetNumber: brewery.officialAddress.streetNumber,
                                city: brewery.officialAddress.city,
                                zip: brewery.officialAddress.zip,
                                country: brewery.officialAddress.country,
                           }
                         : defaultAddress,
                    hasContactAddress: hasContact,
                    contactAddress: hasContact && brewery.contactAddress
                         ? {
                                streetName: brewery.contactAddress.streetName,
                                streetNumber: brewery.contactAddress.streetNumber,
                                city: brewery.contactAddress.city,
                                zip: brewery.contactAddress.zip,
                                country: brewery.contactAddress.country,
                           }
                         : undefined,
               });
          }
     }, [brewery, isEdit, reset]);

     const handleContactToggle = (checked: boolean) => {
          setHasContactAddress(checked);
          setValue('hasContactAddress', checked);
          if (checked) {
               setValue('contactAddress', defaultAddress);
          } else {
               setValue('contactAddress', undefined);
          }
     };

     const onSubmit = (data: BreweryFormValues) => {
          const officialAddress = buildAddressDto(data.officialAddress);
          const contactAddress = data.hasContactAddress && data.contactAddress
               ? buildAddressDto(data.contactAddress)
               : undefined;

          if (isEdit && id) {
               const dto = new UpdateBreweryDto();
               dto.name = data.name;
               dto.color = data.color;
               dto.officialAddress = officialAddress;
               dto.contactAddress = contactAddress;

               updateMutation.mutate(
                    { id, data: dto },
                    { onSuccess: () => navigate('/breweries') }
               );
          } else {
               const dto = new CreateBreweryDto();
               dto.name = data.name;
               dto.color = data.color;
               dto.officialAddress = officialAddress;
               dto.contactAddress = contactAddress;

               createMutation.mutate(dto, {
                    onSuccess: () => navigate('/breweries'),
               });
          }
     };

     if (isEdit && isLoading) return <LoadingSpinner />;

     const isSaving = createMutation.isPending || updateMutation.isPending;

     return (
          <Box>
               <PageHeader title={isEdit ? t('breweries.editBrewery') : t('breweries.addBrewery')} />

               <Card>
                    <CardContent>
                         <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                              <Grid container spacing={3}>
                                   {/* Name */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="name"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       label={t('breweries.name')}
                                                       fullWidth
                                                       error={!!errors.name}
                                                       helperText={errors.name?.message as string}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Color */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="color"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       label={t('breweries.color')}
                                                       type="color"
                                                       fullWidth
                                                       error={!!errors.color}
                                                       helperText={errors.color?.message as string}
                                                       slotProps={{
                                                            inputLabel: { shrink: true },
                                                       }}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Official address */}
                                   <Grid size={12}>
                                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                             {t('clients.officialAddress')}
                                        </Typography>
                                        <AddressForm
                                             prefix="officialAddress"
                                             control={control}
                                             errors={errors}
                                        />
                                   </Grid>

                                   {/* Contact address toggle */}
                                   <Grid size={12}>
                                        <FormControlLabel
                                             control={
                                                  <Checkbox
                                                       checked={hasContactAddress}
                                                       onChange={(e) => handleContactToggle(e.target.checked)}
                                                  />
                                             }
                                             label={t('clients.contactAddress')}
                                        />
                                   </Grid>

                                   {/* Contact address */}
                                   {hasContactAddress && (
                                        <Grid size={12}>
                                             <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                                  {t('clients.contactAddress')}
                                             </Typography>
                                             <AddressForm
                                                  prefix="contactAddress"
                                                  control={control}
                                                  errors={errors}
                                             />
                                        </Grid>
                                   )}
                              </Grid>

                              {/* Actions */}
                              <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                                   <Button variant="outlined" onClick={() => navigate('/breweries')}>
                                        {t('common.cancel')}
                                   </Button>
                                   <LoadingButton type="submit" variant="contained" loading={isSaving}>
                                        {t('common.save')}
                                   </LoadingButton>
                              </Stack>
                         </Box>
                    </CardContent>
               </Card>
          </Box>
     );
}
