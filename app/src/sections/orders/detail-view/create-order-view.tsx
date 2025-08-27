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
import {
    CreateOrderDto, CreateOrderItemDto
} from "../../../api/Client";
import {OrderDeliveryDatePicker} from "../components/order-delivery-date-picker";

import type { ProductListItemDto
} from "../../../api/Client";

type CreateOrderViewProps = {
    width: number
    onClose: () => void
    onSave: (newOrderId: string) => void
}

export function CreateOrderView({width, onClose, onSave}: Readonly<CreateOrderViewProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [order, setOrder] = useState<CreateOrderDto>(new CreateOrderDto({
        deliveryDate: undefined,
        orderItems: [],
        clientId: ""
    }))
    
    const [shouldValidate, setShouldValidate] = useState<boolean>(false);
    const [products, setProducts] = useState<ProductListItemDto[]>([]);

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
    
    const handleSave = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let deliveryDate = null;
            if (order.deliveryDate != null) {
                deliveryDate = new Date(order.deliveryDate);
                deliveryDate.setHours(0, 0, 0, 0);
            }
            
            if ((deliveryDate != null && deliveryDate < today) ||
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
            deliveryDate: date
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
                    <OrderDeliveryDatePicker selectedDeliveryDate={order.deliveryDate} onDatePicked={handleDeliveryDateSelect} />
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