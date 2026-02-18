import { useTranslation } from "react-i18next";
import { varAlpha } from "minimal-shared/utils";
import React, { useState, useCallback } from "react";

import { linearProgressClasses } from "@mui/material/LinearProgress";
import { Box, InputLabel, Typography, FormControl, OutlinedInput, FormHelperText, LinearProgress } from "@mui/material";

import { NotesView } from "../../notes/view/notes-view";
import { useApiCall } from "../../../hooks/use-api-call";
import { RegionSelect } from "./components/region-select";
import { ContactsForm } from "./components/contacts-form";
import { useAuthorizedClient } from "src/api/use-authorized-client";
import { validateAddress } from "../../../utils/validate-address";
import { useSnackbar } from "../../../providers/SnackbarProvider";
import { AddressForm } from "../../../components/forms/address-form";
import { ClientRemindersView } from "./components/client-reminders-view";
import { CollapsibleForm } from "../../../components/forms/collapsible-form";
import { useEntityStatsRefresh } from "../../../providers/EntityStatsContext";
import { DetailCardLayout } from "../../../layouts/dashboard/detail-card-layout";
import { validateContacts, type ContactValidationErrors } from "../../../utils/validate-contacts";
import { AddressDto, SectionType, UpdateClientDto, UpdateClientContactDto } from "../../../api/Client";

import type { Region, ContactType } from "../../../api/Client";

type UpdateClientViewProps = {
    id: string;
    shouldCheckPendingChanges: boolean;
    onDelete: () => void;
    onConfirmed: (shouldLoadNewDetail: boolean) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
};

export function UpdateClientView(
    {
        id,
        shouldCheckPendingChanges,
        onDelete,
        onConfirmed,
        onHasChangesChange,
    }: Readonly<UpdateClientViewProps>) {
    const { showSnackbar } = useSnackbar();
    const { executeApiCall } = useApiCall();
    const { t } = useTranslation();
    const { triggerRefresh } = useEntityStatsRefresh();
    const clientApi = useAuthorizedClient();

    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [client, setClient] = useState<UpdateClientDto | null>(null);
    const [initialClient, setInitialClient] = useState<UpdateClientDto | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactAddressErrors, setContactAddressErrors] = useState<Record<string, string>>({});
    const [contactValidationErrors, setContactValidationErrors] = useState<ContactValidationErrors>({});

    const fetchClient = useCallback(async () => {
        setInitialLoading(true);

        const data = await executeApiCall(
            () => clientApi.getClientDetailEndpoint(id),
            t('clients.loadDetailError')
        );

        if (data) {
            const clientToUpdate = new UpdateClientDto({
                name: data.name!,
                region: data.region!,
                businessName: data.businessName,
                officialAddress: data.officialAddress,
                contactAddress: data.contactAddress,
                contacts: (data.contacts ?? []).map((contact) => new UpdateClientContactDto({
                    value: contact.value,
                    type: contact.type,
                    description: contact.description
                }))
            });
            setClient(clientToUpdate);
            setInitialClient(clientToUpdate);
        }
        setInitialLoading(false);
    }, [id, executeApiCall, t]);

    const saveClient = async (): Promise<boolean> => {
        setInitialLoading(true);

        const { name } = client as UpdateClientDto;
        const newErrors = {
            ...(name ? {} : { name: t('common.required') }),
            ...validateAddress(client!.officialAddress)
        };

        const { validationErrors: newContactValidationErrors, hasErrors: hasContactErrors } = validateContacts(client!.contacts);

        setContactValidationErrors(newContactValidationErrors);

        if (Object.keys(newErrors).length > 0 || hasContactErrors) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            setInitialLoading(false);
            return false;
        }

        if (client!.contactAddress) {
            const contactErrors = validateAddress(client!.contactAddress);
            setContactAddressErrors(contactErrors);
            if (Object.keys(contactErrors).length > 0) {
                showSnackbar(t('common.validationError'), 'error');
                setInitialLoading(false);
                return false;
            }
        }

        setErrors({});
        setContactAddressErrors({});
        setContactValidationErrors({});

        const updateDto = new UpdateClientDto({
            name: client!.name,
            officialAddress: client!.officialAddress!,
            contactAddress: client!.contactAddress,
            region: client!.region,
            businessName: client!.businessName,
            contacts: (client?.contacts ?? []).map(contact => new UpdateClientContactDto({
                value: contact.value,
                type: contact.type,
                description: contact.description
            }))
        });

        let hasError = false;
        await executeApiCall(
            () => clientApi.updateClientEndpoint(id, updateDto.toJSON()),
            t('clients.saveError'),
            { onError: () => { hasError = true; } }
        );

        setInitialLoading(false);

        if (hasError) {
            return false;
        }

        showSnackbar(t('clients.saveSuccess'), 'success');
        onConfirmed(true);
        return true;
    }

    const deleteClient = useCallback(async () => {
        const result = await executeApiCall(
            () => clientApi.deleteClientEndpoint(id)
        );

        if (result) {
            triggerRefresh();
            showSnackbar('Client deleted', 'success');
        }
    }, [id, executeApiCall, showSnackbar, triggerRefresh]);

    const resetClient = useCallback(() => {
        setClient(initialClient);
        setErrors({});
        setContactValidationErrors({});
        setContactAddressErrors({});
    }, [initialClient]);

    const handleRegionSelect = (region: Region) => {
        setClient(prev => new UpdateClientDto({
            ...prev,
            region
        } as UpdateClientDto))
    }

    const handleChangeContacts = (contacts: { type: ContactType, description: string | undefined, value: string }[]) => {
        setContactValidationErrors({});

        setClient(prev => new UpdateClientDto({
            ...prev,
            contacts: contacts.map((contact) => new UpdateClientContactDto({
                value: contact.value,
                type: contact.type,
                description: contact.description
            }))
        } as UpdateClientDto))
    }

    if (initialLoading || client === null) {
        return (
            <DetailCardLayout
                id={id}
                shouldCheckPendingChanges={shouldCheckPendingChanges}
                onDelete={onDelete}
                onConfirmed={onConfirmed}
                onHasChangesChange={onHasChangesChange}
                onProgressbarVisibilityChange={setInitialLoading}
                title={t('clients.detailTitle')}
                noDetailMessage={t('clients.noDetailToDisplay')}
                entity={client}
                initialEntity={initialClient}
                onFetchEntity={fetchClient}
                onSaveEntity={saveClient}
                onDeleteEntity={deleteClient}
                onResetEntity={resetClient}
                deleteConfirmMessage={t('clients.deleteConfirm', { name: client?.name ?? '' })}
                disabled={client === null}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                    {initialLoading ? (
                        <LinearProgress
                            sx={{
                                width: '40%',
                                bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
                            }}
                        />
                    ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                            {t('clients.loadDetailError')}
                        </Typography>
                    )}
                </Box>
            </DetailCardLayout>
        );
    }

    return (
        <DetailCardLayout
            id={id}
            shouldCheckPendingChanges={shouldCheckPendingChanges}
            onDelete={onDelete}
            onConfirmed={onConfirmed}
            onHasChangesChange={onHasChangesChange}
            onProgressbarVisibilityChange={setInitialLoading}
            title={t('clients.detailTitle')}
            noDetailMessage={t('clients.noDetailToDisplay')}
            entity={client}
            initialEntity={initialClient}
            onFetchEntity={fetchClient}
            onSaveEntity={saveClient}
            onDeleteEntity={deleteClient}
            onResetEntity={resetClient}
            deleteConfirmMessage={t('clients.deleteConfirm', { name: client?.name ?? '' })}
            disabled={false}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 2 }}>
                {/* Client name */}
                <FormControl fullWidth error={!!errors.name} sx={{ mt: 1 }}>
                    <InputLabel htmlFor="client-name">{t('clients.name')}</InputLabel>
                    <OutlinedInput
                        id="client-name"
                        value={client.name ?? ''}
                        onChange={event => setClient(prev => new UpdateClientDto({
                            ...prev,
                            name: event.target.value
                        } as UpdateClientDto))}
                        label={t('clients.name')}
                    />
                    {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
                </FormControl>

                {/* Client business name */}
                <FormControl fullWidth sx={{ mt: 1 }}>
                    <InputLabel htmlFor="client-business-name">{t('clients.businessName')}</InputLabel>
                    <OutlinedInput
                        id="client-business-name"
                        value={client.businessName ?? ''}
                        onChange={event => setClient(prev => new UpdateClientDto({
                            ...prev,
                            businessName: event.target.value
                        } as UpdateClientDto))}
                        label={t('clients.businessName')}
                    />
                </FormControl>

                <RegionSelect selectedRegion={client.region} errors={errors} onSelect={handleRegionSelect} />
            </Box>

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
                        onChange={(newAddress) => setClient(prev => new UpdateClientDto({
                            ...prev,
                            officialAddress: newAddress
                        } as UpdateClientDto))}
                    />

                    {/* Contact address section */}
                    <AddressForm
                        title={t('address.contactAddress')}
                        headerVariant="subtitle2"
                        address={client.contactAddress ?? new AddressDto()}
                        errors={contactAddressErrors}
                        onChange={(newAddress) => setClient(prev => new UpdateClientDto({
                            ...prev,
                            contactAddress: newAddress
                        } as UpdateClientDto))}
                    />
                </Box>
            </CollapsibleForm>

            <ClientRemindersView clientId={id} />
            <NotesView parentId={id} parentType={SectionType.Client} />
        </DetailCardLayout>
    );
}