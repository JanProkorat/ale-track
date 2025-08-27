import dayjs from "dayjs";
import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";
import {
    arrayMove, SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSensor,
    DndContext,
    useSensors,
    closestCenter,
    PointerSensor,
} from '@dnd-kit/core';

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { Typography} from "@mui/material";
import TextField from "@mui/material/TextField";

import {Iconify} from "../../../components/iconify";
import {SortableView} from "../components/sortable-view";
import {VehicleSelect} from "../components/vehicle-select";
import {DriversSelect} from "../components/drivers-select";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DeliveryDatePicker} from "../components/delivery-date-picker";
import {DrawerLayout} from "../../../layouts/components/drawer-layout";
import {CreateProductDeliveryStopView} from "./create-product-delivery-stop-view";
import {IdentifiedProductDeliveryStopDto} from "../../../api/IdentifiedProductDeliveryStopDto";
import {
    CreateProductsDeliveryDto,
    CreateProductDeliveryStopDto, CreateProductDeliveryItemDto
} from "../../../api/Client";

import type {DriverDto, BreweryDto, VehicleDto} from "../../../api/Client";
import type {IdentifiedProductDeliveryItemDto} from "../../../api/IdentifiedProductDeliveryStopDto";

type CreateProductDeliveryProps = {
    width: number
    onClose: () => void
    onSave: (newDeliveryId: string) => void
}

export function CreateProductDeliveryView({width, onClose, onSave}: Readonly<CreateProductDeliveryProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [delivery, setDelivery] = useState<CreateProductsDeliveryDto>(new CreateProductsDeliveryDto({
        deliveryDate: dayjs().toDate(),
        stops: [new IdentifiedProductDeliveryStopDto({
            products: [] as IdentifiedProductDeliveryItemDto[],
            breweryId: "",
            note: "",
        })],
        driverIds: [],
        note: ""
    }))
    
    const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
    const [drivers, setDrivers] = useState<DriverDto[]>([]);
    const [breweries, setBreweries] = useState<BreweryDto[]>([]);
    const [shouldValidate, setShouldValidate] = useState<boolean>(false);

    useEffect(() => {
        void fetchMultiselectData();
    }, [])
    
    const fetchMultiselectData = async () => {
        try {
            const client = new AuthorizedClient();
            await client.fetchBreweries({}).then(setBreweries);
            await client.fetchDrivers({}).then(setDrivers);
            await client.fetchVehicles({}).then(setVehicles);
        } catch (error) {
            showSnackbar(t('productDeliveries.errorFetchingData'), 'error');
            console.error('Error fetching data for multiselects:', error);
        }
    };
    
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleSave = async () => {
        try {
            if (
                !delivery.deliveryDate ||
                !delivery.vehicleId ||
                !delivery.driverIds?.length ||
                !delivery.stops?.length ||
                delivery.stops.some(stop =>
                    !stop.breweryId ||
                    !stop.products?.length ||
                    stop.products.some(p => !p.quantity || p.quantity <= 0)
                )
            ) {
                setShouldValidate(true);
                showSnackbar(t('common.validationError'), 'error');
                return;
            }
            setShouldValidate(false);

            const cleanedDelivery = new CreateProductsDeliveryDto({
                ...delivery,
                stops: delivery.stops?.map(stop =>
                    new CreateProductDeliveryStopDto({
                        breweryId: stop.breweryId,
                        note: stop.note,
                        products: stop.products?.map(product => CreateProductDeliveryItemDto.fromJS(product))
                    })
                )
            });

            const client = new AuthorizedClient();
            await client.createProductsDeliveryEndpoint(cleanedDelivery).then(onSave)
        } catch (error) {
            showSnackbar(t('productDeliveries.saveError'), 'error');
            console.error('Error creating new product delivery:', error);
        }
    }

    const handleDeliveryDateSelect = (date: Date) => {
        setDelivery(prev => new CreateProductsDeliveryDto({
            ...prev,
            deliveryDate: date
        }))
    }

    const handleDriversSelect = (driverIds: string[]) => {
        setDelivery(prev =>
            new CreateProductsDeliveryDto({
                ...prev,
                driverIds,
            })
        );
    }
    
    const handleVehicleSelect = (vehicleId: string) => {
        setDelivery(prev => new CreateProductsDeliveryDto({
            ...prev,
            vehicleId: prev.vehicleId != vehicleId ? vehicleId : undefined,
        }))
    }

    const handleUpdateNote = (note: string) => {
        setDelivery(prev => new CreateProductsDeliveryDto({
            ...prev,
            note
        }))
    }
    
    return (
        <DrawerLayout
            title={t('productDeliveries.new')}
            isLoading={false}
            onClose={onClose}
            onSaveAndClose={handleSave}
            width={width}
        >
            <Box sx={{
                // flexGrow: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
            }}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <DeliveryDatePicker selectedDeliveryDate={delivery.deliveryDate} onDatePicked={handleDeliveryDateSelect} />
                    <DriversSelect selectedDriverIds={delivery.driverIds} drivers={drivers} shouldValidate={shouldValidate} onSelect={handleDriversSelect} />
                    <VehicleSelect selectedVehicleId={delivery.vehicleId} vehicles={vehicles} shouldValidate={shouldValidate} onSelect={handleVehicleSelect} />
                </Box>

                <TextField
                    id="note-input"
                    label={t('productDeliveries.note')}
                    multiline
                    rows={3}
                    value={delivery.note}
                    onChange={(event) => handleUpdateNote(event.target.value)}
                    inputProps={{maxLength: 200}}
                />

                {/* Nadpis a tlačítko pro zastavku */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {t('productDeliveries.stopTitle')}
                    </Typography>
                    <Button
                        variant="contained"
                        color="inherit"
                        startIcon={<Iconify icon="mingcute:add-line" />}
                        size="small"
                        sx={{mb:1}}
                        onClick={() => {
                            const newStop = new IdentifiedProductDeliveryStopDto();
                            setDelivery(prev =>
                                new CreateProductsDeliveryDto({
                                    ...prev,
                                    stops: [...prev.stops!, newStop],
                                })
                            );
                        }}
                    >
                        {t('productDeliveries.newStop')}
                    </Button>
                </Box>

                <Box
                    sx={{
                        flexGrow: 1,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr' },
                        gap: 2,
                    }}
                >
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={({ active, over }) => {
                            if (active.id !== over?.id) {
                                const oldIndex = (delivery.stops! as IdentifiedProductDeliveryStopDto[]).findIndex((s) => s.id === active.id);
                                const newIndex = (delivery.stops! as IdentifiedProductDeliveryStopDto[]).findIndex((s) => s.id === over?.id);

                                const updatedStops = arrayMove(delivery.stops!, oldIndex, newIndex);
                                setDelivery((prev) => new CreateProductsDeliveryDto({
                                    ...prev,
                                    stops: updatedStops
                                }));
                            }
                        }}
                    >
                        <SortableContext
                            items={(delivery.stops! as IdentifiedProductDeliveryStopDto[]).map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {(delivery.stops! as IdentifiedProductDeliveryStopDto[]).map((stop, index) =>
                                <SortableView id={stop.id} key={stop.id}>
                                    <CreateProductDeliveryStopView
                                        key={stop.id}
                                        number={index + 1}
                                        shouldValidate={shouldValidate}
                                        breweries={breweries}
                                        productDeliveryStop={stop}
                                        onBrewerySelected={(breweryId) =>
                                            setDelivery(prev => {
                                                const updatedStops = [...prev.stops!];
                                                updatedStops[index] = new CreateProductDeliveryStopDto({
                                                    ...updatedStops[index],
                                                    breweryId
                                                });
                                                return new CreateProductsDeliveryDto({
                                                    ...prev,
                                                    stops: updatedStops
                                                });
                                            })
                                        }
                                        onNoteChanged={(note) => {
                                            setDelivery(prev => {
                                                const updatedStops = [...prev.stops!];
                                                updatedStops[index] = new CreateProductDeliveryStopDto({
                                                    ...updatedStops[index],
                                                    note
                                                });
                                                return new CreateProductsDeliveryDto({
                                                    ...prev,
                                                    stops: updatedStops
                                                });
                                            });
                                        }}
                                        onDeleteClicked={() => {
                                            setDelivery(prev => {
                                                const updatedStops = prev.stops!.filter((_, i) => i !== index);
                                                return new CreateProductsDeliveryDto({
                                                    ...prev,
                                                    stops: updatedStops
                                                });
                                            });
                                        }}
                                        onProductsChanged={(products) => {
                                            setDelivery(prev => {
                                                const updatedStops = [...prev.stops!];
                                                updatedStops[index] = new CreateProductDeliveryStopDto({
                                                    ...updatedStops[index],
                                                    products
                                                });
                                                return new CreateProductsDeliveryDto({
                                                    ...prev,
                                                    stops: updatedStops
                                                });
                                            });
                                        }}
                                    />
                                </SortableView>
                            )}
                        </SortableContext>
                    </DndContext>
                </Box>
            </Box>
        </DrawerLayout>
    );
}