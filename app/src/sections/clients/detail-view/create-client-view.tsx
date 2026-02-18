import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, InputLabel, FormControl, OutlinedInput } from '@mui/material';

import { validateAddress } from 'src/utils/validate-address';
import { validateContacts, type ContactValidationErrors } from 'src/utils/validate-contacts';

import { useAuthorizedClient } from 'src/api/use-authorized-client';

import { useApiCall } from '../../../hooks/use-api-call';
import { RegionSelect } from './components/region-select';
import { ContactsForm } from './components/contacts-form';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { AddressForm } from '../../../components/forms/address-form';
import { DrawerLayout } from '../../../layouts/components/drawer-layout';
import { CollapsibleForm } from '../../../components/forms/collapsible-form';
import { useEntityStatsRefresh } from '../../../providers/EntityStatsContext';
import { Country, AddressDto, CreateClientDto, CreateClientContactDto } from '../../../api/Client';

import type { Region, ContactType } from '../../../api/Client';

type CreateClientViewProps = {
     region: Region;
     onClose: () => void;
};

export function CreateClientView({ region, onClose }: Readonly<CreateClientViewProps>) {
     const { showSnackbar } = useSnackbar();
     const { executeApiCall } = useApiCall();
     const { t } = useTranslation();
     const { triggerRefresh } = useEntityStatsRefresh();
     const clientApi = useAuthorizedClient();

     const [client, setClient] = useState<CreateClientDto>(
          new CreateClientDto({
               name: '',
               businessName: '',
               region,
               contacts: [],
               officialAddress: new AddressDto({
                    streetName: '',
                    streetNumber: '',
                    city: '',
                    zip: '',
                    country: Country.Czechia,
               }),
          })
     );
     const [errors, setErrors] = useState<Record<string, string>>({});
     const [contactAddressErrors, setContactAddressErrors] = useState<Record<string, string>>({});
     const [contactValidationErrors, setContactValidationErrors] = useState<ContactValidationErrors>({});

     const handleRegionSelect = (newRegion: Region) => {
          setClient(
               (prev) =>
                    new CreateClientDto({
                         ...prev,
                         region: newRegion,
                    })
          );
     };

     const handleChangeContacts = (
          contacts: { type: ContactType; description: string | undefined; value: string }[]
     ) => {
          // Clear validation errors when contacts change
          setContactValidationErrors({});

          setClient(
               (prev) =>
                    new CreateClientDto({
                         ...prev,
                         contacts: contacts.map(
                              (contact) =>
                                   new CreateClientContactDto({
                                        value: contact.value,
                                        type: contact.type,
                                        description: contact.description,
                                   })
                         ),
                    })
          );
     };

     const saveClient = async (): Promise<void> => {
          const { name } = client;

          const newErrors = {
               ...(name ? {} : { name: t('common.required') }),
               ...validateAddress(client.officialAddress),
          };

          // Validace kontaktů - označení nevalidních polí
          const { validationErrors: newContactValidationErrors, hasErrors: hasContactErrors } = validateContacts(
               client.contacts
          );

          setContactValidationErrors(newContactValidationErrors);

          if (Object.keys(newErrors).length > 0 || hasContactErrors) {
               setErrors(newErrors);
               showSnackbar(t('common.validationError'), 'error');
               return;
          }

          if (client.contactAddress) {
               const contactErrors = validateAddress(client.contactAddress);
               setContactAddressErrors(contactErrors);
               if (Object.keys(contactErrors).length > 0) {
                    showSnackbar(t('common.validationError'), 'error');
                    return;
               }
          }

          setErrors({});
          setContactAddressErrors({});
          setContactValidationErrors({});

          const result = await executeApiCall(
               () => clientApi.createClientEndpoint(client.toJSON()),
               t('clients.saveError')
          );

          if (result) {
               triggerRefresh();
               showSnackbar(t('clients.saveSuccess'), 'success');
               onClose();
          }
     };

     return (
          <DrawerLayout
               title={t('clients.detailTitle')}
               isLoading={false}
               onClose={onClose}
               onSaveAndClose={saveClient}
               width={900}
          >
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 2 }}>
                    {/* Client name */}
                    <FormControl fullWidth error={!!errors.name} sx={{ mt: 1 }}>
                         <InputLabel htmlFor="client-name">{t('clients.name')}</InputLabel>
                         <OutlinedInput
                              id="client-name"
                              value={client.name ?? ''}
                              onChange={(event) =>
                                   setClient(
                                        (prev) =>
                                             new CreateClientDto({
                                                  ...prev,
                                                  name: event.target.value,
                                             })
                                   )
                              }
                              label={t('clients.name')}
                         />
                    </FormControl>

                    <RegionSelect
                         selectedRegion={client.region}
                         errors={errors}
                         onSelect={handleRegionSelect}
                         maxWidth={30}
                    />
               </Box>

               {/* Client business name */}
               <FormControl fullWidth sx={{ mt: 1 }}>
                    <InputLabel htmlFor="client-business-name">{t('clients.businessName')}</InputLabel>
                    <OutlinedInput
                         id="client-business-name"
                         value={client.businessName ?? ''}
                         onChange={(event) =>
                              setClient(
                                   (prev) =>
                                        new CreateClientDto({
                                             ...prev,
                                             businessName: event.target.value,
                                        })
                              )
                         }
                         label={t('clients.businessName')}
                    />
               </FormControl>

               <ContactsForm
                    selectedContacts={client.contacts ?? []}
                    onContactsChanged={handleChangeContacts}
                    validationErrors={contactValidationErrors}
               />

               <CollapsibleForm title={t('address.address')}>
                    <Box sx={{ ml: 1, mr: 1, mb: 2 }}>
                         {/* Official address section */}
                         <AddressForm
                              title={t('address.officialAddress')}
                              headerVariant="subtitle2"
                              address={client.officialAddress ?? new AddressDto()}
                              errors={errors}
                              onChange={(newAddress) =>
                                   setClient(
                                        (prev) =>
                                             new CreateClientDto({
                                                  ...prev,
                                                  officialAddress: newAddress,
                                             })
                                   )
                              }
                         />

                         {/* Contact address section */}
                         <AddressForm
                              title={t('address.contactAddress')}
                              headerVariant="subtitle2"
                              address={client.contactAddress ?? new AddressDto()}
                              errors={contactAddressErrors}
                              onChange={(newAddress) =>
                                   setClient(
                                        (prev) =>
                                             new CreateClientDto({
                                                  ...prev,
                                                  contactAddress: newAddress,
                                             })
                                   )
                              }
                         />
                    </Box>
               </CollapsibleForm>
          </DrawerLayout>
     );
}
