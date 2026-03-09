import type { ClientDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import EmailIcon from '@mui/icons-material/Email';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import FormControlLabel from '@mui/material/FormControlLabel';

import EmptyState from 'src/components/common/EmptyState';
import AddressForm from 'src/components/common/AddressForm';
import SectionCard from 'src/components/common/SectionCard';

import ClientNotesTab from './ClientNotesTab';
import ClientRemindersTab from './ClientRemindersTab';

import type { ClientNotesTabHandle } from './ClientNotesTab';
import type { ClientRemindersTabHandle } from './ClientRemindersTab';
import {
     clientSchema,
     defaultValues,
     regionOptions,
     defaultAddress,
     contactTypeOptions,
} from '../clientFormSchema';

import type { ClientFormValues } from '../clientFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     name: string;
     region: string;
}

interface ClientInlineFormProps {
     client: ClientDto;
     onSubmit: (data: ClientFormValues) => void;
     onFormStateChange: (state: FormHeaderState) => void;
}

// ---------------------------------------------------------------------------
// ClientInlineForm
// ---------------------------------------------------------------------------

function mapClientToFormValues(client: ClientDto): ClientFormValues {
     return {
          name: client.name ?? '',
          businessName: client.businessName ?? '',
          region: (client.region as unknown as string) ?? 'ZittauCity',
          officialAddress: client.officialAddress
               ? {
                      streetName: client.officialAddress.streetName,
                      streetNumber: client.officialAddress.streetNumber,
                      city: client.officialAddress.city,
                      zip: client.officialAddress.zip,
                      country: client.officialAddress.country as unknown as string,
                      latitude: client.officialAddress.latitude,
                      longitude: client.officialAddress.longitude,
                 }
               : defaultAddress,
          hasContactAddress: !!client.contactAddress,
          contactAddress: client.contactAddress
               ? {
                      streetName: client.contactAddress.streetName,
                      streetNumber: client.contactAddress.streetNumber,
                      city: client.contactAddress.city,
                      zip: client.contactAddress.zip,
                      country: client.contactAddress.country as unknown as string,
                      latitude: client.contactAddress.latitude,
                      longitude: client.contactAddress.longitude,
                 }
               : defaultAddress,
          contacts: (client.contacts ?? []).map((c) => ({
               type: (c.type as unknown as string) ?? 'Email',
               value: c.value ?? '',
               description: c.description ?? '',
          })),
     };
}

const ClientInlineForm = forwardRef<ClientInlineFormHandle, ClientInlineFormProps>(
     function ClientInlineForm({ client, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const notesRef = useRef<ClientNotesTabHandle>(null);
          const remindersRef = useRef<ClientRemindersTabHandle>(null);
          const initialValuesRef = useRef<ClientFormValues>(defaultValues);
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
          } = useForm<ClientFormValues>({
               resolver: zodResolver(clientSchema),
               defaultValues,
          });

          const { fields, append, remove } = useFieldArray({
               control,
               name: 'contacts',
          });

          const contacts = watch('contacts');
          const hasContactAddress = watch('hasContactAddress');
          const watchedName = watch('name');
          const watchedRegion = watch('region');

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
                    region: watchedRegion,
               });
          }, [dirty, watchedName, watchedRegion, onFormStateChange]);

          // Reset form when client data changes
          useEffect(() => {
               if (!client) return;
               const values = mapClientToFormValues(client);
               initialValuesRef.current = values;
               reset(values);
               setDirty(false);
          }, [client, reset]);

          const addContactButton = (
               <Button
                    variant="contained"
                    color="inherit"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                         append({
                              type: 'Email',
                              value: '',
                              description: '',
                         });
                         markDirty();
                    }}
               >
                    {t('clients.addContact')}
               </Button>
          );

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('clients.info')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 8 }}>
                                   <Controller
                                        name="name"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('clients.name')}
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
                                        name="region"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  select
                                                  label={t('clients.region')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.region}
                                                  helperText={errors.region?.message as string}
                                             >
                                                  {regionOptions.map((opt) => (
                                                       <MenuItem key={opt.value} value={opt.value}>
                                                            {t(opt.labelKey)}
                                                       </MenuItem>
                                                  ))}
                                             </TextField>
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="businessName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('clients.businessName')}
                                                  size="small"
                                                  fullWidth
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>
                    </SectionCard>

                    {/* Contacts */}
                    <SectionCard
                         title={`${t('clients.contacts')} (${contacts?.length ?? 0})`}
                         action={fields.length > 0 ? addContactButton : undefined}
                    >
                         {fields.length === 0 ? (
                              <EmptyState action={addContactButton} />
                         ) : (
                              <Stack spacing={2}>
                                   {fields.map((field, index) => (
                                        <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                                             <Grid container spacing={1} alignItems="center">
                                                  <Grid size={{ xs: 12, sm: 3 }}>
                                                       <Controller
                                                            name={`contacts.${index}.type`}
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                 <TextField
                                                                      {...f}
                                                                      select
                                                                      label={t('clients.contactType')}
                                                                      size="small"
                                                                      fullWidth
                                                                      error={!!errors.contacts?.[index]?.type}
                                                                      slotProps={{
                                                                           input: {
                                                                                startAdornment:
                                                                                     contacts?.[index]?.type === 'Phone' ? (
                                                                                          <PhoneInTalkIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                                                                     ) : (
                                                                                          <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                                                                     ),
                                                                           },
                                                                      }}
                                                                 >
                                                                      {contactTypeOptions.map((opt) => (
                                                                           <MenuItem key={opt.value} value={opt.value}>
                                                                                {t(opt.labelKey)}
                                                                           </MenuItem>
                                                                      ))}
                                                                 </TextField>
                                                            )}
                                                       />
                                                  </Grid>
                                                  <Grid size={{ xs: 12, sm: 4 }}>
                                                       <Controller
                                                            name={`contacts.${index}.description`}
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                 <TextField
                                                                      {...f}
                                                                      label={t('clients.contactDescription')}
                                                                      size="small"
                                                                      fullWidth
                                                                 />
                                                            )}
                                                       />
                                                  </Grid>
                                                  <Grid size={{ xs: 12, sm: 4 }}>
                                                       <Controller
                                                            name={`contacts.${index}.value`}
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                 <TextField
                                                                      {...f}
                                                                      label={t('clients.contactValue')}
                                                                      size="small"
                                                                      fullWidth
                                                                      error={!!errors.contacts?.[index]?.value}
                                                                      helperText={errors.contacts?.[index]?.value?.message as string}
                                                                 />
                                                            )}
                                                       />
                                                  </Grid>
                                                  <Grid size={{ xs: 12, sm: 1 }}>
                                                       <IconButton size="small" color="error" onClick={() => { remove(index); markDirty(); }}>
                                                            <DeleteIcon />
                                                       </IconButton>
                                                  </Grid>
                                             </Grid>
                                        </Paper>
                                   ))}
                              </Stack>
                         )}
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

                    {/* Notes */}
                    <SectionCard
                         title={t('clients.notes')}
                         action={
                              <Button
                                   variant="contained"
                                   color="inherit"
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() => notesRef.current?.openCreateDialog()}
                              >
                                   {t('clients.addNote')}
                              </Button>
                         }
                    >
                         <ClientNotesTab ref={notesRef} clientId={client.id!} />
                    </SectionCard>

                    {/* Reminders */}
                    <SectionCard
                         title={t('clients.reminders')}
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
                         <ClientRemindersTab ref={remindersRef} clientId={client.id!} />
                    </SectionCard>
               </Stack>
          );
     },
);

export default ClientInlineForm;
