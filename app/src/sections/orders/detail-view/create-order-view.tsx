import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import { Typography} from "@mui/material";

import { useSnackbar } from "src/providers/SnackbarProvider";

import {ClientSelect} from "../components/client-select";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {OrderItemsTable} from "../components/order-items-table";
import {DrawerLayout} from "../../../layouts/components/drawer-layout";
import {OrderProductsSelect} from "../components/order-products-select";
import {OrderDeliveryDatePicker} from "../components/order-delivery-date-picker";
import { CreateOrderDto, CreateOrderItemDto, GroupedProductHistoryDto } from '../../../api/Client';



type CreateOrderViewProps = {
    width: number
    onClose: () => void
    onSave: (newOrderId: string) => void
}

export function CreateOrderView({width, onClose, onSave}: Readonly<CreateOrderViewProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [order, setOrder] = useState<CreateOrderDto>(new CreateOrderDto({
        requiredDeliveryDate: undefined,
        orderItems: [],
        clientId: ""
    }))
    
    const [shouldValidate, setShouldValidate] = useState<boolean>(false);
    const [products, setProducts] = useState<GroupedProductHistoryDto>(new GroupedProductHistoryDto({}));

    useEffect(() => {
      if (order.clientId === "")
        return;

      void fetchProducts(order.clientId)
    }, [order.clientId]);

    const fetchProducts = async (clientId: string) => {
        try {

            const client = new AuthorizedClient();
            await client.fetchProductsWithClientHistory(clientId).then(setProducts)
        } catch (e) {
            showSnackbar('products.fetchError', 'error');
            console.error('Error fetching products', e);
        }
    }
    
    const handleSave = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let requiredDeliveryDate = null;
            if (order.requiredDeliveryDate != null) {
                requiredDeliveryDate = new Date(order.requiredDeliveryDate);
                requiredDeliveryDate.setHours(0, 0, 0, 0);
            }
            
            if ((requiredDeliveryDate != null && requiredDeliveryDate < today) ||
                !order.clientId ||
                order.clientId === "" ||
                order.orderItems!.some(p => !p.quantity || p.quantity <= 0 || !p.productId)
            ) {
                setShouldValidate(true);
                showSnackbar(t('common.validationError'), 'error');
                return;
            }
            setShouldValidate(false);

            const client = new AuthorizedClient();
            await client.createOrderEndpoint(order).then(onSave)
        } catch (error) {
            showSnackbar(t('orders.saveError'), 'error');
            console.error('Error creating new product delivery:', error);
        }
    }

    const handleDeliveryDateSelect = (date: Date | undefined) => {
        setOrder(prev => new CreateOrderDto({
            ...prev,
            requiredDeliveryDate: date
        }))
    }

    const handleClientSelect = (clientId: string) => {
        setOrder(prev => new CreateOrderDto({
            ...prev,
            clientId
        }))
    }

    const handleItemsSelect = (selectedProducts: {productId: string, quantity: number}[]) => {
        setOrder(prev => new CreateOrderDto({
            ...prev,
            orderItems: selectedProducts.map(product => new CreateOrderItemDto({
                productId: product.productId,
                quantity: product.quantity
            }))
        }))
    }

    const handleProductsChanged = (orderProducts: CreateOrderItemDto[]) => {
        setOrder(prev => new CreateOrderDto({
            ...prev,
            orderItems: orderProducts
        }))
    }

    return (
        <DrawerLayout
            width={width}
            title={t('orders.new')}
            onClose={onClose}
            onSaveAndClose={() => handleSave().then(onClose)}
            isLoading={false}
        >
            <Box sx={{
                flexGrow: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
            }}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                    <ClientSelect selectedClientId={order.clientId} shouldValidate={shouldValidate} onSelect={handleClientSelect} />
                    <OrderDeliveryDatePicker
                        label={t('orders.requiredDeliveryDate')}
                        selectedDeliveryDate={order.requiredDeliveryDate}
                        onDatePicked={handleDeliveryDateSelect}
                    />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {t('products.title')}
                    </Typography>
                </Box>

                <OrderProductsSelect
                    products={products}
                    selectedProducts={(order.orderItems ?? []).map((product) => ({
                        productId: product.productId!,
                        quantity: product.quantity!
                    }))}
                    shouldValidate={shouldValidate}
                    onProductsChanged={handleItemsSelect}
                />
                
                <OrderItemsTable
                    orderProducts={order.orderItems ?? []}
                    products={products}
                    onProductsChanged={handleProductsChanged}
                />
            </Box>
        </DrawerLayout>
    );
}