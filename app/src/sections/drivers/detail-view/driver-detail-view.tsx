import {useTranslation} from "react-i18next";
import React, {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import {InputLabel, FormControl, OutlinedInput, FormHelperText} from '@mui/material';

import {useAuthorizedClient} from "src/api/use-authorized-client";

import {useApiCall} from "../../../hooks/use-api-call";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {ColorPicker} from "../../../components/color/color-picker";
import {DriverAvailabilityEditor} from "./driver-availability-editor";
import {DrawerLayout} from "../../../layouts/components/drawer-layout";
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {DriverDto, CreateDriverDto, UpdateDriverDto} from "../../../api/Client";

interface DriverDetailViewProps {
    id: string | null,
    onClose: () => void | undefined
}

export const DriverDetailView: React.FC<DriverDetailViewProps> = (
    {
        id,
        onClose
    }) => {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();
    const {triggerRefresh} = useEntityStatsRefresh();
    const {executeApiCall} = useApiCall();
    const clientApi = useAuthorizedClient();

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [driver, setDriver] = useState<DriverDto>(new DriverDto({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        availableDates: [],
        color: '#aabbcc'
    }))

    const fetchDriver = useCallback(async () => {
        setIsLoading(true);
        const data = await executeApiCall(() => clientApi.getDriverDetailEndpoint(id!));
        if (data) {
            setDriver(data);
        }
        setIsLoading(false);
    }, [executeApiCall, id, clientApi]);

    useEffect(() => {
        if (id !== null && id !== undefined)
            void fetchDriver()
    }, [fetchDriver, id]);

    const saveDriver = async () => {
        const {firstName, lastName} = driver;

        const newErrors: Record<string, string> = {};
        if (!firstName) newErrors.firstName = t('common.required');
        if (!lastName) newErrors.lastName = t('common.required');

        const intervals = driver.availableDates!
            .filter(x => x.from && x.until)
            .map(x => ({ from: new Date(x.from!), until: new Date(x.until!) }))
            .sort((a, b) => a.from.getTime() - b.from.getTime());

        for (let i = 0; i < intervals.length - 1; i++) {
            if (intervals[i].until > intervals[i + 1].from) {
                newErrors.availableDates = t('drivers.dateIntervalsOverlap');
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);

            if (newErrors.firstName || newErrors.lastName) {
                showSnackbar(t('common.validationError'), 'error');
            }

            if (newErrors.availableDates) {
                showSnackbar(t('common.overlappingIntervals'), 'error');
            }

            return;
        }

        setErrors({});

        let result;

        if (id === null) {
            const createDto = new CreateDriverDto({
                firstName: driver.firstName!,
                lastName: driver.lastName!,
                phoneNumber: driver.phoneNumber,
                availableDates: driver.availableDates,
                color: driver.color!
            });

            result = await executeApiCall(() => clientApi.createDriverEndpoint(createDto.toJSON()));
            if (result) {
                triggerRefresh();
            }
        } else {
            const updateDto = new UpdateDriverDto({
                firstName: driver.firstName!,
                lastName: driver.lastName!,
                phoneNumber: driver.phoneNumber,
                availableDates: driver.availableDates,
                color: driver.color!
            });
            
            let hasError = false;
            await executeApiCall(
                () => clientApi.updateDriverEndpoint(id, updateDto.toJSON()),
                undefined,
                { onError: () => { hasError = true; } }
            );
            
            if (!hasError) {
                result = true;
            }
        }

        if (result) {
            showSnackbar(t('drivers.saveSuccess'), 'success');
            onClose();
        }
    }

    return (
        <DrawerLayout
            title={t('drivers.detailTitle')}
            isLoading={isLoading}
            onClose={onClose}
            onSaveAndClose={saveDriver}
        >
                <Box sx={{mt: 1}}>
                    {/* Driver name */}
                    <Box sx={{display: 'flex', gap: 2}}>
                        <FormControl fullWidth error={!!errors.firstName}>
                            <InputLabel htmlFor="firstName">{t('drivers.firstName')}</InputLabel>
                            <OutlinedInput
                                id="firstName"
                                value={driver.firstName ?? ''}
                                onChange={event => setDriver(prev => new DriverDto({
                                    ...prev,
                                    firstName: event.target.value
                                }))}
                                label={t('drivers.firstName')}
                            />
                            {errors.firstName && <FormHelperText>{errors.firstName}</FormHelperText>}
                        </FormControl>
                        <FormControl fullWidth error={!!errors.lastName}>
                            <InputLabel htmlFor="lastName">{t('drivers.lastName')}</InputLabel>
                            <OutlinedInput
                                id="lastName"
                                value={driver.lastName ?? ''}
                                onChange={event => setDriver(prev => new DriverDto({
                                    ...prev,
                                    lastName: event.target.value
                                }))}
                                label={t('drivers.lastName')}
                            />
                            {errors.lastName && <FormHelperText>{errors.lastName}</FormHelperText>}
                        </FormControl>
                    </Box>

                    {/* driver's phone */}
                    <FormControl fullWidth error={!!errors.phoneNumber} sx={{mt: 2}}>
                        <InputLabel htmlFor="phone">{t('drivers.phone')}</InputLabel>
                        <OutlinedInput
                            id="phone"
                            value={driver.phoneNumber ?? ''}
                            onChange={event => setDriver(prev => new DriverDto({
                                ...prev,
                                phoneNumber: event.target.value
                            }))}
                            label={t('drivers.phone')}
                        />
                        {errors.phoneNumber && <FormHelperText>{errors.phoneNumber}</FormHelperText>}
                    </FormControl>

                    {/* driver's color */}
                    <Box display="flex" alignItems="center" gap={2} sx={{mt: 2}}>
                        <Box
                            sx={{
                                width: 46,
                                height: 46,
                                backgroundColor: driver.color,
                                borderRadius: 1,
                                border: '1px solid #ccc',
                            }}
                        />
                        <ColorPicker
                            color={driver.color ?? ''}
                            errors={errors}
                            onChange={color => setDriver(prev => new DriverDto({
                                ...prev,
                                color
                            }))}
                        />
                    </Box>

                    <Box>
                        <DriverAvailabilityEditor
                            availableDates={driver.availableDates || []}
                            onChange={(slots) => setDriver(prev => new DriverDto({
                                ...prev,
                                availableDates: slots
                            }))}/>
                    </Box>
                </Box>
        </DrawerLayout>
    );
};