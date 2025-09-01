import {useTranslation} from "react-i18next";
import React, {useState, useCallback} from "react";

import {Box, InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import {ProductsView} from "../../products/view";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {validateAddress} from "../../../utils/validate-address";
import {AddressForm} from "../../../components/forms/address-form";
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {DetailCardLayout} from "../../../layouts/dashboard/detail-card-layout";
import {Country, AddressDto, BreweryDto, UpdateBreweryDto} from "../../../api/Client";

type BreweryDetailCardProps = {
    id: string | null;
    shouldCheckPendingChanges: boolean;
    onDelete: () => void;
    onConfirmed: (shouldLoadNewDetail: boolean) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onProgressbarVisibilityChange: (isVisible: boolean) => void;
};

export function BreweryDetailCard(
    {
        id,
        shouldCheckPendingChanges,
        onDelete,
        onConfirmed,
        onHasChangesChange,
        onProgressbarVisibilityChange
    }: Readonly<BreweryDetailCardProps>) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();
    const {triggerRefresh} = useEntityStatsRefresh();

    const [brewery, setBrewery] = useState<BreweryDto>(new BreweryDto({
        name: '',
        officialAddress: new AddressDto({
            streetName: '',
            streetNumber: '',
            city: '',
            zip: '',
            country: Country.Czechia
        })
    }));

    const [initialBrewery, setInitialBrewery] = useState<BreweryDto | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactAddressErrors, setContactAddressErrors] = useState<Record<string, string>>({});

    const fetchBrewery = useCallback(async () => {
        try {
            const clientApi = new AuthorizedClient();

            const data = await clientApi.getBreweryDetailEndpoint(id!);
            if (data) {
                setBrewery(data);
                setInitialBrewery(new BreweryDto(data));
            }
        } catch (error) {
            console.error('Error fetching brewery:', error);
            showSnackbar(t('breweries.loadDetailError'), 'error');
        } finally {
            onProgressbarVisibilityChange(false);
        }
    }, [id, onProgressbarVisibilityChange, showSnackbar, t]);

    const saveBrewery = useCallback(async (): Promise<boolean> => {
        onProgressbarVisibilityChange(true);

        const {name} = brewery;
        const newErrors = {
            ...(name ? {} : { name: t('common.required') }),
            ...validateAddress(brewery.officialAddress)
        };

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return false;
        }

        if (brewery.contactAddress){
            const contactErrors = validateAddress(brewery.contactAddress);
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
            const updateDto = new UpdateBreweryDto({
                name: brewery.name!,
                officialAddress: brewery.officialAddress!,
                contactAddress: brewery.contactAddress
            });

            await clientApi.updateBreweryEndpoint(id!, updateDto.toJSON()).then(() => {
                if (brewery.name !== initialBrewery!.name)
                    onConfirmed(true);
            });

            showSnackbar(t('breweries.saveSuccess'), 'success');
            return true;
        } catch (error) {
            console.error('Error saving brewery:', error);
            showSnackbar(t('breweries.saveError'), 'error');
            return false;
        } finally {
            onProgressbarVisibilityChange(false);
        }
    }, [brewery, id, initialBrewery, onConfirmed, onProgressbarVisibilityChange, showSnackbar, t]);

    const deleteBrewery = useCallback(async () => {
        const client = new AuthorizedClient();
        await client.deleteBreweryEndpoint(id!);
        triggerRefresh();
        showSnackbar('Brewery deleted', 'success');
    }, [id, showSnackbar, triggerRefresh]);

    const resetBrewery = useCallback(() => {
        setBrewery(initialBrewery!);
    }, [initialBrewery]);

    return (
        <DetailCardLayout
            id={id}
            shouldCheckPendingChanges={shouldCheckPendingChanges}
            onDelete={onDelete}
            onConfirmed={onConfirmed}
            onHasChangesChange={onHasChangesChange}
            onProgressbarVisibilityChange={onProgressbarVisibilityChange}
            title={t('breweries.detailTitle')}
            noDetailMessage={t('breweries.noDetailToDisplay')}
            entity={brewery}
            initialEntity={initialBrewery}
            onFetchEntity={fetchBrewery}
            onSaveEntity={saveBrewery}
            onDeleteEntity={deleteBrewery}
            onResetEntity={resetBrewery}
            deleteConfirmMessage={t('breweries.deleteConfirm', {name: brewery.name})}
            resetConfirmMessage={t('common.resetConfirm')}
            pendingChangesConfirmMessage={t('common.pendingChangesConfirm')}
        >
            {/* Brewery name */}
            <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                <InputLabel htmlFor="name">{t('breweries.name')}</InputLabel>
                <OutlinedInput
                    id="name"
                    value={brewery.name ?? ''}
                    onChange={event => setBrewery(prev => new BreweryDto({
                        ...prev,
                        name: event.target.value
                    }))}
                    label={t('breweries.name')}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                    <AddressForm
                        title={t('address.officialAddress')}
                        address={brewery.officialAddress ?? new AddressDto()}
                        errors={errors}
                        onChange={(newAddress) => setBrewery(prev => new BreweryDto({
                            ...prev,
                            officialAddress: newAddress
                        }))}
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <AddressForm
                        title={t('address.contactAddress')}
                        address={brewery.contactAddress ?? new AddressDto()}
                        errors={contactAddressErrors}
                        onChange={(newAddress) => setBrewery(prev => new BreweryDto({
                            ...prev,
                            contactAddress: newAddress
                        }))}
                    />
                </Box>
            </Box>

            {id && <ProductsView breweryId={id}/>}
        </DetailCardLayout>
    );
}