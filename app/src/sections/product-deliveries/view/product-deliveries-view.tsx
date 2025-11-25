import {useTranslation} from "react-i18next";
import {varAlpha} from "minimal-shared/utils";
import React, {useState, useEffect, useCallback} from "react";

import Card from "@mui/material/Card";
import Drawer from "@mui/material/Drawer";
import {linearProgressClasses} from "@mui/material/LinearProgress";
import {Box,Button, IconButton, Typography, LinearProgress} from "@mui/material";

import { DashboardContent } from "src/layouts/dashboard";

import {Iconify} from "../../../components/iconify";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {SectionHeader} from "../../../components/label/section-header";
import {ProductDeliverySelect} from "../components/product-delivery-select";
import {CreateProductDeliveryView} from "../detail-view/create-product-delivery-view";
import {ProductDeliveryDetailView} from "../detail-view/product-delivery-detail-view";
import {ResetConfirmationDialog} from "../../../components/dialogs/reset-confirmation-dialog";
import {DeleteConfirmationDialog} from "../../../components/dialogs/delete-confirmation-dialog";
import {PendingChangesConfirmationDialog} from "../../../components/dialogs/pending-changes-confirmation-dialog";
import {
    UpdateProductDeliveryDto, UpdateProductDeliveryStopDto,
    UpdateProductDeliveryItemDto
} from "../../../api/Client";

import type { ProductDeliveryListItemDto} from "../../../api/Client";

export function ProductDeliveriesView() {
    const {t} = useTranslation();
    const { showSnackbar } = useSnackbar();

    const [initialLoading, setInitialLoading] = useState<boolean>(false);
    const [deliveries, setDeliveries] = useState<ProductDeliveryListItemDto[]>([]);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | undefined>(undefined);
    const [pendingDeliveryId, setPendingDeliveryId] = useState<string | null>(null);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
    const [isPendingChangesDialogOpen, setIsPendingChangesDialogOpen] = useState<boolean>(false);
    const [isResetDialogVisible, setIsResetDialogVisible] = useState<boolean>(false);
    const [createDeliveryDrawerVisible, setCreateDeliveryDrawerVisible] = useState<boolean>(false);
    
    const [currentDelivery, setCurrentDelivery] = useState<UpdateProductDeliveryDto | undefined>(undefined);
    const [currentInitialDelivery, setCurrentInitialDelivery] = useState<UpdateProductDeliveryDto | undefined>(undefined);

    const hasDetailChanges = JSON.stringify(currentDelivery) !== JSON.stringify(currentInitialDelivery);

    const fetchProductDeliveries = useCallback(async () => {
        try {
            const client = new AuthorizedClient();
            const filters: Record<string, string> = {};

            filters.sort = 'asc:deliveryDate';

            return await client.fetchProductDeliveries(filters);
        } catch (error) {
            showSnackbar(t('productDeliveries.loadListError'), 'error');
            console.error('Error fetching product deliveries:', error);
            return [];
        }
    }, [showSnackbar, t]);

    const fetchDelivery = useCallback(async (deliveryId: string) => {
        try {
            const client = new AuthorizedClient();
            const data = await client.getProductDeliveryDetailEndpoint(deliveryId);

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
                        products: (stop.products ?? []).map((product) => new UpdateProductDeliveryItemDto({
                            productId: product.productId,
                            quantity: product.quantity,
                            note: product.note
                        }))
                    }))
                });

                setCurrentDelivery(updateRequest);
                setCurrentInitialDelivery(updateRequest);
            }
        } catch (error) {
            console.error('Error fetching delivery:', error);
            showSnackbar(t('productDeliveries.loadDetailError'), 'error');
        }
    }, [showSnackbar, t]);

    useEffect(() => {
        setInitialLoading(true);
        const loadInitial = async () => {
            const loaded = await fetchProductDeliveries();
            setDeliveries(loaded);
            const firstId = loaded.length > 0 ? loaded[0].id : undefined;
            setSelectedDeliveryId(firstId);
            if (firstId) {
                await fetchDelivery(firstId);
            }
            setInitialLoading(false);
        };
        void loadInitial();
    }, [fetchProductDeliveries, fetchDelivery]);

    useEffect(() => {
        if (selectedDeliveryId) {
            void fetchDelivery(selectedDeliveryId);
        }
    }, [selectedDeliveryId, fetchDelivery]);

    const handleRowClick = (id: string) => {
        if (selectedDeliveryId === id)
            return;

        if (hasDetailChanges) {
            setPendingDeliveryId(id);
            setIsPendingChangesDialogOpen(true);
        } else {
            setSelectedDeliveryId(id);
        }
    };

    const handleDeliveryChange = useCallback((delivery: UpdateProductDeliveryDto) => {
        setCurrentDelivery(delivery);
    }, []);

    const handleReset = useCallback(() => {
        setCurrentDelivery(currentInitialDelivery);
        setIsResetDialogVisible(false);
    }, [currentInitialDelivery]);

    const saveCurrentDelivery = async (): Promise<boolean> => {
        if (!selectedDeliveryId || !currentDelivery) {
            return false;
        }

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const deliveryDate = new Date(currentDelivery.deliveryDate);
            deliveryDate.setHours(0, 0, 0, 0);
            
            if (
                !currentDelivery.deliveryDate ||
                deliveryDate < today ||
                !currentDelivery.vehicleId ||
                !currentDelivery.driverIds?.length ||
                !currentDelivery.stops?.length ||
                currentDelivery.stops.some(stop =>
                    !stop.breweryId ||
                    !stop.products?.length ||
                    stop.products.some(p => !p.quantity || p.quantity <= 0)
                )
            ) {
                showSnackbar(t('common.validationError'), 'error');
                return false;
            }

            const client = new AuthorizedClient();
            await client.updateProductDeliveryEndpoint(selectedDeliveryId, currentDelivery);
            
            showSnackbar(t('productDeliveries.saveSuccess'), 'success');
            
            // If the state or date has changed, reload the list
            if (currentDelivery?.state !== currentInitialDelivery?.state || 
                currentDelivery?.deliveryDate !== currentInitialDelivery?.deliveryDate) {
                const updated = await fetchProductDeliveries();
                setDeliveries(updated);
            }
            
            setCurrentInitialDelivery(currentDelivery);
            return true;
        } catch (error) {
            showSnackbar(t('productDeliveries.saveError'), 'error');
            console.error('Error saving product delivery:', error);
            return false;
        }
    };

    const handlePendingChangesConfirmation = async (shouldSave: boolean) => {
        setIsPendingChangesDialogOpen(false);

        if (pendingDeliveryId !== null) {
            if (shouldSave) {
                // Save the current delivery and wait for completion
                const saved = await saveCurrentDelivery();
                if (!saved) {
                    // If saving failed, cancel the switch
                    setPendingDeliveryId(null);
                    return;
                }
            }
            
            // After saving (or when discarding changes) set the new delivery
            if (pendingDeliveryId === 'new') {
                setCreateDeliveryDrawerVisible(true);
            } else {
                setSelectedDeliveryId(pendingDeliveryId);
            }
            
            setPendingDeliveryId(null);
        }
    };

    const handleDeliveryCreated = async (newDeliveryId: string) => {
        await fetchProductDeliveries().then(setDeliveries);
        setSelectedDeliveryId(newDeliveryId);
        setCreateDeliveryDrawerVisible(false);
    }

    const handleNewDeliveryClick = () => {
        if (hasDetailChanges) {
            setPendingDeliveryId('new');
            setIsPendingChangesDialogOpen(true);
        } else {
            setCreateDeliveryDrawerVisible(true);
        }
    }

    const closeDrawer = () => {
        fetchProductDeliveries().then(setDeliveries);
        setCreateDeliveryDrawerVisible(false);
    }

    const deleteDelivery = async () => {
        try{
            const client = new AuthorizedClient();
            await client.deleteProductDeliveryEndpoint(selectedDeliveryId!).then(() => {
                showSnackbar(t('productDeliveries.deliveryDeleted'), 'success');
                const filtered = deliveries.filter(d => d.id !== selectedDeliveryId);
                setDeliveries(filtered);
                setSelectedDeliveryId(filtered.length > 0 ? filtered[0].id : undefined);
            });
        } catch (error) {
            showSnackbar(t('productDeliveries.deleteError'), 'error');
            console.error('Error deleting product delivery:', error);
        } finally {
            setIsDeleteDialogVisible(false);
        }
    }

    return (
        <DashboardContent>
            <Box sx={{mb: 5, display: 'flex', alignItems: 'center'}}>
                <Typography variant="h4" sx={{flexGrow: 1}}>
                    {t('productDeliveries.title')}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line"/>}
                    onClick={handleNewDeliveryClick}
                >
                    {t('productDeliveries.new')}
                </Button>
            </Box>
            <Box sx={{display: 'flex'}}>
                <Box sx={{flexGrow: 1}}>
                    <Box sx={{position: 'relative', alignItems: "center"}}>
                        {initialLoading ? (
                            <LinearProgress
                                sx={{
                                    zIndex: 1,
                                    position: 'absolute',
                                    top: 190,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '40%',
                                    bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                    [`& .${linearProgressClasses.bar}`]: {bgcolor: 'text.primary'},
                                }}
                            />
                        ) :
                            <Card sx={{p: 3}}>
                                <Box sx={{display: 'flex', alignItems: 'center'}}>
                                    <Box sx={{width:'30%'}}>
                                        <ProductDeliverySelect deliveries={deliveries} selectedDeliveryId={selectedDeliveryId} onSelect={handleRowClick} />
                                    </Box>
                                    <SectionHeader text={t('productDeliveries.detailTitle')} headerVariant="h5" sx={{m: 2, ml:3, width: '100%'}}>
                                        <Box sx={{alignItems: 'right'}}>
                                            <IconButton
                                                onClick={() => setIsResetDialogVisible(true)}
                                                color="primary"
                                                disabled={!hasDetailChanges}
                                            >
                                                <Iconify icon="solar:restart-bold"/>
                                            </IconButton>
                                            <IconButton
                                                onClick={() => void saveCurrentDelivery()}
                                                color="primary"
                                                disabled={!hasDetailChanges}
                                            >
                                                <Iconify icon="solar:floppy-disk-bold"/>
                                            </IconButton>
                                            <IconButton
                                                onClick={() => setIsDeleteDialogVisible(true)}
                                                color="error"
                                                disabled={false}
                                            >
                                                <Iconify icon="solar:trash-bin-trash-bold"/>
                                            </IconButton>
                                        </Box>
                                    </SectionHeader>
                                </Box>
                                <ProductDeliveryDetailView
                                    delivery={currentDelivery}
                                    onDeliveryChange={handleDeliveryChange}
                                />
                            </Card>}
                    </Box>
                </Box>
            </Box>
            <Drawer
                anchor="right"
                open={createDeliveryDrawerVisible}
                onClose={closeDrawer}
            >
                <Box sx={{width: 1200, p: 2}}>
                    <CreateProductDeliveryView
                        width={1200}
                        onClose={closeDrawer}
                        onSave={handleDeliveryCreated}
                    />
                </Box>
            </Drawer>
            {/* Delete confirmation dialog */}
            <DeleteConfirmationDialog
                open={isDeleteDialogVisible}
                onClose={() => setIsDeleteDialogVisible(false)}
                onDelete={deleteDelivery}
                deleteConfirmMessage={t('productDeliveries.deleteConfirm')}
                cancelLabel={t('common.cancel')}
                deleteLabel={t('common.delete')}
            />

            {/* Reset confirmation dialog */}
            <ResetConfirmationDialog
                open={isResetDialogVisible}
                onClose={() => setIsResetDialogVisible(false)}
                onReset={handleReset}
                cancelLabel={t('common.cancel')}
                resetLabel={t('common.reset')}
            />

            {/* Pending changes confirmation dialog */}
            <PendingChangesConfirmationDialog
                open={isPendingChangesDialogOpen}
                onClose={() => setIsPendingChangesDialogOpen(false)}
                onSave={() => handlePendingChangesConfirmation(true)}
                onDiscard={() => handlePendingChangesConfirmation(false)}
                cancelLabel={t('common.cancel')}
                discardLabel={t('common.discard')}
                saveLabel={t('common.save')}
            />
        </DashboardContent>
    );
}

