import {useState} from "react";
import {useTranslation} from 'react-i18next';

import {InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import { validateAddress } from "src/utils/validate-address";

import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {AddressForm} from "../../../components/forms/address-form";
import {DrawerLayout} from '../../../layouts/components/drawer-layout';
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {Country, ClientDto, AddressDto, CreateClientDto} from "../../../api/Client";

type ClientDetailViewProps = {
    onClose: () => void
};

export function ClientDetailView({ onClose }: Readonly<ClientDetailViewProps>) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();
    const {triggerRefresh} = useEntityStatsRefresh();

    const [client, setClient] = useState<ClientDto>(new ClientDto({
        name: '',
        officialAddress: new AddressDto({
            streetName: '',
            streetNumber: '',
            city: '',
            zip: '',
            country: Country.Czechia
        })
    }));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactAddressErrors, setContactAddressErrors] = useState<Record<string, string>>({});

    const saveClient = async (): Promise<void> => {
        const {name} = client;

        const newErrors = {
            ...(name ? {} : { name: t('common.required') }),
            ...validateAddress(client.officialAddress)
        };

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return;
        }

        if (client.contactAddress){
            const contactErrors = validateAddress(client.contactAddress);
            setContactAddressErrors(contactErrors);
            if (Object.keys(contactErrors).length > 0) {
                showSnackbar(t('common.validationError'), 'error');
                return;
            }
        }

        setErrors({});
        setContactAddressErrors({});

        try {
            const clientApi = new AuthorizedClient();

            const createDto = new CreateClientDto({
                name: client.name!,
                officialAddress: client.officialAddress!,
                contactAddress: client.contactAddress
            });

            await clientApi.createClientEndpoint(createDto.toJSON());
            triggerRefresh();
            showSnackbar(t('clients.saveSuccess'), 'success');
            onClose();
        } catch (error) {
            console.error('Error saving client:', error);
            showSnackbar(t('clients.saveError'), 'error');
        }
    }

    return (
        <DrawerLayout
            title={t('clients.detailTitle')}
            isLoading={false}
            onClose={onClose}
            onSaveAndClose={saveClient}
        >
            {/* Clients name */}
            <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                <InputLabel htmlFor="Jméno">{t('clients.name')}</InputLabel>
                <OutlinedInput
                    id="name"
                    value={client.name ?? ''}
                    onChange={event => setClient(prev => new ClientDto({
                        ...prev,
                        name: event.target.value
                    }))}
                    label={t('clients.name')}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>

            {/* Official address section */}
            <AddressForm
                title={t('address.officialAddress')}
                address={client.officialAddress ?? new AddressDto()}
                errors={errors}
                onChange={(newAddress) => setClient(prev => new ClientDto({
                    ...prev,
                    officialAddress: newAddress
                }))}
            />

            {/* Contact address section */}
            <AddressForm
                title={t('address.contactAddress')}
                address={client.contactAddress}
                errors={contactAddressErrors}
                onChange={(newAddress) => setClient(prev => new ClientDto({
                    ...prev,
                    contactAddress: newAddress
                }))}
            />
        </DrawerLayout>
    );
}