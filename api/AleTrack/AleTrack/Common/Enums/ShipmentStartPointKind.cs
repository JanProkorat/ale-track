namespace AleTrack.Common.Enums;

/// <summary>
/// Where a run is loaded before it sets off.
/// </summary>
public enum ShipmentStartPointKind
{
    /// <summary>The company's own warehouse — the historical default.</summary>
    Company = 0,

    /// <summary>A brewery, where the goods are picked up directly.</summary>
    Brewery = 1
}
