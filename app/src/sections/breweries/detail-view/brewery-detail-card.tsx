import {useTranslation} from "react-i18next";
import React, {useState, useCallback} from "react";

import {Box, InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import { useApiCall } from "src/hooks/use-api-call";

import { CollapsibleForm } from "src/components/forms/collapsible-form";

import {ProductsView} from "../../products/view";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {validateAddress} from "../../../utils/validate-address";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {AddressForm} from "../../../components/forms/address-form";
import {ColorPicker} from "../../../components/color/color-picker";
import {BreweryRemindersView} from "./components/brewery-reminders-view";
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
    const {executeApiCall} = useApiCall();
    const {t} = useTranslation();
    const {triggerRefresh} = useEntityStatsRefresh();

    const [brewery, setBrewery] = useState<BreweryDto>(new BreweryDto({
        name: '',
        color: '',
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
        const clientApi = new AuthorizedClient();

        const data = await executeApiCall(
            () => clientApi.getBreweryDetailEndpoint(id!),
            t('breweries.loadDetailError')
        );

        if (data) {
            setBrewery(data);
            setInitialBrewery(new BreweryDto(data));
        }
        onProgressbarVisibilityChange(false);
    }, [id, onProgressbarVisibilityChange, executeApiCall, t]);

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

        const clientApi = new AuthorizedClient();
        const updateDto = new UpdateBreweryDto({
            name: brewery.name!,
            officialAddress: brewery.officialAddress!,
            contactAddress: brewery.contactAddress,
            color: brewery.color!
        });

        const result = await executeApiCall(
            () => clientApi.updateBreweryEndpoint(id!, updateDto.toJSON()),
            t('breweries.saveError')
        );

        onProgressbarVisibilityChange(false);

        if (result) {
            if (brewery.name !== initialBrewery!.name) {
                onConfirmed(true);
            }
            showSnackbar(t('breweries.saveSuccess'), 'success');
            return true;
        }
        
        return false;
    }, [brewery, id, initialBrewery, onConfirmed, onProgressbarVisibilityChange, showSnackbar, executeApiCall, t]);

    const deleteBrewery = useCallback(async () => {
        const client = new AuthorizedClient();
        
        const result = await executeApiCall(
            () => client.deleteBreweryEndpoint(id!)
        );

        if (result) {
            triggerRefresh();
            showSnackbar('Brewery deleted', 'success');
        }
    }, [id, showSnackbar, executeApiCall, triggerRefresh]);

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
        >
            <Box display="flex" alignItems="center" gap={2} sx={{mt: 2}}>

                {/* Brewery name */}
                <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                    <InputLabel htmlFor="brewery-card-name">{t('breweries.name')}</InputLabel>
                    <OutlinedInput
                        id="brewery-card-name"
                        value={brewery.name ?? ''}
                        onChange={event => setBrewery(prev => new BreweryDto({
                            ...prev,
                            name: event.target.value
                        }))}
                        label={t('breweries.name')}
                    />
                    {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
                </FormControl>

                {/* Brewery color */}
                <Box display="flex" alignItems="center" gap={2} sx={{mt: 1}}>
                    <ColorPicker
                        color={brewery.color ?? ''}
                        errors={errors}
                        onChange={color => setBrewery(prev => new BreweryDto({
                            ...prev,
                            color
                        }))}
                    />
                    <Box
                        sx={{
                            width: 46,
                            height: 46,
                            backgroundColor: brewery.color,
                            borderRadius: 1,
                            border: '1px solid #ccc',
                        }}
                    />
                </Box>
            </Box>

            {/* Brewery address */}
            <CollapsibleForm  title={t('address.address')}>
                <Box sx={{ flex: 1, ml: 2, mr: 2 }}>
                    <AddressForm
                        title={t('address.officialAddress')}
                        headerVariant="subtitle2"
                        address={brewery.officialAddress ?? new AddressDto()}
                        errors={errors}
                        onChange={(newAddress) => setBrewery(prev => new BreweryDto({
                            ...prev,
                            officialAddress: newAddress
                        }))}
                    />
                </Box>
                <Box sx={{ flex: 1, ml: 2, mr: 2 }}>
                    <AddressForm
                        title={t('address.contactAddress')}
                        headerVariant="subtitle2"
                        address={brewery.contactAddress ?? new AddressDto()}
                        errors={contactAddressErrors}
                        onChange={(newAddress) => setBrewery(prev => new BreweryDto({
                            ...prev,
                            contactAddress: newAddress
                        }))}
                    />
                </Box>
            </CollapsibleForm>

            {id && <BreweryRemindersView breweryId={id}/>}
            {id && <ProductsView breweryId={id}/>}
        </DetailCardLayout>
    );
}