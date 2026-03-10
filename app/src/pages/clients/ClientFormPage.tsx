import type {
     Region,
     ContactType} from 'src/generated/api-client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import DeleteIcon from '@mui/icons-material/Delete';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useCreateClient } from 'src/hooks/useClients';

import {
     CreateClientDto,
     CreateClientContactDto,
} from 'src/generated/api-client';

import PageHeader from 'src/components/common/PageHeader';
import AddressForm from 'src/components/common/AddressForm';

import {
     clientSchema,
     defaultValues,
     regionOptions,
     defaultAddress,
     buildAddressDto,
     contactTypeOptions,
} from './clientFormSchema';

import type { ClientFormValues } from './clientFormSchema';

// ---------------------------------------------------------------------------
// ClientFormPage (create only)
// ---------------------------------------------------------------------------

export default function ClientFormPage() {
     const { t } = useTranslation();
     const navigate = useNavigate();

     const createMutation = useCreateClient();

     const [hasContactAddress, setHasContactAddress] = useState(false);

     const {
          control,
          handleSubmit,
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

     const handleContactToggle = (checked: boolean) => {
          setHasContactAddress(checked);
          setValue('hasContactAddress', checked);
          if (checked) {
               setValue('contactAddress', defaultAddress);
          } else {
               setValue('contactAddress', undefined);
          }
     };

     const onSubmit = (data: ClientFormValues) => {
          const officialAddress = buildAddressDto(data.officialAddress);
          const contactAddress =
               data.hasContactAddress && data.contactAddress
                    ? buildAddressDto(data.contactAddress)
                    : undefined;

          const dto = new CreateClientDto();
          dto.name = data.name;
          dto.businessName = data.businessName || undefined;
          dto.region = data.region as unknown as Region;
          dto.officialAddress = officialAddress;
          dto.contactAddress = contactAddress;
          dto.contacts = data.contacts.map((c) => {
               const contactDto = new CreateClientContactDto();
               contactDto.type = c.type as unknown as ContactType;
               contactDto.value = c.value;
               contactDto.description = c.description || undefined;
               return contactDto;
          });

          createMutation.mutate(dto, { onSuccess: () => navigate('/clients') });
     };

     return (
          <Box>
               <PageHeader title={t('clients.addClient')} />

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
                                                       label={t('clients.name')}
                                                       fullWidth
                                                       error={!!errors.name}
                                                       helperText={errors.name?.message as string}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Business Name */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="businessName"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       label={t('clients.businessName')}
                                                       fullWidth
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Region */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="region"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       select
                                                       label={t('clients.region')}
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
                                                       onChange={(e) =>
                                                            handleContactToggle(e.target.checked)
                                                       }
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

                                   {/* Contacts section */}
                                   <Grid size={12}>
                                        <Typography variant="subtitle1" sx={{ mb: 2 }}>
                                             {t('clients.contacts')}
                                        </Typography>

                                        <Stack spacing={2}>
                                             {fields.map((field, index) => (
                                                  <Stack
                                                       key={field.id}
                                                       direction={{ xs: 'column', sm: 'row' }}
                                                       spacing={2}
                                                       alignItems="flex-start"
                                                  >
                                                       <Controller
                                                            name={`contacts.${index}.type`}
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                 <TextField
                                                                      {...f}
                                                                      select
                                                                      label={t('clients.contactType')}
                                                                      sx={{ minWidth: 140 }}
                                                                      size="small"
                                                                      error={
                                                                           !!errors.contacts?.[index]
                                                                                ?.type
                                                                      }
                                                                 >
                                                                      {contactTypeOptions.map(
                                                                           (opt) => (
                                                                                <MenuItem
                                                                                     key={opt.value}
                                                                                     value={
                                                                                          opt.value
                                                                                     }
                                                                                >
                                                                                     {t(
                                                                                          opt.labelKey,
                                                                                     )}
                                                                                </MenuItem>
                                                                           ),
                                                                      )}
                                                                 </TextField>
                                                            )}
                                                       />

                                                       <Controller
                                                            name={`contacts.${index}.value`}
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                 <TextField
                                                                      {...f}
                                                                      label={t(
                                                                           'clients.contactValue',
                                                                      )}
                                                                      fullWidth
                                                                      size="small"
                                                                      error={
                                                                           !!errors.contacts?.[index]
                                                                                ?.value
                                                                      }
                                                                      helperText={
                                                                           errors.contacts?.[index]
                                                                                ?.value
                                                                                ?.message as string
                                                                      }
                                                                 />
                                                            )}
                                                       />

                                                       <Controller
                                                            name={`contacts.${index}.description`}
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                 <TextField
                                                                      {...f}
                                                                      label={t(
                                                                           'clients.contactDescription',
                                                                      )}
                                                                      fullWidth
                                                                      size="small"
                                                                 />
                                                            )}
                                                       />

                                                       <IconButton
                                                            color="error"
                                                            onClick={() => remove(index)}
                                                            sx={{ mt: 0.5 }}
                                                       >
                                                            <DeleteIcon />
                                                       </IconButton>
                                                  </Stack>
                                             ))}

                                             <Button
                                                  variant="outlined"
                                                  startIcon={<AddIcon />}
                                                  onClick={() =>
                                                       append({
                                                            type: 'Email',
                                                            value: '',
                                                            description: '',
                                                       })
                                                  }
                                                  sx={{ alignSelf: 'flex-start' }}
                                             >
                                                  {t('clients.addContact')}
                                             </Button>
                                        </Stack>
                                   </Grid>
                              </Grid>

                              {/* Actions */}
                              <Stack
                                   direction="row"
                                   spacing={2}
                                   sx={{ mt: 3, justifyContent: 'flex-end' }}
                              >
                                   <Button variant="outlined" onClick={() => navigate('/clients')}>
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
                    </CardContent>
               </Card>
          </Box>
     );
}
