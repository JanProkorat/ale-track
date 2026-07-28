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
  ExtraItemInfoDto,
  StockPurchaseDto,
  PreparationStepDto,
  DeliveryAddressKind,
} from 'src/generated/api-client';

export interface ShipmentDraft {
  clientOrderShipments: ClientOrderShipmentDto[];
  customStops: CustomStopDto[];
  routeViaPoints: RoutePointDto[];
  stockPurchases: StockPurchaseDto[];
  preparationSteps: PreparationStepDto[];
}

export function draftFromShipment(shipment: OutgoingShipmentDetailDto): ShipmentDraft {
  const stops = shipment.stops ?? [];
  return {
    // Order stops carry an orderId; custom stops don't.
    clientOrderShipments: stops.filter((st) => st.orderId != null).map((st) => new ClientOrderShipmentDto({
      clientOrderId: st.orderId ?? '',
      order: st.order ?? 0,
      selectedAddressKind: st.selectedAddressKind ?? DeliveryAddressKind.Official,
      // Round-tripped so a resave triggered by something unrelated (e.g. a
      // nakládka checkbox on the detail screen) can't silently drop the
      // stop's chosen delivery place back to the billing address.
      clientDeliveryPlaceId: st.deliveryPlace?.id,
      orderItems: (st.products ?? []).map((p) => new OrderItemInfoDto({
        orderItemId: p.orderItemId,
        isLoadingConfirmed: p.isShipmentLoadingConfirmed,
        // How many of the ordered pieces come out of our stock rather than the
        // brewery. Round-tripped so an unrelated save never silently drops it.
        quantityFromInventory: p.quantityFromInventory ?? 0,
        inventoryItemId: p.inventoryItemId,
      })),
      customExtraItems: (st.customExtraItems ?? []).map((e) => new ExtraItemInfoDto({
        id: e.id,
        isLoadingConfirmed: e.isLoadingConfirmed,
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
    stockPurchases: (shipment.stockPurchases ?? []).map((e) => {
      const dto = new StockPurchaseDto({
        id: e.id, quantity: e.quantity,
        isLoadingConfirmed: e.isShipmentLoadingConfirmed,
      });
      // productId is declared on the derived class; assign after the ctor so it
      // survives regardless of `useDefineForClassFields` (a derived field init
      // would otherwise wipe a value passed into the constructor).
      dto.productId = e.productId;
      return dto;
    }),
    // Round-tripped by ID, and with good reason: an omitted step is a deleted step to the
    // server, so a save triggered by something else entirely (a nakládka checkbox, advancing
    // the state) would otherwise wipe the whole preparation checklist. Ticks are not sent —
    // they travel through the dedicated set-step endpoint and are kept server-side.
    preparationSteps: (shipment.preparationSteps ?? []).map((s) => new PreparationStepDto({
      id: s.id, order: s.order ?? 0, label: s.label ?? '',
    })),
  };
}
