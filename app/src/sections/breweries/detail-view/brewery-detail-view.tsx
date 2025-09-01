import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import {InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {validateAddress} from "../../../utils/validate-address";
import {AddressForm} from "../../../components/forms/address-form";
import {ColorPicker} from "../../../components/color/color-picker";
import {DrawerLayout} from '../../../layouts/components/drawer-layout';
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {Country, AddressDto, BreweryDto, CreateBreweryDto} from "../../../api/Client";

type BreweryDetailViewProps = {
    onClose: () => void
};

export function BreweryDetailView({ onClose }: Readonly<BreweryDetailViewProps>) {
    const {showSnackbar} = useSnackbar();
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
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactAddressErrors, setContactAddressErrors] = useState<Record<string, string>>({});

    const saveBrewery = async (): Promise<void> => {
        const {name} = brewery;
        const newErrors = {
            ...(name ? {} : { name: t('common.required') }),
            ...validateAddress(brewery.officialAddress)
        };

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return;
        }

        if (brewery.contactAddress){
            const contactErrors = validateAddress(brewery.contactAddress);
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

            const createDto = new CreateBreweryDto({
                name: brewery.name!,
                color: brewery.color!,
                officialAddress: brewery.officialAddress!,
                contactAddress: brewery.contactAddress
            });
            await clientApi.createBreweryEndpoint(createDto.toJSON());
            triggerRefresh();

            showSnackbar(t('breweries.saveSuccess'), 'success');
            onClose();
        } catch (error) {
            console.error('Error saving brewery:', error);
            showSnackbar(t('breweries.saveError'), 'error');
            return;
        }
    }

    return (
        <DrawerLayout
            title={t('breweries.detailTitle')}
            isLoading={false}
            onClose={onClose}
            onSaveAndClose={saveBrewery}
        >

            <Box display="flex" alignItems="center" gap={2} sx={{mt: 2}}>

                {/* brewery name */}
                <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                    <InputLabel htmlFor="Jméno">{t('breweries.name')}</InputLabel>
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

            {/* Official address section */}
            <AddressForm
                title={t('address.officialAddress')}
                address={brewery.officialAddress ?? new AddressDto()}
                errors={errors}
                onChange={(newAddress) => setBrewery(prev => new BreweryDto({
                    ...prev,
                    officialAddress: newAddress
                }))}
            />

            {/* Contact address section */}
            <AddressForm
                title={t('address.contactAddress')}
                address={brewery.contactAddress ?? new AddressDto()}
                errors={contactAddressErrors}
                onChange={(newAddress) => setBrewery(prev => new BreweryDto({
                    ...prev,
                    contactAddress: newAddress
                }))}
            />

        </DrawerLayout>
    );
}