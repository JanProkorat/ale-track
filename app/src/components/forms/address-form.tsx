import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect } from 'react';

import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { Box, InputLabel, FormControl, OutlinedInput, FormHelperText } from '@mui/material';

import { Country, AddressDto } from 'src/api/Client';
import { GeoLocationProvider } from 'src/providers/geo-location-provider';

import { MapView } from '../map/map-view';
import { MapDialog } from '../map/map-dialog';
import { CollapsibleForm } from './collapsible-form';

type AddressFormProps = {
     title: string;
     address: AddressDto | undefined;
     errors: Record<string, string>;
     onChange: (newAddress: AddressDto) => void;
     headerVariant?:
          | 'h1'
          | 'h2'
          | 'h3'
          | 'h4'
          | 'h5'
          | 'h6'
          | 'subtitle1'
          | 'subtitle2'
          | 'body1'
          | 'body2'
          | 'caption'
          | 'button'
          | 'overline';
};

export function AddressForm({ title, address, errors, onChange, headerVariant }: Readonly<AddressFormProps>) {
     const { t } = useTranslation();

     const [safeAddress, setSafeAddress] = useState<AddressDto>(
          new AddressDto({
               streetName: '',
               city: '',
               zip: '',
               streetNumber: '',
               country: Country.Germany,
               latitude: undefined,
               longitude: undefined,
          })
     );
     const [mapOpen, setMapOpen] = useState<boolean>(false);

     const initialAddressRef = useRef<AddressDto | undefined>(undefined);
     const geoProviderRef = useRef(new GeoLocationProvider());

     useEffect(() => {
          if (address !== undefined) {
               setSafeAddress(address);
               // Store initial address to check if it has coordinates
               if (initialAddressRef.current === undefined) {
                    initialAddressRef.current = address;
               }
          }
     }, [address]);

     const handleFieldBlur = async () => {
          const isAddressComplete =
               safeAddress.streetName &&
               safeAddress.streetNumber &&
               safeAddress.city &&
               safeAddress.zip &&
               safeAddress.country !== undefined;

          // Don't call provider if initial address already had coordinates
          const initialHadCoordinates =
               initialAddressRef.current?.latitude !== undefined &&
               initialAddressRef.current?.latitude !== null &&
               initialAddressRef.current?.longitude !== undefined &&
               initialAddressRef.current?.longitude !== null;

          if (isAddressComplete && !initialHadCoordinates) {
               try {
                    const coordinates = await geoProviderRef.current.geocode(safeAddress);
                    if (coordinates) {
                         onChange(
                              new AddressDto({
                                   ...safeAddress,
                                   latitude: coordinates.latitude,
                                   longitude: coordinates.longitude,
                              })
                         );
                    }
               } catch (error) {
                    console.error('Geocoding failed:', error);
               }
          }
     };

     return (
          <CollapsibleForm title={title} titleVariant="subtitle2">
               <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, mt: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                         <Box sx={{ display: 'flex', gap: 2 }}>
                              <FormControl fullWidth error={!!errors.streetName}>
                                   <InputLabel htmlFor="street">{t('address.street')}</InputLabel>
                                   <OutlinedInput
                                        id="street"
                                        value={safeAddress?.streetName ?? ''}
                                        onChange={(e) =>
                                             onChange(
                                                  new AddressDto({
                                                       ...safeAddress,
                                                       streetName: e.target.value,
                                                  })
                                             )
                                        }
                                        onBlur={handleFieldBlur}
                                        label={t('address.street')}
                                   />
                                   {errors.streetName && <FormHelperText>{errors.streetName}</FormHelperText>}
                              </FormControl>
                              <FormControl fullWidth error={!!errors.streetNumber}>
                                   <InputLabel htmlFor="streetNumber">{t('address.number')}</InputLabel>
                                   <OutlinedInput
                                        id="streetNumber"
                                        value={safeAddress.streetNumber ?? ''}
                                        onChange={(e) =>
                                             onChange(
                                                  new AddressDto({
                                                       ...safeAddress,
                                                       streetNumber: e.target.value,
                                                  })
                                             )
                                        }
                                        onBlur={handleFieldBlur}
                                        label={t('address.number')}
                                   />
                                   {errors.streetNumber && <FormHelperText>{errors.streetNumber}</FormHelperText>}
                              </FormControl>
                         </Box>
                         <Box sx={{ display: 'flex', gap: 2 }}>
                              <FormControl fullWidth error={!!errors.city}>
                                   <InputLabel htmlFor="city">{t('address.city')}</InputLabel>
                                   <OutlinedInput
                                        id="city"
                                        value={safeAddress.city ?? ''}
                                        onChange={(e) =>
                                             onChange(
                                                  new AddressDto({
                                                       ...safeAddress,
                                                       city: e.target.value,
                                                  })
                                             )
                                        }
                                        onBlur={handleFieldBlur}
                                        label={t('address.city')}
                                   />
                                   {errors.city && <FormHelperText>{errors.city}</FormHelperText>}
                              </FormControl>
                              <FormControl fullWidth error={!!errors.zip}>
                                   <InputLabel htmlFor="zip">{t('address.zip')}</InputLabel>
                                   <OutlinedInput
                                        id="zip"
                                        value={safeAddress.zip ?? ''}
                                        onChange={(e) =>
                                             onChange(
                                                  new AddressDto({
                                                       ...safeAddress,
                                                       zip: e.target.value,
                                                  })
                                             )
                                        }
                                        onBlur={handleFieldBlur}
                                        label={t('address.zip')}
                                   />
                                   {errors.zip && <FormHelperText>{errors.zip}</FormHelperText>}
                              </FormControl>
                         </Box>
                         <FormControl fullWidth error={!!errors.country}>
                              <Autocomplete
                                   id="countries"
                                   options={Object.values(Country).filter((key) => isNaN(Number(key)))}
                                   autoHighlight
                                   value={Country[safeAddress.country]}
                                   onChange={(_, value) =>
                                        onChange(
                                             new AddressDto({
                                                  ...safeAddress,
                                                  country: Country[value as keyof typeof Country],
                                             })
                                        )
                                   }
                                   onBlur={handleFieldBlur}
                                   getOptionLabel={(option) => {
                                        const labelKey = typeof option === 'number' ? Country[option] : option;
                                        return t('country.' + labelKey);
                                   }}
                                   renderOption={(props, option) => {
                                        const { key, ...optionProps } = props;
                                        return (
                                             <Box
                                                  key={key}
                                                  component="li"
                                                  sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
                                                  {...optionProps}
                                             >
                                                  {t('country.' + option)}
                                             </Box>
                                        );
                                   }}
                                   renderInput={(params) => (
                                        <TextField
                                             {...params}
                                             label={t('address.country')}
                                             slotProps={{
                                                  htmlInput: {
                                                       ...params.inputProps,
                                                       autoComplete: 'new-password',
                                                  },
                                             }}
                                        />
                                   )}
                              />
                              {errors.country && <FormHelperText>{errors.country}</FormHelperText>}
                         </FormControl>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                         <MapView
                              lat={safeAddress.latitude ?? 0}
                              lng={safeAddress.longitude ?? 0}
                              onFullscreen={() => setMapOpen(true)}
                              isFullscreen={false}
                         />
                    </Box>
               </Box>
               <MapDialog
                    open={mapOpen}
                    onClose={() => setMapOpen(false)}
                    lat={safeAddress.latitude ?? 0}
                    lng={safeAddress.longitude ?? 0}
               />
          </CollapsibleForm>
     );
}
