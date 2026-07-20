namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// A geographic via point that shapes the shipment's road route.
/// </summary>
public sealed record RoutePointDto
{
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}
