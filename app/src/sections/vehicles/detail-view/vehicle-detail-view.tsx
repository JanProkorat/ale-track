import {useTranslation} from "react-i18next";
import {useState, useEffect, useCallback} from "react";

import {InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

import {useApiCall} from "../../../hooks/use-api-call";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DrawerLayout} from '../../../layouts/components/drawer-layout';
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {
    VehicleDto, CreateVehicleDto, UpdateVehicleDto,
} from "../../../api/Client";

type VehicleDetailViewProps = {
    id: string | null,
    onClose: () => void,
    onSave: () => void
};

export function VehicleDetailView(
    {
        id,
        onClose,
        onSave,
    }: Readonly<VehicleDetailViewProps>) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();
    const {triggerRefresh} = useEntityStatsRefresh();
    const {executeApiCall} = useApiCall();

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [vehicle, setVehicle] = useState<VehicleDto>(new VehicleDto({
        name: '',
        maxWeight: 0,
    }));
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchVehicle = useCallback(async () => {
        setIsLoading(true);
        const clientApi = new AuthorizedClient();
        const data = await executeApiCall(() => clientApi.getVehicleDetailEndpoint(id!));
        if (data) {
            setVehicle(data);
        }
        setIsLoading(false);
    }, [executeApiCall, id]);

    useEffect(() => {
        if (id !== null)
            void fetchVehicle()
    }, [fetchVehicle, id]);

    const saveVehicle = async (): Promise<void> => {
        const {name, maxWeight} = vehicle;

        const newErrors: Record<string, string> = {};
        if (!name) newErrors.name = t('common.required');
        if (!maxWeight) newErrors.maxWeight = t('common.required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return;
        }

        setErrors({});

        const clientApi = new AuthorizedClient();
        let result;

        if (id === null) {
            const createDto = new CreateVehicleDto({
                name: vehicle.name!,
                maxWeight: vehicle.maxWeight!
            });

            result = await executeApiCall(() => clientApi.createVehicleEndpoint(createDto.toJSON()));
            if (result) {
                triggerRefresh();
            }
        } else {
            const updateDto = new UpdateVehicleDto({
                name: vehicle.name!,
                maxWeight: vehicle.maxWeight!
            });

            result = await executeApiCall(() => clientApi.updateVehicleEndpoint(id, updateDto.toJSON()));
        }

        if (result) {
            showSnackbar(t('vehicles.saveSuccess'), 'success');
            onSave();
        }
    }

    return (
        <DrawerLayout
            title={t('vehicles.detailTitle')}
            isLoading={isLoading}
            onClose={onClose}
            onSaveAndClose={saveVehicle}
        >

            {/* vehicle name */}
            <FormControl fullWidth error={!!errors.name} sx={{mt: 1}}>
                <InputLabel htmlFor="vehicle-name">{t('vehicles.name')}</InputLabel>
                <OutlinedInput
                    id="vehicle-name"
                    value={vehicle.name || ''}
                    onChange={event => setVehicle(prev => new VehicleDto({
                        ...prev,
                        name: event.target.value
                    }))}
                    label={t('vehicles.name')}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>

            {/* vehicle weight */}
            <FormControl fullWidth error={!!errors.maxWeight}>
                <InputLabel htmlFor="vehicle-weight">{t('vehicles.maxWeight')}</InputLabel>
                <OutlinedInput
                    type="number"
                    id="vehicle-weight"
                    value={vehicle.maxWeight || ''}
                    onChange={event => setVehicle(prev => new VehicleDto({
                        ...prev,
                        maxWeight: event.target.value === '' ? 0 : parseFloat(event.target.value)
                    }))}
                    label={t('vehicles.maxWeight')}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>



        </DrawerLayout>
    );
}