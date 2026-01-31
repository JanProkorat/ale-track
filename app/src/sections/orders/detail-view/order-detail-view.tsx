import {useTranslation} from "react-i18next";
import {useState, useEffect, useCallback} from "react";

import {Typography} from "@mui/material";

import { useApiCall } from "src/hooks/use-api-call";

import {UpdateOrderView} from "./update-order-view";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DetailCardLayout} from "../../../layouts/dashboard/detail-card-layout";
import {
  OrderState,
  UpdateOrderDto,
  UpdateOrderItemDto,
  GroupedProductHistoryDto,
} from '../../../api/Client';

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
    const {executeApiCall} = useApiCall();

    const [initialOrder, setInitialOrder] = useState<UpdateOrderDto | null>(null);
    const [order, setOrder] = useState<UpdateOrderDto | null>(null);
    const [products, setProducts] = useState<GroupedProductHistoryDto>(new GroupedProductHistoryDto({}));

    const [shouldValidate, setShouldValidate] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);

    const fetchProducts = useCallback(async (clientId: string) => {
      const client = new AuthorizedClient();
      const result = await executeApiCall(() => client.fetchProductsWithClientHistory(clientId));
      if (result) {
        setProducts(result);
      }
    }, [executeApiCall]);

    useEffect(() => {
      if (order === null)
        return;

      void fetchProducts(order.clientId)
    }, [fetchProducts, order]);
    
    const fetchOrder = useCallback(async () => {
        if (id == null) {
            return;
        }
        
        onProgressbarVisibilityChange(true);
        const client = new AuthorizedClient();
        const detail = await executeApiCall(() => client.getOrderDetailEndpoint(id!));
        if (detail) {
            const updateOrder =  new UpdateOrderDto({
                clientId: detail.client!.id!,
                requiredDeliveryDate: detail.requiredDeliveryDate,
                state: detail.state,
                orderItems: (detail.orderItems ?? []).map((item) => new UpdateOrderItemDto({
                  productId: item.productId,
                  quantity: item.quantity,
                  reminderState: item.reminderState,
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
        }
        onProgressbarVisibilityChange(false);
    }, [disabled, executeApiCall, id, onProgressbarVisibilityChange]);

    const updateOrder = useCallback(async (orderId: string, orderToUpdate: UpdateOrderDto) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let deliveryDate = null;
        if (orderToUpdate.requiredDeliveryDate !== null && order?.requiredDeliveryDate !== undefined){
            deliveryDate = new Date(orderToUpdate.requiredDeliveryDate!);
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
        let hasError = false;
        await executeApiCall(
            () => client.updateOrderEndpoint(orderId, orderToUpdate),
            undefined,
            { onError: () => { hasError = true; } }
        );
        
        if (hasError) {
            return false;
        }
        
        showSnackbar(t('orders.saveSuccess'), 'success');
        if (orderToUpdate?.state != initialOrder?.state || orderToUpdate?.clientId != initialOrder?.clientId || orderToUpdate?.requiredDeliveryDate != initialOrder?.requiredDeliveryDate) {
            onConfirmed(true);
        }
        setInitialOrder(orderToUpdate);
        return true;
    }, [executeApiCall, initialOrder, onConfirmed, order?.requiredDeliveryDate, showSnackbar, t]);

    const saveOrder = useCallback(async () => {
        setShouldValidate(true);
        return await updateOrder(id!, order!);
    }, [id, order, updateOrder]);

    const deleteOrder = useCallback(async () => {
        const client = new AuthorizedClient();
        const result = await executeApiCall(() => client.deleteOrderEndpoint(id!));
        if (result) {
            showSnackbar(t('orders.deleteSuccess'), 'success');
        }
    }, [executeApiCall, id, showSnackbar, t]);

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