import {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';

import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {Box, Collapse, InputLabel, Typography, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import {Country, AddressDto} from "src/api/Client";

type AddressFormProps = {
    title: string;
    address: AddressDto | undefined;
    errors: Record<string, string>;
    onChange: (newAddress: AddressDto) => void;
};

export function AddressForm({ title, address, errors, onChange }: Readonly<AddressFormProps>) {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(true);

    const [safeAddress, setSafeAddress] = useState<AddressDto>(new AddressDto({
        streetName: "",
        city: "",
        zip: "",
        streetNumber: "",
        country: Country.Germany
    }));

    useEffect(() => {
        console.log(address)
        if (address !== undefined)
            setSafeAddress(address);
    }, [address])

    return (
        <>
            <Box
                onClick={() => setIsExpanded(prev => !prev)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {title}
                </Typography>
                {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </Box>
            <Collapse in={isExpanded} sx={{mb: 0.5}}>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 3}}>
                    <Box sx={{display: 'flex', gap: 2}}>
                        <FormControl fullWidth error={!!errors.streetName}>
                            <InputLabel htmlFor="street">{t('address.street')}</InputLabel>
                            <OutlinedInput
                                id="street"
                                value={safeAddress?.streetName ?? ''}
                                onChange={(e) => onChange(new AddressDto({
                                    ...safeAddress,
                                    streetName: e.target.value
                                }))}
                                label={t('address.street')}
                            />
                            {errors.streetName && <FormHelperText>{errors.streetName}</FormHelperText>}
                        </FormControl>
                        <FormControl fullWidth error={!!errors.streetNumber}>
                            <InputLabel htmlFor="streetNumber">{t('address.number')}</InputLabel>
                            <OutlinedInput
                                id="streetNumber"
                                value={safeAddress.streetNumber ?? ''}
                                onChange={(e) => onChange(new AddressDto({
                                    ...safeAddress,
                                    streetNumber: e.target.value
                                }))}
                                label={t('address.number')}
                            />
                            {errors.streetNumber && <FormHelperText>{errors.streetNumber}</FormHelperText>}
                        </FormControl>
                    </Box>
                    <Box sx={{display: 'flex', gap: 2}}>
                        <FormControl fullWidth error={!!errors.city}>
                            <InputLabel htmlFor="city">{t('address.city')}</InputLabel>
                            <OutlinedInput
                                id="city"
                                value={safeAddress.city ?? ''}
                                onChange={(e) => onChange(new AddressDto({
                                    ...safeAddress,
                                    city: e.target.value
                                }))}
                                label={t('address.city')}
                            />
                            {errors.city && <FormHelperText>{errors.city}</FormHelperText>}
                        </FormControl>
                        <FormControl fullWidth error={!!errors.zip}>
                            <InputLabel htmlFor="zip">{t('address.zip')}</InputLabel>
                            <OutlinedInput
                                id="zip"
                                value={safeAddress.zip ?? ''}
                                onChange={(e) => onChange(new AddressDto({
                                    ...safeAddress,
                                    zip: e.target.value
                                }))}
                                label={t('address.zip')}
                            />
                            {errors.zip && <FormHelperText>{errors.zip}</FormHelperText>}
                        </FormControl>
                    </Box>
                    <FormControl fullWidth error={!!errors.country}>
                        <Autocomplete
                            id="countries"
                            options={Object.values(Country).filter(key => isNaN(Number(key)))}
                            autoHighlight
                            value={Country[safeAddress.country]}
                            onChange={(_, value) => onChange(new AddressDto({
                                ...safeAddress,
                                country: Country[value as keyof typeof Country]
                            }))}
                            getOptionLabel={(option) => {
                                const labelKey = typeof option === 'number' ? Country[option] : option;
                                return t('country.' + labelKey);
                            }}
                            renderOption={(props, option) => {
                                const { key, ...optionProps } = props;
                                return (
                                    <Box
                                        key={key}
                                        component="li"
                                        sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
                                        {...optionProps}
                                    >
                                        {t('country.' + option)}
                                    </Box>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('address.country')}
                                    slotProps={{
                                        htmlInput: {
                                            ...params.inputProps,
                                            autoComplete: 'new-password',
                                        },
                                    }}
                                />
                            )}
                        />
                        {errors.country && <FormHelperText>{errors.country}</FormHelperText>}
                    </FormControl>
                </Box>
            </Collapse>
        </>
    );
}
