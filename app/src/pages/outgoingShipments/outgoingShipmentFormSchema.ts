import { z } from 'zod';

import i18n from 'src/i18n/i18n';
import { OutgoingShipmentState, OutgoingShipmentStopAddressKind } from 'src/generated/api-client';

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

export const clientOrderShipmentSchema = z.object({
     clientOrderId: z.string().min(1, { message: req() }),
     order: z.number(),
     selectedAddressKind: z.string(),
});

export const outgoingShipmentSchema = z.object({
     name: z.string().min(1, { message: req() }),
     deliveryDate: z.string().optional(),
     state: z.enum(enumStringKeys(OutgoingShipmentState) as [string, ...string[]]),
     vehicleId: z.string().optional(),
     driverIds: z.array(z.string()).optional(),
     clientOrderShipments: z.array(clientOrderShipmentSchema),
});

export type OutgoingShipmentFormValues = z.infer<typeof outgoingShipmentSchema>;

// ---------------------------------------------------------------------------
// Enum option lists
// ---------------------------------------------------------------------------

export const shipmentStateOptions = enumStringKeys(OutgoingShipmentState).map((key) => ({
     value: key,
     labelKey: `enums.outgoingShipmentState.${key}`,
}));

export const addressKindOptions = enumStringKeys(OutgoingShipmentStopAddressKind).map((key) => ({
     value: key,
     labelKey: `enums.addressKind.${key}`,
}));

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const defaultValues: OutgoingShipmentFormValues = {
     name: '',
     deliveryDate: '',
     state: 'Created',
     vehicleId: '',
     driverIds: [],
     clientOrderShipments: [],
};

// ---------------------------------------------------------------------------
// Create-only schema
// ---------------------------------------------------------------------------

export const createOutgoingShipmentSchema = z.object({
     name: z.string().min(1, { message: req() }),
     deliveryDate: z.string().optional(),
     vehicleId: z.string().optional(),
     driverIds: z.array(z.string()).optional(),
});

export type CreateOutgoingShipmentFormValues = z.infer<typeof createOutgoingShipmentSchema>;

export const createDefaultValues: CreateOutgoingShipmentFormValues = {
     name: '',
     deliveryDate: '',
     vehicleId: '',
     driverIds: [],
};
