namespace AleTrack.Common.Enums;

/// <summary>
/// Where a delivery goes: one of the client's two addresses, or a delivery
/// place saved on the client. Carried by both <see cref="Entities.Order"/>
/// (the client's choice when ordering) and
/// <see cref="Entities.OutgoingShipmentStop"/> (what the planner routes to).
/// </summary>
public enum DeliveryAddressKind
{
    /// <summary>
    /// Official (billing) address of the client
    /// </summary>
    Official = 0,

    /// <summary>
    /// Contact address of the client
    /// </summary>
    Contact = 1,

    /// <summary>
    /// A delivery place saved on the client
    /// </summary>
    DeliveryPlace = 2
}
