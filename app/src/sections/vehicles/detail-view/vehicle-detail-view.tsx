import {useState, useEffect} from "react";
import {useTranslation} from "react-i18next";

import {InputLabel, FormControl, OutlinedInput, FormHelperText} from "@mui/material";

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

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [vehicle, setVehicle] = useState<VehicleDto>(new VehicleDto({
        name: '',
        maxWeight: 0,
    }));
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (id !== null)
            void fetchVehicle()
    }, [id]);

    const fetchVehicle = async () => {
        try {
            setIsLoading(true);
            const clientApi = new AuthorizedClient();

            const data = await clientApi.getVehicleDetailEndpoint(id!);
            if (data) {
                setVehicle(data);
            }
        } catch (error) {
            console.error('Error fetching vehicle:', error);
        } finally {
            setIsLoading(false);
        }
    }

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

        try {
            const clientApi = new AuthorizedClient();

            if (id === null) {
                const createDto = new CreateVehicleDto({
                    name: vehicle.name!,
                    maxWeight: vehicle.maxWeight!
                });

                await clientApi.createVehicleEndpoint(createDto.toJSON());
                triggerRefresh();
            } else {
                const updateDto = new UpdateVehicleDto({
                    name: vehicle.name!,
                    maxWeight: vehicle.maxWeight!
                });

                await clientApi.updateVehicleEndpoint(id, updateDto.toJSON());
            }

            showSnackbar(t('vehicles.saveSuccess'), 'success');
            onSave();
        } catch (error) {
            console.error('Error saving vehicle:', error);
            showSnackbar(t('vehicles.saveError'), 'error');
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
                <InputLabel htmlFor="Jméno">{t('vehicles.name')}</InputLabel>
                <OutlinedInput
                    id="name"
                    value={vehicle.name || ''}
                    onChange={event => setVehicle(prev => new VehicleDto({
                        ...prev,
                        name: event.target.value
                    }))}
                    label={t('vehicles.name')}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>

            {/* vehicle name */}
            <FormControl fullWidth error={!!errors.maxWeight}>
                <InputLabel htmlFor="weight">{t('vehicles.maxWeight')}</InputLabel>
                <OutlinedInput
                    type="number"
                    id="weight"
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