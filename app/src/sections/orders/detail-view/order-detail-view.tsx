import {useTranslation} from "react-i18next";
import {useCallback, useEffect, useState} from "react";

import {Typography} from "@mui/material";

import {CreateOrderView} from "./create-order-view";
import {UpdateOrderView} from "./update-order-view";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DetailCardLayout} from "../../../layouts/dashboard/detail-card-layout";
import {
    OrderState,
    type ProductListItemDto,
    UpdateOrderDto,
    UpdateOrderItemDto
} from "../../../api/Client";

type OrderDetailViewProps = {
    id: string | undefined;
    shouldCheckPendingChanges: boolean;
    onDelete: () => void;
    onConfirmed: (shouldLoadNewDetail: boolean) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onProgressbarVisibilityChange: (isVisible: boolean) => void;
};

export function OrderDetailView(
    {
        id,
        shouldCheckPendingChanges,
        onDelete,
        onConfirmed,
        onHasChangesChange,
        onProgressbarVisibilityChange
    }: Readonly<OrderDetailViewProps>
){
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();

    const [initialOrder, setInitialOrder] = useState<UpdateOrderDto | null>(null);
    const [order, setOrder] = useState<UpdateOrderDto | null>(null);
    const [products, setProducts] = useState<ProductListItemDto[]>([]);

    const [shouldValidate, setShouldValidate] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);

    useEffect(() => {
        void fetchProducts()
    }, []);

    const fetchProducts = async () => {
        try{

            const client = new AuthorizedClient();
            await client.fetchProducts({}).then(setProducts)
        } catch (e) {
            showSnackbar('products.fetchError', 'error');
            console.error('Error fetching products', e);
        }
    }
    
    const fetchOrder = useCallback(async () => {
        if (id == null) {
            return;
        }
        
        try {
            onProgressbarVisibilityChange(true);
            const client = new AuthorizedClient();
            await client.getOrderDetailEndpoint(id!).then((detail) => {
                const updateOrder =  new UpdateOrderDto({
                    clientId: detail.client!.id!,
                    deliveryDate: detail.deliveryDate,
                    state: detail.state,
                    orderItems: (detail.orderItems ?? []).map((item) => new UpdateOrderItemDto({
                        productId: item.productId,
                        quantity: item.quantity
                    }))
                });

                setInitialOrder(updateOrder);
                setOrder(updateOrder);
                setShouldValidate(false);
                const numericState = OrderState[updateOrder.state! as unknown as keyof typeof OrderState];
                if (numericState === OrderState.Cancelled || numericState === OrderState.Finished)
                    setDisabled(true);
                else if (disabled)
                    setDisabled(false);
            });
        } catch (error) {
            showSnackbar(t('orders.fetchDetailError'), 'error');
            console.error('Error fetching order detail:', error);
        } finally {
            onProgressbarVisibilityChange(false);
        }
    }, [id, onProgressbarVisibilityChange, showSnackbar, t]);

    const saveOrder = useCallback(async () => {
        setShouldValidate(true);
        return await updateOrder(id!, order!);
    }, [order, id]);

    const updateOrder = async (orderId: string, orderToUpdate: UpdateOrderDto) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let deliveryDate = null;
            if (orderToUpdate.deliveryDate !== null && order?.deliveryDate !== undefined){
                deliveryDate = new Date(orderToUpdate.deliveryDate!);
                deliveryDate.setHours(0, 0, 0, 0);
            }

            if (
                (deliveryDate != null && deliveryDate < today) ||
                !orderToUpdate.state ||
                !orderToUpdate.clientId ||
                !orderToUpdate.orderItems ||
                orderToUpdate.orderItems.some(item =>
                    !item.productId ||
                    !item.quantity ||
                    item.quantity <= 0)
            ) {
                setShouldValidate(true);
                showSnackbar(t('common.validationError'), 'error');
                return false;
            }
            setShouldValidate(false);

            const client = new AuthorizedClient();
            return await client.updateOrderEndpoint(orderId, orderToUpdate).then(() => {
                showSnackbar(t('orders.saveSuccess'), 'success');
                if (orderToUpdate?.state != initialOrder?.state || orderToUpdate?.clientId != initialOrder?.clientId || orderToUpdate?.deliveryDate != initialOrder?.deliveryDate) {
                    onConfirmed(true);
                }
                setInitialOrder(orderToUpdate);
                return true;
            });

        } catch (error) {
            showSnackbar(t('orders.saveError'), 'error');
            console.error('Error saving order:', error);
            return false;
        }
    }

    const deleteOrder = useCallback(async () => {
        const client = new AuthorizedClient();
        await client.deleteOrderEndpoint(id!);
        showSnackbar(t('orders.deleteSuccess'), 'success');
    }, [id, showSnackbar]);

    const resetOrder = useCallback(() => {
        setOrder(initialOrder);
    }, [initialOrder]);

    return (
        <>
            {id === undefined && <Typography sx={{mt: 2, ml: 2}}>
                {t('orders.noDetailToDisplay')}
            </Typography>
            }
            {id !== undefined && <DetailCardLayout
                id={id}
                shouldCheckPendingChanges={shouldCheckPendingChanges}
                onDelete={onDelete}
                onConfirmed={onConfirmed}
                onHasChangesChange={onHasChangesChange}
                onProgressbarVisibilityChange={onProgressbarVisibilityChange}
                title={t('orders.detailTitle')}
                noDetailMessage={t('orders.noDetailToDisplay')}
                entity={order}
                initialEntity={initialOrder}
                onFetchEntity={fetchOrder}
                onSaveEntity={saveOrder}
                onDeleteEntity={deleteOrder}
                onResetEntity={resetOrder}
                deleteConfirmMessage={t('orders.deleteConfirm')}
                resetConfirmMessage={t('common.resetConfirm')}
                pendingChangesConfirmMessage={t('common.pendingChangesConfirm')}
                disabled={disabled}
            >
                {order != null && <UpdateOrderView
                    disabled={disabled}
                    order={order}
                    products={products}
                    shouldValidate={shouldValidate}
                    onChange={setOrder}
                />} 
            </DetailCardLayout>}
        </>
    );
}