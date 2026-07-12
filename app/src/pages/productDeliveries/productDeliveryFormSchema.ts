import { z } from 'zod';

import i18n from 'src/i18n/i18n';
import { ProductDeliveryState } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enumStringKeys<T extends Record<string, string | number>>(enumObj: T): string[] {
     return Object.keys(enumObj).filter((key) => isNaN(Number(key)));
}

const req = () => i18n.t('common.required');

// ---------------------------------------------------------------------------
// Stop item schema
// ---------------------------------------------------------------------------

export const deliveryItemSchema = z.object({
     productId: z.string().min(1, { message: req() }),
     quantity: z.number().min(1, { message: req() }),
     note: z.string().optional(),
});

export const deliveryStopSchema = z.object({
     publicId: z.string().optional(),
     breweryId: z.string().min(1, { message: req() }),
     note: z.string().optional(),
     products: z.array(deliveryItemSchema),
});

// ---------------------------------------------------------------------------
// Update schema
// ---------------------------------------------------------------------------

export const productDeliverySchema = z.object({
     deliveryDate: z.string().min(1, { message: req() }),
     state: z.enum(enumStringKeys(ProductDeliveryState) as [string, ...string[]]),
     driverIds: z.array(z.string()),
     vehicleId: z.string().optional().or(z.literal('')),
     note: z.string().optional().or(z.literal('')),
     stops: z.array(deliveryStopSchema),
});

export type ProductDeliveryFormValues = z.infer<typeof productDeliverySchema>;

// ---------------------------------------------------------------------------
// Enum option lists
// ---------------------------------------------------------------------------

export const deliveryStateOptions = enumStringKeys(ProductDeliveryState).map((key) => ({
     value: key,
     labelKey: `enums.productDeliveryState.${key}`,
}));

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const defaultValues: ProductDeliveryFormValues = {
     deliveryDate: '',
     state: 'InPlanning',
     driverIds: [],
     vehicleId: '',
     note: '',
     stops: [],
};

// ---------------------------------------------------------------------------
// Create-only schema
// ---------------------------------------------------------------------------

export const createProductDeliverySchema = z.object({
     deliveryDate: z.string().min(1, { message: req() }),
     driverIds: z.array(z.string()),
     vehicleId: z.string().optional().or(z.literal('')),
     note: z.string().optional().or(z.literal('')),
});

export type CreateProductDeliveryFormValues = z.infer<typeof createProductDeliverySchema>;

export const createDefaultValues: CreateProductDeliveryFormValues = {
     deliveryDate: '',
     driverIds: [],
     vehicleId: '',
     note: '',
};
