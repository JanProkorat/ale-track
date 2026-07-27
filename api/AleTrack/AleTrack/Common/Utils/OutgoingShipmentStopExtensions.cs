using AleTrack.Entities;

namespace AleTrack.Common.Utils;

/// <summary>
/// Extensions for <see cref="OutgoingShipmentStop"/>.
/// </summary>
public static class OutgoingShipmentStopExtensions
{
    /// <summary>
    /// Re-derives and assigns <see cref="OutgoingShipmentStop.IsAddressOverridden"/>
    /// by comparing the stop's currently selected address against the given
    /// order's own choice. This is the single definition of "overridden": the
    /// stop's (kind, place) differs from the order's — never sent by the
    /// client, and never left stale across the four sites that write a stop's
    /// address (shipment create, shipment update ×2, order-edit propagation).
    /// </summary>
    public static void DeriveAddressOverride(this OutgoingShipmentStop stop, Order order)
    {
        stop.IsAddressOverridden =
            stop.SelectedAddressKind != order.DeliveryAddressKind
            || stop.ClientDeliveryPlaceId != order.ClientDeliveryPlaceId;
    }
}
