import {useTranslation} from "react-i18next";
import React, {useState, useCallback} from "react";

import {InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {validateAddress} from "../../../utils/validate-address";
import {AddressForm} from "../../../components/forms/address-form";
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {DetailCardLayout} from "../../../layouts/dashboard/detail-card-layout";
import {
    Country,
    ClientDto,
    AddressDto,
    UpdateClientDto
} from "../../../api/Client";

type ClientDetailCardProps = {
    id: string | null;
    shouldCheckPendingChanges: boolean;
    onDelete: () => void;
    onConfirmed: (shouldLoadNewDetail: boolean) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onProgressbarVisibilityChange: (isVisible: boolean) => void;
};

export function ClientDetailCard(
    {
        id,
        shouldCheckPendingChanges,
        onDelete,
        onConfirmed,
        onHasChangesChange,
        onProgressbarVisibilityChange
    }: Readonly<ClientDetailCardProps>) {
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
        }),
        contactAddress: new AddressDto({
            streetName: '',
            streetNumber: '',
            city: '',
            zip: '',
            country: Country.Czechia
        })
    }));

    const [initialClient, setInitialClient] = useState<ClientDto | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactAddressErrors, setContactAddressErrors] = useState<Record<string, string>>({});

    const fetchClient = useCallback(async () => {
        try {
            onProgressbarVisibilityChange(true);
            const clientApi = new AuthorizedClient();

            const data = await clientApi.getClientDetailEndpoint(id!);
            if (data) {
                setClient(data);
                setInitialClient(new ClientDto(data));
            }
        } catch (error) {
            console.error('Error fetching client:', error);
            showSnackbar(t('clients.loadDetailError'), 'error');
        } finally {
            onProgressbarVisibilityChange(false);
        }
    }, [id, onProgressbarVisibilityChange, showSnackbar, t]);

    const saveClient = async (): Promise<boolean> => {
        onProgressbarVisibilityChange(true);

        const {name} = client;
        const newErrors = {
            ...(name ? {} : { name: t('common.required') }),
            ...validateAddress(client.officialAddress)
        };

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return false;
        }

        if (client.contactAddress){
            const contactErrors = validateAddress(client.contactAddress);
            setContactAddressErrors(contactErrors);
            if (Object.keys(contactErrors).length > 0) {
                showSnackbar(t('common.validationError'), 'error');
                return false;
            }
        }

        setErrors({});
        setContactAddressErrors({});

        try {
            const clientApi = new AuthorizedClient();

            const updateDto = new UpdateClientDto({
                name: client.name!,
                officialAddress: client.officialAddress!,
                contactAddress: client.contactAddress
            });

            await clientApi.updateClientEndpoint(id!, updateDto.toJSON()).then(() => onConfirmed(true));

            showSnackbar(t('clients.saveSuccess'), 'success');
            return true;
        } catch (error) {
            console.error('Error saving client:', error);
            showSnackbar(t('clients.saveError'), 'error');
            return false;
        } finally {
            onProgressbarVisibilityChange(false);
        }
    }

    const deleteClient = useCallback(async () => {
        const clientApi = new AuthorizedClient();
        await clientApi.deleteClientEndpoint(id!);
        triggerRefresh();
        showSnackbar('Client deleted', 'success');
    }, [id, showSnackbar]);

    const resetClient = useCallback(() => {
        setClient(initialClient!);
    }, [initialClient]);

    return (
        <DetailCardLayout
            id={id}
            shouldCheckPendingChanges={shouldCheckPendingChanges}
            onDelete={onDelete}
            onConfirmed={onConfirmed}
            onHasChangesChange={onHasChangesChange}
            onProgressbarVisibilityChange={onProgressbarVisibilityChange}
            title={t('clients.detailTitle')}
            noDetailMessage={t('clients.noDetailToDisplay')}
            entity={client}
            initialEntity={initialClient}
            onFetchEntity={fetchClient}
            onSaveEntity={saveClient}
            onDeleteEntity={deleteClient}
            onResetEntity={resetClient}
            deleteConfirmMessage={t('clients.deleteConfirm', {name: client.name})}
            resetConfirmMessage={t('common.resetConfirm')}
            pendingChangesConfirmMessage={t('common.pendingChangesConfirm')}
        >
            {/* Client name */}
            <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                <InputLabel htmlFor="name">{t('clients.name')}</InputLabel>
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
                address={client.contactAddress ?? new AddressDto()}
                errors={contactAddressErrors}
                onChange={(newAddress) => setClient(prev => new ClientDto({
                    ...prev,
                    contactAddress: newAddress
                }))}
            />
        </DetailCardLayout>
    );
}