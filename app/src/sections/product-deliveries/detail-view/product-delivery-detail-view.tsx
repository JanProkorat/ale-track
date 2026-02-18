import {useTranslation} from "react-i18next";
import {varAlpha} from "minimal-shared/utils";
import React, {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import {Typography, LinearProgress} from "@mui/material";
import {linearProgressClasses} from "@mui/material/LinearProgress";

import {useAuthorizedClient} from "src/api/use-authorized-client";

import {useApiCall} from "../../../hooks/use-api-call";
import {ProductDeliveryState} from "../../../api/Client";
import {UpdateProductDeliveryView} from "./update-product-delivery-view";

import type {DriverDto, BreweryDto, VehicleDto, UpdateProductDeliveryDto} from "../../../api/Client";

type ProductDeliveryDetailVProps = {
    delivery: UpdateProductDeliveryDto | undefined,
    onDeliveryChange: (delivery: UpdateProductDeliveryDto) => void,
};

export function ProductDeliveryDetailView(
    {
        delivery,
        onDeliveryChange,
    }: Readonly<ProductDeliveryDetailVProps>
) {
    const {t} = useTranslation();
    const {executeApiCall} = useApiCall();
    const client = useAuthorizedClient();

    const [detailLoading, setDetailLoading] = useState<boolean>(false);
    const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
    const [drivers, setDrivers] = useState<DriverDto[]>([]);
    const [breweries, setBreweries] = useState<BreweryDto[]>([]);
    const [productDeliveryStates, setProductDeliveryStates] = useState<ProductDeliveryState[]>([]);
    const [disabled, setDisabled] = useState<boolean>(false);

    const fetchMultiselectData = useCallback(async () => {
        setDetailLoading(true);
        const breweriesResult = await executeApiCall(() => client.fetchBreweries({}));
        if (breweriesResult) setBreweries(breweriesResult);
        
        const driversResult = await executeApiCall(() => client.fetchDrivers({}));
        if (driversResult) setDrivers(driversResult);
        
        const vehiclesResult = await executeApiCall(() => client.fetchVehicles({}));
        if (vehiclesResult) setVehicles(vehiclesResult);
        
        const statesResult = await executeApiCall(() => client.getProductDeliveryStateListEndpoint());
        if (statesResult) setProductDeliveryStates(statesResult.map(state => state as unknown as ProductDeliveryState));
        
        setDetailLoading(false);
    }, [executeApiCall, client]);

    useEffect(() => {
        void fetchMultiselectData();
    }, [fetchMultiselectData])

    useEffect(() => {
        if (delivery) {
            const numericState = ProductDeliveryState[delivery.state! as unknown as keyof typeof ProductDeliveryState];
            setDisabled(numericState === ProductDeliveryState.Finished);
        }
    }, [delivery])

    return (
        <Box sx={{
            minHeight: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
        }}>
            {!detailLoading && delivery === undefined && <Typography sx={{mt: 2, ml: 2}}>
                {t('productDeliveries.noDetailToDisplay')}
            </Typography>}
            {detailLoading && delivery === undefined && (
                <LinearProgress
                    sx={{
                        zIndex: 1,
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '40%',
                        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                        [`& .${linearProgressClasses.bar}`]: {bgcolor: 'text.primary'},
                    }}
                />
            )}
            {delivery !== undefined && <UpdateProductDeliveryView
                disabled={disabled}
                delivery={delivery}
                drivers={drivers}
                breweries={breweries}
                vehicles={vehicles}
                productDeliveryStates={productDeliveryStates}
                shouldValidate={false}
                onChange={onDeliveryChange}
            />}
        </Box>
    );
}