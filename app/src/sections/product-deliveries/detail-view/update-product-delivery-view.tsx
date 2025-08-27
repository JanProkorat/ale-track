import {uuidv4} from "minimal-shared";
import React, {useEffect} from "react";
import {useTranslation} from "react-i18next";
import {arrayMove, SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {useSensor, DndContext, useSensors, closestCenter, PointerSensor} from "@dnd-kit/core";

import Box from "@mui/material/Box";
import {Typography} from "@mui/material";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import {Iconify} from "../../../components/iconify";
import {SortableView} from "../components/sortable-view";
import {DriversSelect} from "../components/drivers-select";
import {VehicleSelect} from "../components/vehicle-select";
import {DeliveryDatePicker} from "../components/delivery-date-picker";
import {DeliveryStateSelect} from "../components/delivery-state-select";
import {UpdateProductDeliveryStopView} from "./update-product-delivery-stop-view";
import { ProductDeliveryState, UpdateProductDeliveryDto, UpdateProductDeliveryStopDto} from "../../../api/Client";

import type {DriverDto, BreweryDto, VehicleDto} from "../../../api/Client";

type UpdateProductDeliveryViewProps = {
    delivery: UpdateProductDeliveryDto,
    vehicles: VehicleDto[],
    drivers: DriverDto[],
    breweries: BreweryDto[],
    productDeliveryStates: ProductDeliveryState[],
    shouldValidate: boolean,
    disabled: boolean,
    onChange: (updated: UpdateProductDeliveryDto) => void;
}

export function UpdateProductDeliveryView(
    {
        vehicles,
        drivers,
        breweries,
        productDeliveryStates,
        delivery,
        shouldValidate,
        disabled,
        onChange
    }: Readonly<UpdateProductDeliveryViewProps>) {
    const {t} = useTranslation();

    const [isWarningVisible, setIsWarningVisible] = React.useState<boolean>(false);

    useEffect(() => {
            const numericState = ProductDeliveryState[delivery.state! as unknown as keyof typeof ProductDeliveryState];
            if (numericState === ProductDeliveryState.Finished)
                setIsWarningVisible(true);
            else if (isWarningVisible)
                setIsWarningVisible(false);
    }, [delivery.state])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDeliveryDateSelect = (date: Date | null) => {
        onChange(new UpdateProductDeliveryDto({
            ...delivery,
            deliveryDate: date!
        }));
    };

    const handleDriversSelect = (driverIds: string[]) => {
        onChange(new UpdateProductDeliveryDto({
            ...delivery,
            driverIds
        }));
    };

    const handleVehicleSelect = (vehicleId: string | null) => {
        onChange(new UpdateProductDeliveryDto({
            ...delivery,
            vehicleId: vehicleId ?? undefined
        }));
    };

    const handleStateSelect = (state: ProductDeliveryState | null) => {
        onChange(new UpdateProductDeliveryDto({
            ...delivery,
            state: state ?? undefined
        }));
    };

    const handleAddStop = () => {
        const newStop = new UpdateProductDeliveryStopDto({publicId: "new-stop-" + uuidv4(), products: []});
        onChange(new UpdateProductDeliveryDto({
            ...delivery,
            stops: [...delivery.stops ?? [], newStop],
        }));
    }

    const handleUpdateNote = (note: string) => {
        onChange(new UpdateProductDeliveryDto({
            ...delivery,
            note
        }));
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                pl: 2,
                pr: 2
            }}
        >
            <Box sx={{
                flexGrow: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
            }}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <DeliveryDatePicker
                        selectedDeliveryDate={delivery.deliveryDate}
                        onDatePicked={handleDeliveryDateSelect}
                        disabled={disabled}
                    />
                    <Box sx={{ position: 'relative', display: 'inline-flex', width: '100%' }}>
                        <DeliveryStateSelect
                            selectedState={delivery.state}
                            states={productDeliveryStates}
                            shouldValidate={shouldValidate}
                            onSelect={handleStateSelect}
                            disabled={disabled}
                        />
                        {isWarningVisible && !disabled && (
                            <Tooltip title={t('productDeliveries.stateFinishedWarning')} arrow>
                                <Box sx={{
                                    position: 'absolute',
                                    right: 45,
                                    top: 25,
                                    zIndex: 10,
                                    pointerEvents: 'auto',
                                }}>
                                    <WarningAmberIcon color="warning" fontSize="medium" />
                                </Box>
                            </Tooltip>
                        )}
                    </Box>
                </Box>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <DriversSelect
                        selectedDriverIds={delivery.driverIds}
                        drivers={drivers}
                        shouldValidate={shouldValidate}
                        onSelect={handleDriversSelect}
                        disabled={disabled}
                    />
                    <VehicleSelect
                        selectedVehicleId={delivery.vehicleId}
                        vehicles={vehicles}
                        shouldValidate={shouldValidate}
                        onSelect={handleVehicleSelect}
                        disabled={disabled}
                    />
                </Box>

                <TextField
                    id="note-input"
                    label={t('productDeliveries.note')}
                    multiline
                    rows={3}
                    value={delivery.note}
                    onChange={(event) => handleUpdateNote(event.target.value)}
                    inputProps={{maxLength: 200}}
                    disabled={disabled}
                />

                {/* Nadpis a tlačítko pro zastavku */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #eee'
                }}>
                    <Typography variant="subtitle1" sx={{fontWeight: 'bold'}}>
                        {t('productDeliveries.stopTitle')}
                    </Typography>
                    <Button
                        disabled={disabled}
                        variant="contained"
                        color="inherit"
                        startIcon={<Iconify icon="mingcute:add-line"/>}
                        size="small"
                        sx={{mb: 1}}
                        onClick={handleAddStop}
                    >
                        {t('productDeliveries.newStop')}
                    </Button>
                </Box>

                <Box
                    sx={{
                        flexGrow: 1,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: {xs: '1fr', sm: '1fr'},
                        gap: 2,
                    }}
                >
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={({active, over}) => {
                            if (active.id !== over?.id) {
                                const oldIndex = delivery.stops!.findIndex((s) => s.publicId === active.id);
                                const newIndex = delivery.stops!.findIndex((s) => s.publicId === over?.id);

                                const updatedStops = arrayMove(delivery.stops!, oldIndex, newIndex);
                                onChange(new UpdateProductDeliveryDto({
                                    ...delivery,
                                    stops: updatedStops
                                }));
                            }
                        }}
                    >
                        <SortableContext
                            items={delivery.stops!.map((s) => s.publicId!)}
                            strategy={verticalListSortingStrategy}
                        >
                            {delivery.stops!.map((stop, index) =>
                                <SortableView id={stop.publicId!} key={stop.publicId!}>
                                    <UpdateProductDeliveryStopView
                                        disabled={disabled}
                                        key={stop.publicId!}
                                        number={index + 1}
                                        shouldValidate={shouldValidate}
                                        breweries={breweries}
                                        productDeliveryStop={stop}
                                        onBrewerySelected={(breweryId) => {
                                            const updatedStops = [...delivery.stops!];
                                            updatedStops[index] = new UpdateProductDeliveryStopDto({
                                                ...updatedStops[index],
                                                breweryId,
                                            });
                                            onChange(new UpdateProductDeliveryDto({
                                                ...delivery,
                                                stops: updatedStops,
                                            }));
                                        }}
                                        onNoteChanged={(note) => {
                                            const updatedStops = [...delivery.stops!];
                                            updatedStops[index] = new UpdateProductDeliveryStopDto({
                                                ...updatedStops[index],
                                                note,
                                            });
                                            onChange(new UpdateProductDeliveryDto({
                                                ...delivery,
                                                stops: updatedStops,
                                            }));
                                        }}
                                        onDeleteClicked={() => {
                                            const updatedStops = delivery.stops!.filter((_, i) => i !== index);
                                            onChange(new UpdateProductDeliveryDto({
                                                ...delivery,
                                                stops: updatedStops,
                                            }));
                                        }}
                                        onProductsChanged={(products) => {
                                            const updatedStops = [...delivery.stops!];
                                            updatedStops[index] = new UpdateProductDeliveryStopDto({
                                                ...updatedStops[index],
                                                products,
                                            });
                                            onChange(new UpdateProductDeliveryDto({
                                                ...delivery,
                                                stops: updatedStops,
                                            }));
                                        }}
                                    />
                                </SortableView>
                            )}
                        </SortableContext>
                    </DndContext>
                </Box>
            </Box>
        </Box>
    )
}