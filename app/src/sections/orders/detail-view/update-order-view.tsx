import type { OrderState, ProductListItemDto} from "src/api/Client";

import React from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import {Typography} from "@mui/material";

import {UpdateOrderDto, UpdateOrderItemDto} from "src/api/Client";

import {ClientSelect} from "../components/client-select";
import {OrderItemsTable} from "../components/order-items-table";
import {OrderStateSelect} from "../components/order-state-select";
import {OrderProductsSelect} from "../components/order-products-select";
import {OrderDeliveryDatePicker} from "../components/order-delivery-date-picker";

type UpdateOrderViewProps = {
    order: UpdateOrderDto;
    products: ProductListItemDto[]
    shouldValidate: boolean,
    disabled: boolean,
    onChange: (updated: UpdateOrderDto) => void;
};

export function UpdateOrderView({order, products, shouldValidate, disabled, onChange}: Readonly<UpdateOrderViewProps>) {
    const {t} = useTranslation();

    const handleClientSelect = (clientId: string) => {
        onChange(new UpdateOrderDto({
            ...order,
            clientId
        }));
    };

    const handleDeliveryDateSelect = (date: Date | undefined) => {
        onChange(new UpdateOrderDto({
            ...order,
            deliveryDate: date!
        }));
    };

    const handleItemsSelect = (selectedProducts: { productId: string, quantity: number }[]) => {
        onChange(new UpdateOrderDto({
            ...order,
            orderItems: selectedProducts.map(product => new UpdateOrderItemDto({
                productId: product.productId,
                quantity: product.quantity
            }))
        }))
    }

    const handleProductsChanged = (orderProducts: UpdateOrderItemDto[]) => {
        onChange(new UpdateOrderDto({
            ...order,
            orderItems: orderProducts
        }))
    }

    const handleStateSelect = (state: OrderState | null) => {
        onChange(new UpdateOrderDto({
            ...order,
            state: state ?? undefined
        }))
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box sx={{
                flexGrow: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
            }}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                    <ClientSelect selectedClientId={order.clientId} shouldValidate={shouldValidate} onSelect={handleClientSelect} disabled={disabled}/>
                    <OrderDeliveryDatePicker selectedDeliveryDate={order.deliveryDate} onDatePicked={handleDeliveryDateSelect} disabled={disabled}/>
                    <OrderStateSelect selectedState={order.state!} onSelect={handleStateSelect} disabled={disabled}/>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {t('products.title')}
                    </Typography>
                </Box>

                <OrderProductsSelect
                    disabled={disabled}
                    products={products}
                    selectedProducts={(order.orderItems ?? []).map((product) => ({
                        productId: product.productId!,
                        quantity: product.quantity!
                    }))}
                    shouldValidate={shouldValidate}
                    onProductsChanged={handleItemsSelect}
                />

                <OrderItemsTable
                    disabled={disabled}
                    orderProducts={order.orderItems ?? []}
                    products={products}
                    onProductsChanged={handleProductsChanged}
                />
            </Box>
        </Box>
    );
}