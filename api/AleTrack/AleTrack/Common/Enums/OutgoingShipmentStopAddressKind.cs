namespace AleTrack.Common.Enums;

/// <summary>
/// Kind of selected address for the outgoing shipment stop
/// </summary>
public enum OutgoingShipmentStopAddressKind
{
    /// <summary>
    /// Official address of the stop
    /// </summary>
    Official = 0,

    /// <summary>
    /// Contact address of the stop
    /// </summary>
    Contact = 1,

    /// <summary>
    /// A delivery place saved on the client
    /// </summary>
    DeliveryPlace = 2
}