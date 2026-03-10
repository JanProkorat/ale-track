import type {
     Region,
     ContactType} from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DeleteIcon from '@mui/icons-material/Delete';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useCreateClient } from 'src/hooks/useClients';

import {
     CreateClientDto,
     CreateClientContactDto,
} from 'src/generated/api-client';

import AddressForm from 'src/components/common/AddressForm';

import {
     clientSchema,
     defaultValues,
     regionOptions,
     defaultAddress,
     buildAddressDto,
     contactTypeOptions,
} from '../clientFormSchema';

import type { ClientFormValues } from '../clientFormSchema';

// ---------------------------------------------------------------------------

interface CreateClientDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (clientId: string, region: string) => void;
     initialRegion?: string;
}

export default function CreateClientDrawer({
     open,
     onClose,
     onCreated,
     initialRegion,
}: CreateClientDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateClient();

     const {
          control,
          handleSubmit,
          watch,
          setValue,
          reset,
          formState: { errors },
     } = useForm<ClientFormValues>({
          resolver: zodResolver(clientSchema),
          defaultValues: {
               ...defaultValues,
               region: initialRegion ?? defaultValues.region,
          },
     });

     const { fields, append, remove } = useFieldArray({
          control,
          name: 'contacts',
     });

     const hasContactAddress = watch('hasContactAddress');

     // Reset form when drawer opens with potentially new initialRegion
     const handleDrawerOpen = () => {
          reset({
               ...defaultValues,
               region: initialRegion ?? defaultValues.region,
          });
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

          createMutation.mutate(dto, {
               onSuccess: (newClientId) => {
                    onCreated(newClientId, data.region);
                    reset(defaultValues);
               },
          });
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
                    {t('clients.addClient')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         {/* Name */}
                         <Controller
                              name="name"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('clients.name')}
                                        fullWidth
                                        size="small"
                                        error={!!errors.name}
                                        helperText={errors.name?.message as string}
                                   />
                              )}
                         />

                         {/* Business Name */}
                         <Controller
                              name="businessName"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('clients.businessName')}
                                        fullWidth
                                        size="small"
                                   />
                              )}
                         />

                         {/* Region */}
                         <Controller
                              name="region"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        select
                                        label={t('clients.region')}
                                        fullWidth
                                        size="small"
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

                         <Divider />

                         {/* Official address */}
                         <Typography variant="subtitle2">
                              {t('clients.officialAddress')}
                         </Typography>
                         <AddressForm prefix="officialAddress" control={control} errors={errors} setValue={setValue} watch={watch} />

                         {/* Contact address */}
                         <FormControlLabel
                              control={
                                   <Checkbox
                                        checked={!!hasContactAddress}
                                        onChange={(e) => {
                                             setValue('hasContactAddress', e.target.checked);
                                             if (e.target.checked) {
                                                  setValue('contactAddress', defaultAddress);
                                             }
                                        }}
                                   />
                              }
                              label={t('clients.contactAddress')}
                         />
                         <Collapse in={!!hasContactAddress}>
                              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                   {t('clients.contactAddress')}
                              </Typography>
                              <AddressForm
                                   prefix="contactAddress"
                                   control={control}
                                   errors={errors}
                                   setValue={setValue}
                                   watch={watch}
                              />
                         </Collapse>

                         <Divider />

                         {/* Contacts */}
                         <Stack direction="row" alignItems="center">
                              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                                   {t('clients.contacts')}
                              </Typography>
                              <Button
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() =>
                                        append({ type: 'Email', value: '', description: '' })
                                   }
                              >
                                   {t('clients.addContact')}
                              </Button>
                         </Stack>

                         {fields.map((field, index) => (
                              <Grid container key={field.id} spacing={1} alignItems="center">
                                   <Grid size={{ xs: 12, sm: 4 }}>
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
                                                  >
                                                       {contactTypeOptions.map((opt) => (
                                                            <MenuItem
                                                                 key={opt.value}
                                                                 value={opt.value}
                                                            >
                                                                 {t(opt.labelKey)}
                                                            </MenuItem>
                                                       ))}
                                                  </TextField>
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
                                                       helperText={
                                                            errors.contacts?.[index]?.value
                                                                 ?.message as string
                                                       }
                                                  />
                                             )}
                                        />
                                   </Grid>
                                   <Grid size={{ xs: 10, sm: 3 }}>
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
                                   <Grid size={{ xs: 2, sm: 1 }}>
                                        <IconButton
                                             size="small"
                                             color="error"
                                             onClick={() => remove(index)}
                                        >
                                             <DeleteIcon fontSize="small" />
                                        </IconButton>
                                   </Grid>
                              </Grid>
                         ))}
                    </Stack>

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
