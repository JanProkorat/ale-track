import { useTranslation } from 'react-i18next';

import {
     Region,
     Country,
     OrderState,
     ContactType,
     ProductKind,
     ProductType,
     ReminderType,
     UserRoleType,
     ProductDeliveryState,
     OutgoingShipmentState,
     ReminderRecurrenceType,
     OutgoingShipmentStopAddressKind,
} from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Reverse-lookup helper: numeric enum value → string key name
// TypeScript numeric enums have reverse mappings built-in.
// ---------------------------------------------------------------------------

function enumName(enumObj: Record<string | number, string | number>, value: string | number): string {
     if (typeof value === 'string') return value;
     return String(enumObj[value] ?? value);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEnumLabel() {
     const { t } = useTranslation();

     return {
          region: (value: Region | string | number) => t(`enums.region.${enumName(Region, value)}`),
          country: (value: Country | string | number) => t(`enums.country.${enumName(Country, value)}`),
          orderState: (value: OrderState | string | number) =>
               t(`enums.orderState.${enumName(OrderState, value)}`),
          productDeliveryState: (value: ProductDeliveryState | string | number) =>
               t(`enums.productDeliveryState.${enumName(ProductDeliveryState, value)}`),
          outgoingShipmentState: (value: OutgoingShipmentState | string | number) =>
               t(`enums.outgoingShipmentState.${enumName(OutgoingShipmentState, value)}`),
          productKind: (value: ProductKind | string | number) =>
               t(`enums.productKind.${enumName(ProductKind, value)}`),
          productType: (value: ProductType | string | number) =>
               t(`enums.productType.${enumName(ProductType, value)}`),
          contactType: (value: ContactType | string | number) =>
               t(`enums.contactType.${enumName(ContactType, value)}`),
          reminderType: (value: ReminderType | string | number) =>
               t(`enums.reminderType.${enumName(ReminderType, value)}`),
          recurrenceType: (value: ReminderRecurrenceType | string | number) =>
               t(`enums.recurrenceType.${enumName(ReminderRecurrenceType, value)}`),
          userRole: (value: UserRoleType | string | number) =>
               t(`enums.userRole.${enumName(UserRoleType, value)}`),
          addressKind: (value: OutgoingShipmentStopAddressKind | string | number) =>
               t(`enums.addressKind.${enumName(OutgoingShipmentStopAddressKind, value)}`),
     };
}
