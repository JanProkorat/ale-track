import { z } from 'zod';

import { OrderState, OrderItemReminderState } from 'src/generated/api-client';

import i18n from 'src/i18n/i18n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enumStringKeys<T extends Record<string, string | number>>(enumObj: T): string[] {
     return Object.keys(enumObj).filter((key) => isNaN(Number(key)));
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const req = () => i18n.t('common.required');
const notInPast = () => i18n.t('common.dateNotInPast');

const futureDateString = z.string().optional().refine(
     (val) => {
          if (!val) return true;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return new Date(val) >= today;
     },
     { message: notInPast() },
);

export const orderItemSchema = z.object({
     productId: z.string().min(1, { message: req() }),
     quantity: z.number().min(1, { message: req() }),
     reminderState: z.string().optional(),
});

export const orderSchema = z.object({
     clientId: z.string().min(1, { message: req() }),
     state: z.enum(enumStringKeys(OrderState) as [string, ...string[]]),
     requiredDeliveryDate: futureDateString,
     actualDeliveryDate: z.string().optional(),
     orderItems: z.array(orderItemSchema),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

// ---------------------------------------------------------------------------
// Enum option lists
// ---------------------------------------------------------------------------

export const orderStateOptions = enumStringKeys(OrderState).map((key) => ({
     value: key,
     labelKey: `enums.orderState.${key}`,
}));

export const reminderStateOptions = enumStringKeys(OrderItemReminderState).map((key) => ({
     value: key,
     labelKey: `enums.orderItemReminderState.${key}`,
}));

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const defaultValues: OrderFormValues = {
     clientId: '',
     state: 'New',
     requiredDeliveryDate: '',
     actualDeliveryDate: '',
     orderItems: [],
};

// ---------------------------------------------------------------------------
// Create-only schema (no state / actual delivery date)
// ---------------------------------------------------------------------------

export const createOrderSchema = z.object({
     clientId: z.string().min(1, { message: req() }),
     requiredDeliveryDate: futureDateString,
});

export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

export const createDefaultValues: CreateOrderFormValues = {
     clientId: '',
     requiredDeliveryDate: '',
};
