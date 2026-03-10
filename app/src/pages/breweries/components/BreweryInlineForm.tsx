import type { BreweryDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import AddressForm from 'src/components/common/AddressForm';
import SectionCard from 'src/components/common/SectionCard';

import BreweryRemindersTab from './BreweryRemindersTab';
import BreweryProductsTable from './BreweryProductsTable';
import {
     brewerySchema,
     defaultValues,
     defaultAddress,
} from '../breweryFormSchema';

import type { BreweryFormValues } from '../breweryFormSchema';
import type { BreweryRemindersTabHandle } from './BreweryRemindersTab';
import type { BreweryProductsTableHandle } from './BreweryProductsTable';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreweryInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     name: string;
}

interface BreweryInlineFormProps {
     brewery: BreweryDto;
     onSubmit: (data: BreweryFormValues) => void;
     onFormStateChange: (state: FormHeaderState) => void;
}

// ---------------------------------------------------------------------------
// BreweryInlineForm
// ---------------------------------------------------------------------------

function mapBreweryToFormValues(brewery: BreweryDto): BreweryFormValues {
     return {
          name: brewery.name ?? '',
          color: brewery.color ?? '#6366f1',
          officialAddress: brewery.officialAddress
               ? {
                      streetName: brewery.officialAddress.streetName,
                      streetNumber: brewery.officialAddress.streetNumber,
                      city: brewery.officialAddress.city,
                      zip: brewery.officialAddress.zip,
                      country: brewery.officialAddress.country as unknown as string,
                      latitude: brewery.officialAddress.latitude,
                      longitude: brewery.officialAddress.longitude,
                 }
               : defaultAddress,
          hasContactAddress: !!brewery.contactAddress,
          contactAddress: brewery.contactAddress
               ? {
                      streetName: brewery.contactAddress.streetName,
                      streetNumber: brewery.contactAddress.streetNumber,
                      city: brewery.contactAddress.city,
                      zip: brewery.contactAddress.zip,
                      country: brewery.contactAddress.country as unknown as string,
                      latitude: brewery.contactAddress.latitude,
                      longitude: brewery.contactAddress.longitude,
                 }
               : defaultAddress,
     };
}

const BreweryInlineForm = forwardRef<BreweryInlineFormHandle, BreweryInlineFormProps>(
     function BreweryInlineForm({ brewery, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const remindersRef = useRef<BreweryRemindersTabHandle>(null);
          const productsRef = useRef<BreweryProductsTableHandle>(null);
          const initialValuesRef = useRef<BreweryFormValues>(defaultValues);
          const onSubmitRef = useRef(onSubmit);
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               setValue,
               formState: { errors },
          } = useForm<BreweryFormValues>({
               resolver: zodResolver(brewerySchema),
               defaultValues,
          });

          const hasContactAddress = watch('hasContactAddress');
          const watchedName = watch('name');

          const markDirty = () => setDirty(true);

          useImperativeHandle(
               ref,
               () => ({
                    submit: async () => {
                         const isValid = await trigger();
                         if (isValid) {
                              onSubmitRef.current(getValues());
                              setDirty(false);
                         }
                    },
                    resetForm: () => {
                         reset(initialValuesRef.current);
                         setDirty(false);
                    },
               }),
               [trigger, getValues, reset],
          );

          // Notify parent of form state changes
          useEffect(() => {
               onFormStateChange({
                    isDirty: dirty,
                    name: watchedName,
               });
          }, [dirty, watchedName, onFormStateChange]);

          // Reset form when brewery data changes
          useEffect(() => {
               if (!brewery) return;
               const values = mapBreweryToFormValues(brewery);
               initialValuesRef.current = values;
               reset(values);
               setDirty(false);
          }, [brewery, reset]);

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('breweries.info')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 8 }}>
                                   <Controller
                                        name="name"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('breweries.name')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.name}
                                                  helperText={errors.name?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                   <Controller
                                        name="color"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('breweries.color')}
                                                  type="color"
                                                  size="small"
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
                         </Grid>
                    </SectionCard>

                    {/* Address */}
                    <SectionCard title={t('clients.address')}>
                         <Stack spacing={3}>
                              <Typography variant="subtitle2">
                                   {t('clients.officialAddress')}
                              </Typography>
                              <AddressForm prefix="officialAddress" control={control} errors={errors} setValue={setValue} watch={watch} />

                              <Divider />

                              <FormControlLabel
                                   control={
                                        <Checkbox
                                             checked={!!hasContactAddress}
                                             onChange={(e) =>
                                                  { setValue('hasContactAddress', e.target.checked); markDirty(); }
                                             }
                                        />
                                   }
                                   label={t('clients.contactAddress')}
                              />
                              <Collapse in={!!hasContactAddress}>
                                   <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                        {t('clients.contactAddress')}
                                   </Typography>
                                   <AddressForm prefix="contactAddress" control={control} errors={errors} setValue={setValue} watch={watch} />
                              </Collapse>
                         </Stack>
                    </SectionCard>

                    {/* Products */}
                    <SectionCard
                         title={t('products.title')}
                         action={
                              <Button
                                   variant="contained"
                                   color="inherit"
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() => productsRef.current?.openCreateDrawer()}
                              >
                                   {t('products.addProduct')}
                              </Button>
                         }
                    >
                         <BreweryProductsTable ref={productsRef} breweryId={brewery.id!} />
                    </SectionCard>

                    {/* Reminders */}
                    <SectionCard
                         title={t('breweries.reminders')}
                         action={
                              <Button
                                   variant="contained"
                                   color="inherit"
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() => remindersRef.current?.openCreateDialog()}
                              >
                                   {t('reminders.addReminder')}
                              </Button>
                         }
                    >
                         <BreweryRemindersTab ref={remindersRef} breweryId={brewery.id!} />
                    </SectionCard>
               </Stack>
          );
     },
);

export default BreweryInlineForm;
