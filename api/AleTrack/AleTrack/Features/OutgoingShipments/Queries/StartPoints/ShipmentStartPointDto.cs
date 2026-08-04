using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.StartPoints;

/// <summary>
/// One place a run may be loaded at: the company warehouse, or a brewery.
/// </summary>
public sealed record ShipmentStartPointDto
{
    /// <summary>Which kind of origin this is.</summary>
    public ShipmentStartPointKind Kind { get; set; }

    /// <summary>Public ID of the brewery; null for the company entry.</summary>
    public Guid? BreweryId { get; set; }

    /// <summary>Display name — the company name or the brewery name.</summary>
    public string Name { get; set; } = null!;

    /// <summary>The address on one line.</summary>
    public string Address { get; set; } = null!;

    /// <summary>Latitude, when the address has been geocoded.</summary>
    public decimal? Latitude { get; set; }

    /// <summary>Longitude, when the address has been geocoded.</summary>
    public decimal? Longitude { get; set; }
}
