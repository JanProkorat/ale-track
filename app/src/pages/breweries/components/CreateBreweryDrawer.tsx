import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useCreateBrewery } from 'src/hooks/useBreweries';

import { CreateBreweryDto } from 'src/generated/api-client';

import AddressForm from 'src/components/common/AddressForm';

import {
     brewerySchema,
     defaultValues,
     defaultAddress,
     buildAddressDto,
} from '../breweryFormSchema';

import type { BreweryFormValues } from '../breweryFormSchema';

// ---------------------------------------------------------------------------

interface CreateBreweryDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (breweryId: string) => void;
}

export default function CreateBreweryDrawer({
     open,
     onClose,
     onCreated,
}: CreateBreweryDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateBrewery();

     const {
          control,
          handleSubmit,
          watch,
          setValue,
          reset,
          formState: { errors },
     } = useForm<BreweryFormValues>({
          resolver: zodResolver(brewerySchema),
          defaultValues,
     });

     const hasContactAddress = watch('hasContactAddress');

     const handleDrawerOpen = () => {
          reset(defaultValues);
     };

     const onSubmit = (data: BreweryFormValues) => {
          const officialAddress = buildAddressDto(data.officialAddress);
          const contactAddress =
               data.hasContactAddress && data.contactAddress
                    ? buildAddressDto(data.contactAddress)
                    : undefined;

          const dto = new CreateBreweryDto();
          dto.name = data.name;
          dto.color = data.color;
          dto.officialAddress = officialAddress;
          dto.contactAddress = contactAddress;

          createMutation.mutate(dto, {
               onSuccess: (newBreweryId) => {
                    onCreated(newBreweryId);
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
                    {t('breweries.addBrewery')}
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
                                        label={t('breweries.name')}
                                        fullWidth
                                        size="small"
                                        error={!!errors.name}
                                        helperText={errors.name?.message as string}
                                   />
                              )}
                         />

                         {/* Color */}
                         <Controller
                              name="color"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('breweries.color')}
                                        type="color"
                                        fullWidth
                                        size="small"
                                        error={!!errors.color}
                                        helperText={errors.color?.message as string}
                                        slotProps={{
                                             inputLabel: { shrink: true },
                                        }}
                                   />
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
