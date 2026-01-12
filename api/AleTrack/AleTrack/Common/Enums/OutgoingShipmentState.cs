namespace AleTrack.Common.Enums;

/// <summary>
/// Represents the state of an outgoing shipment.
/// </summary>
public enum OutgoingShipmentState
{
    Created,
    Loaded,
    InTransit,
    Delivered,
    Cancelled
}