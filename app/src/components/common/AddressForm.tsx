import type { Control, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';

import { useEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';

import { Country } from 'src/generated/api-client';

import { useGeocode } from 'src/hooks/useGeocode';

import MapPreview from './MapPreview';

// ---------------------------------------------------------------------------
// Country enum → translation key mapping
// ---------------------------------------------------------------------------

const countryOptions = Object.keys(Country)
     .filter((key) => isNaN(Number(key)))
     .map((key) => ({ value: key, labelKey: `enums.country.${key}` }));

// ---------------------------------------------------------------------------
// AddressForm
// ---------------------------------------------------------------------------

interface AddressFormProps {
     prefix: string;
     control: Control<any>;
     errors: FieldErrors;
     setValue?: UseFormSetValue<any>;
     watch?: UseFormWatch<any>;
}

/**
 * Resolve a nested error from `FieldErrors` by a dot-separated path such as
 * `"officialAddress.streetName"`.
 */
function getNestedError(errors: FieldErrors, path: string) {
     let current: any = errors;
     for (const segment of path.split('.')) {
          if (current == null) return undefined;
          current = current[segment];
     }
     return current;
}

export default function AddressForm({ prefix, control, errors, setValue, watch }: AddressFormProps) {
     const { t } = useTranslation();
     const { geocode, isGeocoding } = useGeocode();
     const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
     const lastGeocodedKey = useRef<string>('');

     const fieldName = (field: string) => `${prefix}.${field}`;

     const fieldError = (field: string) => getNestedError(errors, fieldName(field));

     const lat = watch ? watch(fieldName('latitude')) : undefined;
     const lng = watch ? watch(fieldName('longitude')) : undefined;

     const streetName = watch ? watch(fieldName('streetName')) : '';
     const streetNumber = watch ? watch(fieldName('streetNumber')) : '';
     const city = watch ? watch(fieldName('city')) : '';
     const zip = watch ? watch(fieldName('zip')) : '';
     const country = watch ? watch(fieldName('country')) : '';

     const allFilled = !!streetName && !!city && !!zip && !!country;
     const addressKey = `${streetName}|${streetNumber}|${city}|${zip}|${country}`;

     useEffect(() => {
          if (!setValue || !watch || !allFilled) return;
          if (addressKey === lastGeocodedKey.current) return;

          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(async () => {
               lastGeocodedKey.current = addressKey;
               const result = await geocode({
                    streetName,
                    streetNumber: streetNumber ?? '',
                    city,
                    zip,
                    country,
               });
               if (result) {
                    setValue(fieldName('latitude'), result.latitude, { shouldDirty: true });
                    setValue(fieldName('longitude'), result.longitude, { shouldDirty: true });
               } else {
                    setValue(fieldName('latitude'), undefined, { shouldDirty: true });
                    setValue(fieldName('longitude'), undefined, { shouldDirty: true });
               }
          }, 1500);

          return () => clearTimeout(debounceRef.current);
          // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [addressKey, allFilled]);

     return (
          <Grid container spacing={2}>
               {/* Street Name */}
               <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                         name={fieldName('streetName')}
                         control={control}
                         render={({ field }) => (
                              <TextField
                                   {...field}
                                   label={t('address.streetName')}
                                   fullWidth
                                   error={!!fieldError('streetName')}
                                   helperText={fieldError('streetName')?.message as string}
                              />
                         )}
                    />
               </Grid>

               {/* Street Number */}
               <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                         name={fieldName('streetNumber')}
                         control={control}
                         render={({ field }) => (
                              <TextField
                                   {...field}
                                   label={t('address.streetNumber')}
                                   fullWidth
                                   error={!!fieldError('streetNumber')}
                                   helperText={fieldError('streetNumber')?.message as string}
                              />
                         )}
                    />
               </Grid>

               {/* City */}
               <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                         name={fieldName('city')}
                         control={control}
                         render={({ field }) => (
                              <TextField
                                   {...field}
                                   label={t('address.city')}
                                   fullWidth
                                   error={!!fieldError('city')}
                                   helperText={fieldError('city')?.message as string}
                              />
                         )}
                    />
               </Grid>

               {/* ZIP */}
               <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                         name={fieldName('zip')}
                         control={control}
                         render={({ field }) => (
                              <TextField
                                   {...field}
                                   label={t('address.zip')}
                                   fullWidth
                                   error={!!fieldError('zip')}
                                   helperText={fieldError('zip')?.message as string}
                              />
                         )}
                    />
               </Grid>

               {/* Country */}
               <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                         name={fieldName('country')}
                         control={control}
                         render={({ field }) => (
                              <TextField
                                   {...field}
                                   select
                                   label={t('address.country')}
                                   fullWidth
                                   error={!!fieldError('country')}
                                   helperText={fieldError('country')?.message as string}
                              >
                                   {countryOptions.map((opt) => (
                                        <MenuItem key={opt.value} value={opt.value}>
                                             {t(opt.labelKey)}
                                        </MenuItem>
                                   ))}
                              </TextField>
                         )}
                    />
               </Grid>

               {/* Lat / Lng read-only fields */}
               {setValue && watch && (
                    <>
                         <Grid size={{ xs: 6, sm: 3 }}>
                              <TextField
                                   label={t('address.latitude')}
                                   value={lat != null ? lat.toFixed(6) : ''}
                                   fullWidth
                                   size="small"
                                   slotProps={{
                                        input: {
                                             readOnly: true,
                                             endAdornment: isGeocoding ? (
                                                  <InputAdornment position="end">
                                                       <CircularProgress size={16} />
                                                  </InputAdornment>
                                             ) : undefined,
                                        },
                                   }}
                              />
                         </Grid>
                         <Grid size={{ xs: 6, sm: 3 }}>
                              <TextField
                                   label={t('address.longitude')}
                                   value={lng != null ? lng.toFixed(6) : ''}
                                   fullWidth
                                   size="small"
                                   slotProps={{
                                        input: {
                                             readOnly: true,
                                             endAdornment: isGeocoding ? (
                                                  <InputAdornment position="end">
                                                       <CircularProgress size={16} />
                                                  </InputAdornment>
                                             ) : undefined,
                                        },
                                   }}
                              />
                         </Grid>
                    </>
               )}

               {/* Map preview */}
               {lat != null && lng != null && (
                    <Grid size={12}>
                         <MapPreview latitude={lat} longitude={lng} />
                    </Grid>
               )}
          </Grid>
     );
}
