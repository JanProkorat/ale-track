// Shared write-side draft builder for outgoing shipments — both the detail
// screen (nakládka toggles) and the editor (stop ordering) need to resend the
// full `UpdateOutgoingShipmentDto` arrays (there's no per-item PATCH), so this
// converts the read-side `OutgoingShipmentDetailDto` into mutable write DTOs
// once, shared by both screens.

import {
  type OutgoingShipmentDetailDto,
  ClientOrderShipmentDto,
  OrderItemInfoDto,
  InventoryExtraShipmentDto,
  ClientExtraShipmentDto,
  CustomExtraShipmentDto,
  OutgoingShipmentStopAddressKind,
} from 'src/generated/api-client';

export interface ShipmentDraft {
  clientOrderShipments: ClientOrderShipmentDto[];
  inventoryExtraShipments: InventoryExtraShipmentDto[];
  clientExtraShipments: ClientExtraShipmentDto[];
  customExtraShipments: CustomExtraShipmentDto[];
}

export function draftFromShipment(shipment: OutgoingShipmentDetailDto): ShipmentDraft {
  return {
    clientOrderShipments: (shipment.stops ?? []).map((st) => new ClientOrderShipmentDto({
      clientOrderId: st.orderId ?? '',
      order: st.order ?? 0,
      selectedAddressKind: st.selectedAddressKind ?? OutgoingShipmentStopAddressKind.Official,
      orderItems: (st.products ?? []).map((p) => new OrderItemInfoDto({
        orderItemId: p.orderItemId,
        isLoadingConfirmed: p.isShipmentLoadingConfirmed,
        firstInvoiceQuantity: p.firstInvoiceQuantity,
        secondInvoiceQuantity: p.secondInvoiceQuantity,
      })),
    })),
    inventoryExtraShipments: (shipment.inventoryExtraItems ?? []).map((e) => new InventoryExtraShipmentDto({
      id: e.id, productId: e.productId, quantity: e.quantity,
      isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      firstInvoiceQuantity: e.firstInvoiceQuantity, secondInvoiceQuantity: e.secondInvoiceQuantity,
    })),
    // Client extra has no prototype UI (flagged in the P7 report) — carried
    // through unchanged so an existing value is never silently dropped.
    clientExtraShipments: (shipment.clientExtraItems ?? []).map((e) => new ClientExtraShipmentDto({
      id: e.id, inventoryItemId: e.inventoryItemId, quantity: e.quantity,
      isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      firstInvoiceQuantity: e.firstInvoiceQuantity, secondInvoiceQuantity: e.secondInvoiceQuantity,
    })),
    customExtraShipments: (shipment.customExtraItems ?? []).map((e) => new CustomExtraShipmentDto({
      id: e.id, description: e.name, quantity: e.quantity,
      isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      firstInvoiceQuantity: e.firstInvoiceQuantity, secondInvoiceQuantity: e.secondInvoiceQuantity,
    })),
  };
}
