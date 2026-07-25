// Shared write-side draft builder for outgoing shipments — both the detail
// screen (nakládka toggles) and the editor (stop ordering) need to resend the
// full `UpdateOutgoingShipmentDto` arrays (there's no per-item PATCH), so this
// converts the read-side `OutgoingShipmentDetailDto` into mutable write DTOs
// once, shared by both screens.

import {
  type OutgoingShipmentDetailDto,
  ClientOrderShipmentDto,
  CustomStopDto,
  RoutePointDto,
  OrderItemInfoDto,
  InventoryExtraShipmentDto,
  ClientExtraShipmentDto,
  CustomExtraShipmentDto,
  OutgoingShipmentStopAddressKind,
} from 'src/generated/api-client';

export interface ShipmentDraft {
  clientOrderShipments: ClientOrderShipmentDto[];
  customStops: CustomStopDto[];
  routeViaPoints: RoutePointDto[];
  inventoryExtraShipments: InventoryExtraShipmentDto[];
  clientExtraShipments: ClientExtraShipmentDto[];
  customExtraShipments: CustomExtraShipmentDto[];
}

export function draftFromShipment(shipment: OutgoingShipmentDetailDto): ShipmentDraft {
  const stops = shipment.stops ?? [];
  return {
    // Order stops carry an orderId; custom stops don't.
    clientOrderShipments: stops.filter((st) => st.orderId != null).map((st) => new ClientOrderShipmentDto({
      clientOrderId: st.orderId ?? '',
      order: st.order ?? 0,
      selectedAddressKind: st.selectedAddressKind ?? OutgoingShipmentStopAddressKind.Official,
      orderItems: (st.products ?? []).map((p) => new OrderItemInfoDto({
        orderItemId: p.orderItemId,
        isLoadingConfirmed: p.isShipmentLoadingConfirmed,
      })),
    })),
    customStops: stops.filter((st) => st.orderId == null).map((st) => new CustomStopDto({
      id: st.id,
      order: st.order ?? 0,
      label: st.label ?? '',
      note: st.note,
      latitude: st.latitude ?? 0,
      longitude: st.longitude ?? 0,
    })),
    routeViaPoints: (shipment.routeViaPoints ?? []).map((p) => new RoutePointDto({ latitude: p.latitude ?? 0, longitude: p.longitude ?? 0 })),
    inventoryExtraShipments: (shipment.inventoryExtraItems ?? []).map((e) => {
      const dto = new InventoryExtraShipmentDto({
        id: e.id, quantity: e.quantity,
        isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      });
      // productId is declared on the derived class; assign after the ctor so it
      // survives regardless of `useDefineForClassFields` (a derived field init
      // would otherwise wipe a value passed into the constructor).
      dto.productId = e.productId;
      return dto;
    }),
    // Client extra has no prototype UI (flagged in the P7 report) — carried
    // through unchanged so an existing value is never silently dropped.
    clientExtraShipments: (shipment.clientExtraItems ?? []).map((e) => {
      const dto = new ClientExtraShipmentDto({
        id: e.id, quantity: e.quantity,
        isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      });
      dto.inventoryItemId = e.inventoryItemId;
      return dto;
    }),
    customExtraShipments: (shipment.customExtraItems ?? []).map((e) => {
      const dto = new CustomExtraShipmentDto({
        id: e.id, quantity: e.quantity,
        isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      });
      dto.description = e.name;
      return dto;
    }),
  };
}
