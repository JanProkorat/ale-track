import {useTranslation} from "react-i18next";
import {useState, useEffect, useCallback} from "react";

import {Typography} from "@mui/material";

import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {UpdateProductDeliveryView} from "./update-product-delivery-view";
import {DetailCardLayout} from "../../../layouts/dashboard/detail-card-layout";
import {
    type DriverDto,
    type BreweryDto,
    type VehicleDto,
    ProductDeliveryState,
    UpdateProductDeliveryDto,
    UpdateProductDeliveryStopDto,
    UpdateProductDeliveryItemDto
} from "../../../api/Client";

type ProductDeliveryDetailVProps = {
    id: string | undefined;
    shouldCheckPendingChanges: boolean;
    onDelete: () => void;
    onConfirmed: (shouldLoadNewDetail: boolean) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onProgressbarVisibilityChange: (isVisible: boolean) => void;
};

export function ProductDeliveryDetailView(
    {
        id,
        shouldCheckPendingChanges,
        onDelete,
        onConfirmed,
        onHasChangesChange,
        onProgressbarVisibilityChange,
    }: Readonly<ProductDeliveryDetailVProps>
) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();

    const [initialDelivery, setInitialDelivery] = useState<UpdateProductDeliveryDto | null>(null);
    const [delivery, setDelivery] = useState<UpdateProductDeliveryDto | null>(null);

    const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
    const [drivers, setDrivers] = useState<DriverDto[]>([]);
    const [breweries, setBreweries] = useState<BreweryDto[]>([]);
    const [productDeliveryStates, setProductDeliveryStates] = useState<ProductDeliveryState[]>([]);

    const [shouldValidate, setShouldValidate] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);

    useEffect(() => {
        void fetchMultiselectData();
    }, [])

    useEffect(() => {
        if (initialDelivery){
            const numericState = ProductDeliveryState[initialDelivery.state! as unknown as keyof typeof ProductDeliveryState];
            if (numericState === ProductDeliveryState.Finished)
                setDisabled(true);
            else if (disabled)
                setDisabled(false);
        }
    }, [initialDelivery?.state])

    const fetchMultiselectData = async () => {
        try {
            const client = new AuthorizedClient();
            await client.fetchBreweries({}).then(setBreweries);
            await client.fetchDrivers({}).then(setDrivers);
            await client.fetchVehicles({}).then(setVehicles);
            await client.getProductDeliveryStateListEndpoint().then((values) => setProductDeliveryStates(values.map(state => state as unknown as ProductDeliveryState)));
        } catch (error) {
            showSnackbar(t('productDeliveries.errorFetchingData'), 'error');
            console.error('Error fetching data for multiselects:', error);
        }
    };

    const fetchDelivery = useCallback(async () => {
        if (id == null) {
            return;
        }

        try {
            onProgressbarVisibilityChange(true);
            const clientApi = new AuthorizedClient();

            const data = await clientApi.getProductDeliveryDetailEndpoint(id);
            if (data) {
                const updateRequest = new UpdateProductDeliveryDto({
                    deliveryDate: data.deliveryDate!,
                    note: data.note,
                    state: data.state,
                    driverIds: data.drivers!.map(driver => driver.id!),
                    vehicleId: data.vehicle!.id,
                    stops: (data.stops ?? []).map((stop) => new UpdateProductDeliveryStopDto({
                        publicId: stop.id,
                        breweryId: stop.brewery!.id,
                        note: stop.note,
                        products: (stop.products ?? []).map((product) => new UpdateProductDeliveryItemDto({productId: product.productId, quantity: product.quantity, note: product.note}))
                    }))
                })
                setDelivery(updateRequest);
                setInitialDelivery(updateRequest);
            }
        } catch (error) {
            console.error('Error fetching delivery:', error);
            showSnackbar(t('productDeliveries.loadDetailError'), 'error');
        } finally {
            onProgressbarVisibilityChange(false);
        }
    }, [id, onProgressbarVisibilityChange, showSnackbar, t]);

    const saveDelivery = useCallback(async () => {
        setShouldValidate(true);
        return await updateDelivery(id!, delivery!);
    }, [delivery, id]);

    const updateDelivery = async (deliveryId: string, productDelivery: UpdateProductDeliveryDto) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const deliveryDate = new Date(productDelivery.deliveryDate);
            deliveryDate.setHours(0, 0, 0, 0);
            if (
                !productDelivery.deliveryDate ||
                deliveryDate < today ||
                !productDelivery.vehicleId ||
                !productDelivery.driverIds?.length ||
                !productDelivery.stops?.length ||
                productDelivery.stops.some(stop =>
                    !stop.breweryId ||
                    !stop.products?.length ||
                    stop.products.some(p => !p.quantity || p.quantity <= 0)
                )
            ) {
                setShouldValidate(true);
                showSnackbar(t('common.validationError'), 'error');
                return false;
            }
            setShouldValidate(false);

            const client = new AuthorizedClient();
            return await client.updateProductDeliveryEndpoint(deliveryId, productDelivery).then(() => {
                showSnackbar(t('productDeliveries.saveSuccess'), 'success');
                if (productDelivery?.state != initialDelivery?.state || productDelivery?.deliveryDate != initialDelivery?.deliveryDate) {
                    onConfirmed(true);
                }
                setInitialDelivery(productDelivery);
                return true;
            });

        } catch (error) {
            showSnackbar(t('productDeliveries.saveError'), 'error');
            console.error('Error saving product delivery:', error);
            return false;
        }
    }

    const deleteDelivery = useCallback(async () => {
        const client = new AuthorizedClient();
        await client.deleteProductDeliveryEndpoint(id!);
        showSnackbar(t('productDeliveries.deliveryDeleted'), 'success');
    }, [id, showSnackbar]);

    const resetDelivery = useCallback(() => {
        setDelivery(initialDelivery);
    }, [initialDelivery]);

    return (
        <>
            {id === undefined && <Typography sx={{mt: 2, ml: 2}}>
                {t('productDeliveries.noDetailToDisplay')}
            </Typography>
            }
            {id !== undefined && <DetailCardLayout
                id={id}
                shouldCheckPendingChanges={shouldCheckPendingChanges}
                onDelete={onDelete}
                onConfirmed={onConfirmed}
                onHasChangesChange={onHasChangesChange}
                onProgressbarVisibilityChange={onProgressbarVisibilityChange}
                title={t('productDeliveries.detailTitle')}
                noDetailMessage={t('productDeliveries.noDetailToDisplay')}
                entity={delivery}
                initialEntity={initialDelivery}
                onFetchEntity={fetchDelivery}
                onSaveEntity={saveDelivery}
                onDeleteEntity={deleteDelivery}
                onResetEntity={resetDelivery}
                deleteConfirmMessage={t('productDeliveries.deleteConfirm')}
                resetConfirmMessage={t('common.resetConfirm')}
                pendingChangesConfirmMessage={t('common.pendingChangesConfirm')}
                disabled={disabled}
            >
                {delivery != null && <UpdateProductDeliveryView
                    disabled={disabled}
                    delivery={delivery}
                    drivers={drivers}
                    breweries={breweries}
                    vehicles={vehicles}
                    productDeliveryStates={productDeliveryStates}
                    shouldValidate={shouldValidate}
                    onChange={setDelivery}
                />}
            </DetailCardLayout>}
        </>
    );
}